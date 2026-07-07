CREATE INDEX "contracts_company_id_idx" ON "contracts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "subscription_customers_title_idx" ON "subscription_customers" USING btree ("title");--> statement-breakpoint
CREATE INDEX "subscriptions_end_date_idx" ON "subscriptions" USING btree ("end_date");