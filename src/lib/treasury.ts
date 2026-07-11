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

async function treasuryFetch(path: string, jwt: string, params?: Record<string, string | number>) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    throw new TreasuryAuthError();
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

/**
 * GET /chestshop/shops, paginated. Fetches every page and returns the raw
 * list. We ask for `firmId` as a query param in case the API supports
 * server-side filtering — if it doesn't, unknown params are typically just
 * ignored by Spring, and the caller filters client-side anyway, so this is
 * safe either way. Check the Parameters section in the Swagger UI yourself
 * to see whether it's actually honored; if it is, this gets a lot cheaper.
 */
export async function getAllShops(jwt: string, opts?: { firmId?: number }): Promise<TreasuryShop[]> {
  const pageSize = 200;
  const all: TreasuryShop[] = [];
  let page = 0;
  let totalPages = 1;

  do {
    const data: PagedResponse<TreasuryShop> = await treasuryFetch("/chestshop/shops", jwt, {
      page,
      size: pageSize,
      ...(opts?.firmId ? { firmId: opts.firmId } : {}),
    });
    all.push(...(data.items ?? []));
    totalPages = data.totalPages ?? 1;
    page += 1;
  } while (page < totalPages);

  return opts?.firmId ? all.filter((s) => s.firmId === opts.firmId) : all;
}

/** Shops belonging to one firm, via the firm-scoped JWT from `/treasuryapi business issue`. */
export async function getFirmShops(jwt: string, firmId: number): Promise<TreasuryShop[]> {
  return getAllShops(jwt, { firmId });
}
