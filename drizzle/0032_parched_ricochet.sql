ALTER TABLE "current_definition" DROP CONSTRAINT "current_definition_definition_id_definitions_id_fk";
--> statement-breakpoint
ALTER TABLE "current_definition" ALTER COLUMN "definition_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "current_definition" ADD CONSTRAINT "current_definition_definition_id_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."definitions"("id") ON DELETE cascade ON UPDATE no action;