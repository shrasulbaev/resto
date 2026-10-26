import { pool } from "@/db/client";

// Venue events fan out to waiter/kitchen/admin screens and to guest phones.
export type VenueEvent =
  | { type: "call"; callId: string; tableId: string }
  | { type: "table"; tableId: string }
  | { type: "order"; orderId: string; tableId: string }
  | { type: "item_ready"; orderId: string; tableId: string; itemId: string }
  | { type: "menu" };

export const CHANNEL = "resto_events";

export async function publish(venueId: string, event: VenueEvent) {
  await pool().query("select pg_notify($1, $2)", [CHANNEL, JSON.stringify({ venueId, ...event })]);
}
