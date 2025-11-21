DROP INDEX "contracts_file_name_idx";--> statement-breakpoint
CREATE INDEX "contracts_file_name_idx" ON "contracts" USING btree ("file_name");