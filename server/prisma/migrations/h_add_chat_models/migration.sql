-- AI Assistant / Live Chat. Conversations from the floating chat widget on both
-- the app (signed-in users, org/user set) and the marketing site (anonymous
-- visitors, identified by an HMAC-signed visitor_id). Realtime fan-out rides
-- Postgres LISTEN/NOTIFY (services/chat/chatStream.ts) — no event table needed.
-- Idempotent so re-runs in any environment are safe.

CREATE TABLE IF NOT EXISTS "chat_conversations" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "org_id"            UUID,
  "user_id"           UUID,
  "surface"           VARCHAR(12)  NOT NULL,
  "mode"              VARCHAR(16)  NOT NULL DEFAULT 'ai',
  "status"            VARCHAR(16)  NOT NULL DEFAULT 'open',
  "visitor_id"        VARCHAR(64),
  "visitor_name"      VARCHAR(120),
  "visitor_email"     VARCHAR(255),
  "assigned_agent_id" UUID,
  "escalation_reason" VARCHAR(500),
  "last_message_at"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "escalated_at"      TIMESTAMPTZ,
  "resolved_at"       TIMESTAMPTZ,
  "ip_hash"           VARCHAR(64),
  "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID         NOT NULL,
  "role"            VARCHAR(12)  NOT NULL,
  "content"         TEXT         NOT NULL,
  "tool_name"       VARCHAR(64),
  "metadata"        JSONB,
  "agent_id"        UUID,
  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (Prisma onDelete: Cascade / SetNull semantics).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_org_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_org_id_fkey"
      FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_user_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_assigned_agent_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_assigned_agent_id_fkey"
      FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_conversation_id_fkey'
  ) THEN
    ALTER TABLE "chat_messages"
      ADD CONSTRAINT "chat_messages_conversation_id_fkey"
      FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "chat_conversations_mode_status_last_message_at_idx" ON "chat_conversations" ("mode", "status", "last_message_at" DESC);
CREATE INDEX IF NOT EXISTS "chat_conversations_user_id_created_at_idx"          ON "chat_conversations" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "chat_conversations_visitor_id_idx"                  ON "chat_conversations" ("visitor_id");
CREATE INDEX IF NOT EXISTS "chat_conversations_assigned_agent_id_status_idx"    ON "chat_conversations" ("assigned_agent_id", "status");
CREATE INDEX IF NOT EXISTS "chat_messages_conversation_id_created_at_idx"       ON "chat_messages" ("conversation_id", "created_at");
