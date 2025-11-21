CREATE TABLE "file_hashes" (
	"id" serial PRIMARY KEY NOT NULL,
	"hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_on" timestamp with time zone,
	CONSTRAINT "file_hashes_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
ALTER TABLE "files" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "files" CASCADE;--> statement-breakpoint
--> statement-breakpoint
DROP INDEX "contracts_file_id_idx";--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "file_name" varchar(255) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "file_hashes_hash_idx" ON "file_hashes" USING btree ("hash");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_file_name_idx" ON "contracts" USING btree ("file_name");--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "file_id";--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_file_name_unique" UNIQUE("file_name");