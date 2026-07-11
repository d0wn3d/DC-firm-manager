"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getFirmProfile, TreasuryAuthError } from "@/lib/treasury";
import { pollFirm } from "@/lib/poll";

export interface ConnectFirmState {
  error: string | null;
}

export async function connectFirm(
  _prevState: ConnectFirmState,
  formData: FormData,
): Promise<ConnectFirmState> {
  const jwt = (formData.get("jwt") as string)?.trim();
  const webhookUrl = (formData.get("webhookUrl") as string)?.trim() || null;

  if (!jwt) {
    return { error: "Paste the JWT from /treasuryapi business issue first." };
  }
  if (webhookUrl && !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
    return { error: "That doesn't look like a Discord webhook URL — it should start with https://discord.com/api/webhooks/." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired — sign in again." };
  }

  let profile;
  try {
    profile = await getFirmProfile(jwt);
  } catch (err) {
    if (err instanceof TreasuryAuthError) {
      return { error: "DemocracyCraft rejected that token. Re-issue it with /treasuryapi business issue and paste the fresh one." };
    }
    return { error: err instanceof Error ? err.message : "Couldn't reach the Treasury API." };
  }

  if (profile.archived) {
    return { error: `${profile.displayName} is archived on DemocracyCraft — nothing to track.` };
  }

  const db = createServiceClient();

  const { data: firm, error: upsertError } = await db
    .from("firms")
    .upsert(
      {
        dc_firm_id: profile.firmId,
        dc_firm_name: profile.displayName,
        treasury_jwt: jwt,
        jwt_invalid: false,
        discord_webhook_url: webhookUrl,
      },
      { onConflict: "dc_firm_id" },
    )
    .select()
    .single();

  if (upsertError || !firm) {
    return { error: upsertError?.message ?? "Couldn't save the firm — try again." };
  }

  const { error: memberError } = await db
    .from("firm_members")
    .upsert(
      { firm_id: firm.id, user_id: user.id, role: "owner" },
      { onConflict: "firm_id,user_id" },
    );

  if (memberError) {
    return { error: memberError.message };
  }

  // First sync happens inline so the dashboard isn't empty on arrival —
  // afterwards the cron job keeps it fresh.
  await pollFirm(firm);

  redirect("/dashboard");
}
