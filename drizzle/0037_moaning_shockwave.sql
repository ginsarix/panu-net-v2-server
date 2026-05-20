CREATE INDEX "event_logs_created_at_idx" ON "event_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "event_logs_resource_type_idx" ON "event_logs" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "event_logs_action_idx" ON "event_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "event_logs_status_idx" ON "event_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_logs_actor_id_idx" ON "event_logs" USING btree ("actor_id");