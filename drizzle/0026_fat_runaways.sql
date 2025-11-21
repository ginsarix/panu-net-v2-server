DROP INDEX "contracts_file_name_idx";--> statement-breakpoint
DROP INDEX "file_hashes_name_idx";--> statement-breakpoint
CREATE INDEX "contracts_file_name_idx" ON "contracts" USING btree ("file_name");--> statement-breakpoint
CREATE INDEX "file_hashes_name_idx" ON "file_hashes" USING btree ("name");