CREATE INDEX "companies_code_idx" ON "companies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "companies_status_idx" ON "companies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "users_to_companies_user_id_idx" ON "users_to_companies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_to_companies_company_id_idx" ON "users_to_companies" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_last_login_idx" ON "users" USING btree ("last_login_at");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_code_unique" UNIQUE("code");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");