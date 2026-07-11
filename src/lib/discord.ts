import "server-only";
import type { TreasuryShop } from "./treasury";

const RUST = 0xa63d2f;
const BRASS = 0xc9a227;

function coords(shop: Pick<TreasuryShop, "world" | "x" | "y" | "z">) {
  return `${shop.world} (${shop.x}, ${shop.y}, ${shop.z})`;
}

export async function sendStockAlert(
  webhookUrl: string,
  firmName: string,
  shop: TreasuryShop,
  state: "empty" | "low",
) {
  const label = state === "empty" ? "OUT OF STOCK" : "LOW STOCK";
  const itemLabel = shop.itemName ?? shop.itemKey;

  const body = {
    embeds: [
      {
        title: `${label} — ${itemLabel}`,
        description: `A ${firmName} shop needs restocking.`,
        color: state === "empty" ? RUST : BRASS,
        fields: [
          { name: "Current stock", value: String(shop.currentStock ?? "unknown"), inline: true },
          { name: "Location", value: coords(shop), inline: true },
        ],
        footer: { text: "Stockbook" },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook returned ${res.status}`);
  }
}
