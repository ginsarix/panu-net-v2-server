DROP INDEX "contracts_file_name_idx";--> statement-breakpoint
DROP INDEX "file_hashes_name_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_file_name_idx" ON "contracts" USING btree ("file_name");--> statement-breakpoint
CREATE UNIQUE INDEX "file_hashes_name_idx" ON "file_hashes" USING btree ("name");--> statement-breakpoint
ALTER TABLE "file_hashes" ADD CONSTRAINT "file_hashes_name_unique" UNIQUE("name");