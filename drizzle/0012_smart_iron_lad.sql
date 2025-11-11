CREATE TABLE "page_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"page_path" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_on" timestamp with time zone,
	CONSTRAINT "page_roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users_to_page_roles" (
	"user_id" integer NOT NULL,
	"page_role_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_to_page_roles_user_id_page_role_id_pk" PRIMARY KEY("user_id","page_role_id")
);
--> statement-breakpoint
ALTER TABLE "users_to_page_roles" ADD CONSTRAINT "users_to_page_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_to_page_roles" ADD CONSTRAINT "users_to_page_roles_page_role_id_page_roles_id_fk" FOREIGN KEY ("page_role_id") REFERENCES "public"."page_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "page_roles_key_idx" ON "page_roles" USING btree ("key");--> statement-breakpoint
CREATE INDEX "page_roles_page_path_idx" ON "page_roles" USING btree ("page_path");--> statement-breakpoint
CREATE INDEX "users_to_page_roles_user_id_idx" ON "users_to_page_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_to_page_roles_page_role_id_idx" ON "users_to_page_roles" USING btree ("page_role_id");