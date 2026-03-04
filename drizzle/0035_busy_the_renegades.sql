CREATE INDEX "ticket_messages_creationDate_idx" ON "ticket_messages" USING btree ("creation_date");--> statement-breakpoint
CREATE INDEX "tickets_user_idx" ON "tickets" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "tickets_priority_idx" ON "tickets" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "tickets_creation_date_idx" ON "tickets" USING btree ("creation_date" DESC NULLS LAST);