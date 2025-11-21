ALTER TABLE "file_hashes" ADD COLUMN "name" varchar(255) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "file_hashes_name_idx" ON "file_hashes" USING btree ("name");