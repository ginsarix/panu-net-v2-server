CREATE TABLE "current_definition" (
	"id" serial PRIMARY KEY NOT NULL,
	"definition_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "definitions" ALTER COLUMN "payment_link" SET DEFAULT 'https://pos.param.com.tr/Tahsilat/Default-v2.aspx?k=95452986-9df4-4d45-8417-fded07a485ef';--> statement-breakpoint
ALTER TABLE "current_definition" ADD CONSTRAINT "current_definition_definition_id_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."definitions"("id") ON DELETE set null ON UPDATE no action;