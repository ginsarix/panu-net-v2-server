CREATE TYPE "public"."subscription_type" AS ENUM('domain', 'ssl', 'hosting', 'mail');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"manager" varchar(255) NOT NULL,
	"phone" varchar(32),
	"license_date" timestamp with time zone NOT NULL,
	"status" boolean NOT NULL,
	"web_service_source" varchar(255) NOT NULL,
	"web_service_username" varchar(255) NOT NULL,
	"server_name" varchar(255) NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"api_secret" varchar(255) NOT NULL,
	"creation_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_on" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_code" integer,
	"title" varchar(255) NOT NULL,
	"phone" varchar(32),
	"email" varchar(255) NOT NULL,
	"address" varchar(255),
	"status" boolean NOT NULL,
	"manager" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"subscriptionType" "subscription_type",
	"user_id" integer NOT NULL,
	"creation_date" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_to_companies" (
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_to_companies_user_id_company_id_pk" PRIMARY KEY("user_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(32),
	"password" varchar(255) NOT NULL,
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"creation_date" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_on" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users_to_companies" ADD CONSTRAINT "users_to_companies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_to_companies" ADD CONSTRAINT "users_to_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;