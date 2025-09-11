ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_user_id_subscription_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_subscription_customers_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."subscription_customers"("id") ON DELETE cascade ON UPDATE no action;