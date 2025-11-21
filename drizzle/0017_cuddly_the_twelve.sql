CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255),
	"file_name" varchar(255) NOT NULL,
	"company_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_on" timestamp with time zone,
	CONSTRAINT "contracts_file_name_unique" UNIQUE("file_name")
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contracts_title_idx" ON "contracts" USING btree ("title");