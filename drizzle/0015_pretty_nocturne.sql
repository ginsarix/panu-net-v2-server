ALTER TABLE "users" ADD COLUMN "last_request_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "users_last_request_idx" ON "users" USING btree ("last_request_at");