CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_on" timestamp with time zone,
	CONSTRAINT "files_name_unique" UNIQUE("name"),
	CONSTRAINT "files_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_file_hash_unique";--> statement-breakpoint
DROP INDEX "contracts_file_hash_idx";--> statement-breakpoint
DROP INDEX "contracts_file_name_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "files_name_idx" ON "files" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "files_hash_idx" ON "files" USING btree ("hash");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_file_name_idx" ON "contracts" USING btree ("file_name");--> statement-breakpoint
ALTER TABLE "contracts" DROP COLUMN "file_hash";