ALTER TABLE "contracts" ADD COLUMN "file_hash" varchar(64) NOT NULL;--> statement-breakpoint
CREATE INDEX "contracts_file_hash_idx" ON "contracts" USING btree ("file_hash");--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_file_hash_unique" UNIQUE("file_hash");