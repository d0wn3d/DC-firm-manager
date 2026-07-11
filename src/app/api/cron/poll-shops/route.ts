import { NextResponse } from "next/server";
import { pollAllFirms } from "@/lib/poll";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await pollAllFirms();
  const summary = {
    firmsPolled: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).map((r) => ({ firmId: r.firmId, error: r.error })),
  };

  return NextResponse.json(summary);
}
