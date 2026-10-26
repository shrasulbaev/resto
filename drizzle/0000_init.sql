CREATE TYPE "public"."assignment_mode" AS ENUM('any', 'assigned');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('new', 'accepted', 'done', 'expired');--> statement-breakpoint
CREATE TYPE "public"."call_type" AS ENUM('waiter', 'bill', 'container', 'other');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('new', 'ready', 'served', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_source" AS ENUM('guest', 'waiter');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'sent', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('waiter', 'kitchen');--> statement-breakpoint
CREATE TYPE "public"."table_status" AS ENUM('closed', 'pending', 'open');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('platform', 'owner');--> statement-breakpoint
CREATE TYPE "public"."visit_close_reason" AS ENUM('paid', 'no_response', 'timeout', 'manual');--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"visit_id" uuid NOT NULL,
	"type" "call_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "call_status" DEFAULT 'new' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"escalated" boolean DEFAULT false NOT NULL,
	"accepted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name_ru" text NOT NULL,
	"name_ky" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dish_interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"dish_id" uuid NOT NULL,
	"visit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name_ru" text NOT NULL,
	"name_ky" text,
	"description_ru" text,
	"description_ky" text,
	"composition_ru" text,
	"composition_ky" text,
	"price" integer NOT NULL,
	"weight" text,
	"kcal" integer,
	"protein" real,
	"fat" real,
	"carbs" real,
	"allergens" text[] DEFAULT '{}'::text[] NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_signature" boolean DEFAULT false NOT NULL,
	"hit_pinned" boolean DEFAULT false NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"photo_url" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"dish_id" uuid,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"qty" integer NOT NULL,
	"comment" text,
	"status" "item_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"served_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"visit_id" uuid NOT NULL,
	"waiter_id" uuid,
	"source" "order_source" NOT NULL,
	"status" "order_status" DEFAULT 'draft' NOT NULL,
	"payment" "payment_method",
	"total" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"staff_id" uuid,
	"user_id" uuid,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" "staff_role" NOT NULL,
	"pin_hash" text,
	"invite_token" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "table_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"guest_key" text NOT NULL,
	"status" "table_status" DEFAULT 'pending' NOT NULL,
	"waiter_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"close_reason" "visit_close_reason",
	CONSTRAINT "table_visits_guest_key_unique" UNIQUE("guest_key")
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"token" text NOT NULL,
	"status" "table_status" DEFAULT 'closed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tables_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"venue_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"background_url" text,
	"background_dim" integer DEFAULT 45 NOT NULL,
	"timezone" text DEFAULT 'Asia/Bishkek' NOT NULL,
	"opens_at" text,
	"closes_at" text,
	"call_pause_sec" integer DEFAULT 300 NOT NULL,
	"max_pending_calls" integer DEFAULT 3 NOT NULL,
	"auto_close_hours" integer DEFAULT 4 NOT NULL,
	"assignment_mode" "assignment_mode" DEFAULT 'any' NOT NULL,
	"escalate_after_sec" integer DEFAULT 120 NOT NULL,
	"telegram_chat_id" text,
	"telegram_link_code" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "waiter_tables" (
	"staff_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	CONSTRAINT "waiter_tables_staff_id_table_id_pk" PRIMARY KEY("staff_id","table_id")
);
--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_visit_id_table_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."table_visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_accepted_by_staff_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_interest" ADD CONSTRAINT "dish_interest_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_interest" ADD CONSTRAINT "dish_interest_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_interest" ADD CONSTRAINT "dish_interest_visit_id_table_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."table_visits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_visit_id_table_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."table_visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_waiter_id_staff_id_fk" FOREIGN KEY ("waiter_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_visits" ADD CONSTRAINT "table_visits_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_visits" ADD CONSTRAINT "table_visits_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_visits" ADD CONSTRAINT "table_visits_waiter_id_staff_id_fk" FOREIGN KEY ("waiter_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiter_tables" ADD CONSTRAINT "waiter_tables_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiter_tables" ADD CONSTRAINT "waiter_tables_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calls_venue_status_idx" ON "calls" USING btree ("venue_id","status");--> statement-breakpoint
CREATE INDEX "categories_venue_idx" ON "categories" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "dish_interest_venue_idx" ON "dish_interest" USING btree ("venue_id","created_at");--> statement-breakpoint
CREATE INDEX "dishes_venue_idx" ON "dishes" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "dishes_category_idx" ON "dishes" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_venue_status_idx" ON "order_items" USING btree ("venue_id","status");--> statement-breakpoint
CREATE INDEX "orders_venue_status_idx" ON "orders" USING btree ("venue_id","status");--> statement-breakpoint
CREATE INDEX "orders_visit_idx" ON "orders" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "staff_venue_idx" ON "staff" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "visits_table_idx" ON "table_visits" USING btree ("table_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tables_venue_number_idx" ON "tables" USING btree ("venue_id","number");