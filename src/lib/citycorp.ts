import "server-only";

// Everything in this file is verified against real examples from CityRP's
// reference docs (screenshots + a live /corp response), not guessed from
// the endpoint-name-only summary in CityRP-API.txt. Where something is
// inferred rather than confirmed, it's called out explicitly in a comment
// — most notably the Basic Auth construction in getCorp() below, which
// hasn't been tested against a real account yet.
//
// This does NOT yet cover accounts, transactions, staff, or shops — those
// endpoint shapes haven't been confirmed. Nothing here should be treated
// as a drop-in replacement for lib/treasury.ts until those land.

const AUTH_BASE_URL = "https://api.cityrp.org/auth";
const CITYCORP_BASE_URL = "https://api.cityrp.org/citycorp";

export class CityRPAuthError extends Error {
  constructor(message = "CityRP rejected the request (expired/invalid grant, or bad credentials).") {
    super(message);
    this.name = "CityRPAuthError";
  }
}

/**
 * Confirmed from a live example in CityRP's reference docs. Two things
 * about this response are unusual and worth remembering everywhere this
 * gets used:
 *  - token_type is genuinely "Basic", not "Bearer". CityCorp/CityRealty
 *    calls use this token as the *password* half of HTTP Basic Auth, with
 *    minecraft_uuid as the username (see getCorp() below) — inferred from
 *    how CityRP-API.txt's "player UUID as username, in-game API key as
 *    password" description lines up with these two fields arriving
 *    together, not stated outright anywhere.
 *  - The token here is "crp_"-prefixed. CityRP-API.txt describes crp_ as
 *    an app-only token and crpoa_ as the player-scoped one — this real
 *    response contradicts that text summary (which Antonio paraphrased,
 *    not copied verbatim). Going with what the live API actually returns.
 */
export interface CityRPTokenResponse {
  token: string;
  token_type: "Basic";
  scope: string[];
  minecraft_uuid: string;
}

/**
 * POST /token — exchanges the one-time code from the OAuth redirect for a
 * long-lived per-player token. CityRP's own field naming here is
 * confusing enough to call out explicitly: the request field named
 * `client_secret` is actually the one-time auth code from the redirect,
 * NOT a persistent secret. `token` is the real persistent secret — this
 * app's own CITYRP_APP_TOKEN, from the CityRP developer dashboard.
 *
 * Call this from Stockbook's own OAuth callback route, not from
 * Supabase's — see the note in AGENTS.md / the chat about why Supabase's
 * generic custom-provider flow is not being used for this integration.
 */
export async function exchangeAuthCode(authCode: string): Promise<CityRPTokenResponse> {
  const appToken = process.env.CITYRP_APP_TOKEN;
  const appId = process.env.CITYRP_APP_ID;
  if (!appToken || !appId) {
    throw new Error("CITYRP_APP_TOKEN / CITYRP_APP_ID are not configured.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_secret: authCode, // yes, really — see the doc comment above
    token: appToken,
    app_id: appId,
  });

  const res = await fetch(`${AUTH_BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (res.status === 400) {
    const payload: { error?: string } | null = await res.json().catch(() => null);
    throw new CityRPAuthError(
      payload?.error ? `CityRP rejected the token exchange: ${payload.error}` : undefined,
    );
  }
  if (!res.ok) {
    throw new Error(`CityRP /token returned ${res.status}: ${await res.text().catch(() => "")}`);
  }

  return res.json();
}

/**
 * Confirmed against a real example response for GET /corp. Two things
 * worth flagging for anyone touching money values from this API:
 *  - `balance` (and presumably every other money field in this API) comes
 *    back as a raw JSON number, not a decimal string the way DC's
 *    Treasury API deliberately does to dodge float-rounding risk. Convert
 *    to a fixed-precision representation immediately on receipt for
 *    anything that gets stored or summed — don't chain float arithmetic
 *    on these the way you safely could with DC's decimal strings.
 *  - `totalValuation` / `valuationBreakdown` suggest CityRP computes a
 *    corp's value (shops + stock) natively. If that holds up under real
 *    use, it may be able to replace Stockbook's own warehouse-valuation
 *    logic for CityRP corps rather than duplicating it — worth confirming
 *    exactly what "shops" valuation includes before relying on it for
 *    anything real.
 */
export interface CityRPCorp {
  ID: number;
  name: string;
  owner: string; // minecraft_uuid of the owning player
  corpType: { id: string; name: string };
  balance: number;
  valuationBreakdown: { shops: number; stock: number };
  totalValuation: number;
  description: string;
  discordLink: string | null;
  hqPlotID: number | null;
  ticker: string;
}

/**
 * GET /corp — auth construction here (Basic, minecraft_uuid:token) is
 * INFERRED, not confirmed from an explicit statement in the docs. Test
 * this against a real corp before anything depends on it.
 */
export async function getCorp(minecraftUuid: string, token: string): Promise<CityRPCorp> {
  const credentials = Buffer.from(`${minecraftUuid}:${token}`).toString("base64");

  const res = await fetch(`${CITYCORP_BASE_URL}/corp`, {
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    throw new CityRPAuthError();
  }
  if (!res.ok) {
    throw new Error(`CityRP /corp returned ${res.status}: ${await res.text().catch(() => "")}`);
  }

  return res.json();
}
