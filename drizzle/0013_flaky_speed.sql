CREATE TABLE "subscriptions_to_customers" (
	"subscription_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_to_customers_subscription_id_customer_id_pk" PRIMARY KEY("subscription_id","customer_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_user_id_subscription_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions_to_customers" ADD CONSTRAINT "subscriptions_to_customers_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions_to_customers" ADD CONSTRAINT "subscriptions_to_customers_customer_id_subscription_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."subscription_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_to_customers_subscription_id_idx" ON "subscriptions_to_customers" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_to_customers_customer_id_idx" ON "subscriptions_to_customers" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "user_id";