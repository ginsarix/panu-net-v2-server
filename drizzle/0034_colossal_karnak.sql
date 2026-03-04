CREATE TYPE "public"."priority_enum" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_state_enum" AS ENUM('open', 'in_process', 'completed', 'reopened');--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"author_user_id" integer,
	"message" varchar(5000) NOT NULL,
	"creation_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" varchar(5000),
	"created_by_user_id" integer,
	"belonging_company_id" integer,
	"ticketState" "ticket_state_enum" DEFAULT 'open' NOT NULL,
	"priority" "priority_enum" DEFAULT 'medium' NOT NULL,
	"creation_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_on" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_belonging_company_id_companies_id_fk" FOREIGN KEY ("belonging_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_company_idx" ON "tickets" USING btree ("belonging_company_id");--> statement-breakpoint
CREATE INDEX "tickets_state_idx" ON "tickets" USING btree ("ticketState");