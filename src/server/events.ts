import { pool } from "@/db/client";

// Venue events fan out to waiter/kitchen/admin screens and to guest phones.
export type VenueEvent =
  | { type: "call"; callId: string; tableId: string; escalated?: boolean }
  | { type: "table"; tableId: string }
  | { type: "order"; orderId: string; tableId: string }
  | { type: "item_ready"; orderId: string; tableId: string; itemId: string }
  | { type: "alert"; kind: "no_response"; tableId: string }
  | { type: "bill_closed"; orderId: string; tableId: string }
  | { type: "menu" };

export const CHANNEL = "resto_events";

export async function publish(venueId: string, event: VenueEvent) {
  await pool().query("select pg_notify($1, $2)", [CHANNEL, JSON.stringify({ venueId, ...event })]);
}
