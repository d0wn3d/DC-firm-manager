"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getFirmProfile, decodeJwtExpiry, TreasuryAuthError } from "@/lib/treasury";

export interface SettingsState {
  error: string | null;
  success: string | null;
}

const empty: SettingsState = { error: null, success: null };

export async function updateWebhook(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await getSession();
  if (!session?.firm) return { ...empty, error: "Not connected to a firm." };

  const webhookUrl = (formData.get("webhookUrl") as string)?.trim() || null;
  if (webhookUrl && !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
    return { ...empty, error: "That doesn't look like a Discord webhook URL." };
  }

  const db = createServiceClient();
  const { error } = await db
    .from("firms")
    .update({ discord_webhook_url: webhookUrl })
    .eq("id", session.firm.id);

  if (error) return { ...empty, error: error.message };
  revalidatePath("/settings");
  return { ...empty, success: "Saved." };
}

export async function reconnectJwt(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await getSession();
  if (!session?.firm) return { ...empty, error: "Not connected to a firm." };

  const jwt = (formData.get("jwt") as string)?.trim();
  if (!jwt) return { ...empty, error: "Paste the new token first." };

  let profile;
  try {
    profile = await getFirmProfile(jwt);
  } catch (err) {
    if (err instanceof TreasuryAuthError) {
      return { ...empty, error: "DemocracyCraft rejected that token." };
    }
    return { ...empty, error: err instanceof Error ? err.message : "Couldn't reach the Treasury API." };
  }

  if (profile.firmId !== session.firm.dc_firm_id) {
    return {
      ...empty,
      error: `That token is scoped to ${profile.displayName}, not ${session.firm.dc_firm_name}. Issue one for the right firm.`,
    };
  }

  const db = createServiceClient();
  const { error } = await db
    .from("firms")
    .update({
      treasury_jwt: jwt,
      treasury_jwt_expires_at: decodeJwtExpiry(jwt)?.toISOString() ?? null,
      jwt_invalid: false,
    })
    .eq("id", session.firm.id);

  if (error) return { ...empty, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/dashboard", "layout");
  return { ...empty, success: "Token updated — syncing will resume on the next cycle." };
}
