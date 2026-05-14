ALTER TABLE "projects" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_external_id_unique" ON "projects" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_external_id_unique" ON "users" USING btree ("external_id");