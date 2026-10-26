import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Every venue-owned table carries venue_id; all queries go through
// venue-scoped helpers so one venue never sees another's data.

export const userRole = pgEnum("user_role", ["platform", "owner"]);
export const staffRole = pgEnum("staff_role", ["waiter", "kitchen"]);
export const assignmentMode = pgEnum("assignment_mode", ["any", "assigned"]);
export const tableStatus = pgEnum("table_status", ["closed", "pending", "open"]);
export const visitCloseReason = pgEnum("visit_close_reason", ["paid", "no_response", "timeout", "manual"]);
export const callType = pgEnum("call_type", ["waiter", "bill", "container", "other"]);
export const callStatus = pgEnum("call_status", ["new", "accepted", "done", "expired"]);
export const orderSource = pgEnum("order_source", ["guest", "waiter"]);
export const orderStatus = pgEnum("order_status", ["draft", "sent", "closed", "cancelled"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "card"]);
export const itemStatus = pgEnum("item_status", ["new", "ready", "served", "cancelled"]);

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const venueRef = () =>
  uuid("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" });

export const venues = pgTable("venues", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  backgroundUrl: text("background_url"),
  backgroundDim: integer("background_dim").notNull().default(45),
  timezone: text("timezone").notNull().default("Asia/Bishkek"),
  // "HH:MM" local time; null means open around the clock.
  opensAt: text("opens_at"),
  closesAt: text("closes_at"),
  callPauseSec: integer("call_pause_sec").notNull().default(300),
  maxPendingCalls: integer("max_pending_calls").notNull().default(3),
  autoCloseHours: integer("auto_close_hours").notNull().default(4),
  assignmentMode: assignmentMode("assignment_mode").notNull().default("any"),
  escalateAfterSec: integer("escalate_after_sec").notNull().default(120),
  telegramChatId: text("telegram_chat_id"),
  telegramLinkCode: text("telegram_link_code"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRole("role").notNull(),
  venueId: uuid("venue_id").references(() => venues.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const staff = pgTable(
  "staff",
  {
    id: id(),
    venueId: venueRef(),
    name: text("name").notNull(),
    role: staffRole("role").notNull(),
    pinHash: text("pin_hash"),
    inviteToken: text("invite_token").unique(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("staff_venue_idx").on(t.venueId)],
);

export const tables = pgTable(
  "tables",
  {
    id: id(),
    venueId: venueRef(),
    number: integer("number").notNull(),
    token: text("token").notNull().unique(),
    status: tableStatus("status").notNull().default("closed"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tables_venue_number_idx").on(t.venueId, t.number)],
);

export const waiterTables = pgTable(
  "waiter_tables",
  {
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.tableId] })],
);

export const tableVisits = pgTable(
  "table_visits",
  {
    id: id(),
    venueId: venueRef(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    // Guests' phones keep this key; it stops working when the visit closes.
    guestKey: text("guest_key").notNull().unique(),
    status: tableStatus("status").notNull().default("pending"),
    waiterId: uuid("waiter_id").references(() => staff.id, { onDelete: "set null" }),
    openedAt: createdAt(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closeReason: visitCloseReason("close_reason"),
  },
  (t) => [index("visits_table_idx").on(t.tableId, t.status)],
);

export const calls = pgTable(
  "calls",
  {
    id: id(),
    venueId: venueRef(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id")
      .notNull()
      .references(() => tableVisits.id, { onDelete: "cascade" }),
    type: callType("type").notNull(),
    // Payment method for "bill", free text for "other", guest selection for "waiter".
    payload: jsonb("payload").$type<CallPayload>().notNull().default({}),
    status: callStatus("status").notNull().default("new"),
    attempt: integer("attempt").notNull().default(1),
    escalated: boolean("escalated").notNull().default(false),
    acceptedBy: uuid("accepted_by").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [index("calls_venue_status_idx").on(t.venueId, t.status)],
);

export type CallPayload = {
  payment?: "cash" | "card";
  comment?: string;
  selection?: { dishId: string; qty: number; comment?: string }[];
};

export const categories = pgTable(
  "categories",
  {
    id: id(),
    venueId: venueRef(),
    nameRu: text("name_ru").notNull(),
    nameKy: text("name_ky"),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("categories_venue_idx").on(t.venueId)],
);

export const dishes = pgTable(
  "dishes",
  {
    id: id(),
    venueId: venueRef(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    nameRu: text("name_ru").notNull(),
    nameKy: text("name_ky"),
    descriptionRu: text("description_ru"),
    descriptionKy: text("description_ky"),
    compositionRu: text("composition_ru"),
    compositionKy: text("composition_ky"),
    price: integer("price").notNull(),
    weight: text("weight"),
    kcal: integer("kcal"),
    protein: real("protein"),
    fat: real("fat"),
    carbs: real("carbs"),
    allergens: text("allergens").array().notNull().default(sql`'{}'::text[]`),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    isSignature: boolean("is_signature").notNull().default(false),
    hitPinned: boolean("hit_pinned").notNull().default(false),
    inStock: boolean("in_stock").notNull().default(true),
    photoUrl: text("photo_url"),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("dishes_venue_idx").on(t.venueId), index("dishes_category_idx").on(t.categoryId)],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    venueId: venueRef(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id")
      .notNull()
      .references(() => tableVisits.id, { onDelete: "cascade" }),
    waiterId: uuid("waiter_id").references(() => staff.id, { onDelete: "set null" }),
    source: orderSource("source").notNull(),
    status: orderStatus("status").notNull().default("draft"),
    payment: paymentMethod("payment"),
    total: integer("total").notNull().default(0),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("orders_venue_status_idx").on(t.venueId, t.status), index("orders_visit_idx").on(t.visitId)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    venueId: venueRef(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    dishId: uuid("dish_id").references(() => dishes.id, { onDelete: "set null" }),
    // Name and price are copied so later menu edits do not rewrite history.
    name: text("name").notNull(),
    price: integer("price").notNull(),
    qty: integer("qty").notNull(),
    comment: text("comment"),
    status: itemStatus("status").notNull().default("new"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    servedAt: timestamp("served_at", { withTimezone: true }),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_venue_status_idx").on(t.venueId, t.status)],
);

// Dishes guests put into "My selection"; compared with orders in stats.
export const dishInterest = pgTable(
  "dish_interest",
  {
    id: id(),
    venueId: venueRef(),
    dishId: uuid("dish_id")
      .notNull()
      .references(() => dishes.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id").references(() => tableVisits.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("dish_interest_venue_idx").on(t.venueId, t.createdAt)],
);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: id(),
  venueId: venueRef(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: createdAt(),
});

export type Venue = typeof venues.$inferSelect;
export type User = typeof users.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Table = typeof tables.$inferSelect;
export type TableVisit = typeof tableVisits.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Dish = typeof dishes.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
