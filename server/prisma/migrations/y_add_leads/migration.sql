-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "form_source" VARCHAR(30) NOT NULL DEFAULT 'contact',
    "subject" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "company" VARCHAR(200),
    "message" TEXT,
    "persona" VARCHAR(30),
    "volume_band" VARCHAR(30),
    "files_today" VARCHAR(40),
    "filer_bond" VARCHAR(20),
    "country" VARCHAR(2),
    "ops_owner" VARCHAR(200),
    "route" VARCHAR(30),
    "step_reached" INTEGER NOT NULL DEFAULT 1,
    "booking_status" VARCHAR(20) NOT NULL DEFAULT 'requested',
    "src" VARCHAR(100),
    "utm_source" VARCHAR(100),
    "utm_medium" VARCHAR(100),
    "utm_campaign" VARCHAR(100),
    "utm_term" VARCHAR(100),
    "utm_content" VARCHAR(100),
    "landing_page" VARCHAR(500),
    "referrer_domain" VARCHAR(255),
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "notification_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "notification_attempts" INTEGER NOT NULL DEFAULT 0,
    "notification_error" VARCHAR(500),
    "notified_at" TIMESTAMPTZ,
    "confirmation_sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "leads_notification_status_created_at_idx" ON "leads"("notification_status", "created_at");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");
