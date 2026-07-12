import "server-only";

const BASE_URL = "https://api.democracycraft.net/economy/api/v1";

export class TreasuryAuthError extends Error {
  constructor(message = "Treasury API rejected the JWT (expired or invalid).") {
    super(message);
    this.name = "TreasuryAuthError";
  }
}

export interface TreasuryFirmProfile {
  firmId: number;
  displayName: string;
  discordUrl: string | null;
  hqRegion: string | null;
  archived: boolean;
}

export interface TreasuryMe {
  keyId: number;
  ownerUuid: string;
  keyType: "PERSONAL" | "BUSINESS" | string;
  accountId: number | null;
  firmId: number | null;
}

export interface TreasuryRotateResult {
  keyId: number;
  token: string;
  issuedAt: string;
  expiresAt: string;
}

// Prices are decimal strings straight from the API and stay that way all
// the way into Postgres — the spec is explicit that converting to a JS
// number risks IEEE 754 rounding. Only ever parse these for *display*.
export interface TreasuryShop {
  shopId: number;
  world: string;
  x: number;
  y: number;
  z: number;
  adminShop: boolean;
  accountType: string | null;
  firmId: number | null;
  ownerUuid: string | null;
  ownerName: string | null;
  material: string | null;
  itemKey: string;
  itemName: string | null;
  itemCustom: boolean;
  buyPrice: string | null;
  sellPrice: string | null;
  batchQty: number | null;
  currentStock: number | null;
  stockAt: string | null;
  lastSeen: string | null;
}

interface PagedResponse<T> {
  page: number;
  totalPages: number;
  totalItems: number;
  items: T[];
}

async function treasuryFetch(
  path: string,
  jwt: string,
  params?: Record<string, string | number | boolean>,
  init?: RequestInit,
) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${jwt}`, ...(init?.headers ?? {}) },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    throw new TreasuryAuthError();
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    throw new Error(`Treasury API rate limit hit${retryAfter ? ` — retry after ${retryAfter}s` : ""}.`);
  }
  if (!res.ok) {
    throw new Error(`Treasury API ${path} returned ${res.status}: ${await res.text().catch(() => "")}`);
  }

  return res.json();
}

/** GET /firms/me — validates a JWT and returns the firm it's scoped to. */
export async function getFirmProfile(jwt: string): Promise<TreasuryFirmProfile> {
  return treasuryFetch("/firms/me", jwt);
}

/** GET /auth/me — lightweight token introspection (doesn't include expiry; decode the JWT for that). */
export async function getMe(jwt: string): Promise<TreasuryMe> {
  return treasuryFetch("/auth/me", jwt);
}

/**
 * POST /auth/rotate — exchanges the current JWT for a fresh one before it
 * expires. Rate-limited to 5/min, so this should only be called when
 * actually close to expiry, not on every poll.
 */
export async function rotateToken(jwt: string): Promise<TreasuryRotateResult> {
  return treasuryFetch("/auth/rotate", jwt, undefined, { method: "POST" });
}

/**
 * Reads the `exp` claim out of a JWT without verifying the signature — we
 * only use this to know when to proactively rotate, never to authorize
 * anything, so skipping verification here is fine (the API itself is the
 * actual authority; this is just a local clock check).
 */
export function decodeJwtExpiry(jwt: string): Date | null {
  try {
    const payload = jwt.split(".")[1];
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const json = JSON.parse(Buffer.from(padded, "base64url").toString("utf8"));
    return typeof json.exp === "number" ? new Date(json.exp * 1000) : null;
  } catch {
    return null;
  }
}

/**
 * GET /chestshop/shops. `firmId` is a real server-side filter (confirmed
 * against the actual spec), so this is normally 1-2 requests, not the
 * hundreds it'd take to page through the whole server. Still loops in case
 * a firm ever has more shops than one page holds. `inStock`/`buyable` are
 * deliberately left unset — we want empty shops to show up, not get
 * filtered out.
 */
export async function getFirmShops(jwt: string, firmId: number): Promise<TreasuryShop[]> {
  const limit = 100;
  const all: TreasuryShop[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const data: PagedResponse<TreasuryShop> = await treasuryFetch("/chestshop/shops", jwt, {
      page,
      limit,
      firmId,
    });
    all.push(...(data.items ?? []));
    totalPages = data.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  // Belt-and-suspenders in case firmId is ever ignored for some edge case.
  return all.filter((s) => s.firmId === firmId);
}
