ALTER TABLE "current_definition" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "current_definition" ADD CONSTRAINT "singleton" CHECK ("current_definition"."id" = 1);