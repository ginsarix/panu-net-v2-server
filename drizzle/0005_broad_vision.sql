ALTER TABLE "companies" ALTER COLUMN "updated_on" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "updated_on" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_on" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_on" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_customers" ADD COLUMN "updated_on" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "updated_on" timestamp with time zone;