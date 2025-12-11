CREATE TABLE "definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) DEFAULT 'Tanım' NOT NULL,
	"social_links" jsonb DEFAULT '{"facebook":true,"facebookLink":"https://www.facebook.com/panuteknolojii/","twitter":true,"twitterLink":"https://twitter.com/panuteknoloji","linkedin":true,"linkedinLink":"https://www.linkedin.com/company/panu-teknoloji-ltd-sti/?originalSubdomain=tr","instagram":true,"instagramLink":"https://www.instagram.com/panuteknoloji/?hl=tr","youtube":true,"youtubeLink":"https://www.youtube.com/channel/UCy1M15JA5g_zMuBh_-fu5mw"}'::jsonb NOT NULL,
	"payment_link" varchar(2048) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
