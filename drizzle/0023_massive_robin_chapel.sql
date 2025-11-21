ALTER TABLE "contracts" RENAME COLUMN "file_name" TO "file_id";--> statement-breakpoint
ALTER TABLE "contracts" ALTER COLUMN "file_id" TYPE integer USING "file_id"::integer;
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_file_name_unique";--> statement-breakpoint
DROP INDEX "contracts_file_name_idx";--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_file_id_idx" ON "contracts" USING btree ("file_id");