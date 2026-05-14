CREATE TYPE "public"."time_entry_source" AS ENUM('manual', 'imported', 'outlook');--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"duration_minutes" integer NOT NULL,
	"project_id" uuid,
	"leave_type_id" uuid,
	"comment" text,
	"source" time_entry_source DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entries_kind_xor" CHECK (("time_entries"."project_id" IS NOT NULL)::int + ("time_entries"."leave_type_id" IS NOT NULL)::int = 1),
	CONSTRAINT "time_entries_duration_positive" CHECK ("time_entries"."duration_minutes" > 0),
	CONSTRAINT "time_entries_time_range" CHECK (("time_entries"."start_time" IS NULL AND "time_entries"."end_time" IS NULL) OR ("time_entries"."start_time" IS NOT NULL AND "time_entries"."end_time" IS NOT NULL AND "time_entries"."end_time" > "time_entries"."start_time"))
);
--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "time_entries_user_date_idx" ON "time_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "time_entries_project_idx" ON "time_entries" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_external_unique" ON "time_entries" USING btree ("source","external_id") WHERE "time_entries"."external_id" IS NOT NULL;