CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"manager" varchar(255) NOT NULL,
	"phone" varchar(32),
	"license_date" timestamp with time zone NOT NULL,
	"web_service_source" varchar(255) NOT NULL,
	"web_service_username" varchar(255) NOT NULL,
	"server_name" varchar(255) NOT NULL,
	"period" integer NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"api_secret" varchar(255) NOT NULL,
	"creation_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_on" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "creationDate" TO "creation_date";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "updatedOn" TO "updated_on";