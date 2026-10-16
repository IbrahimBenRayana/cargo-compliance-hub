-- CreateTable
CREATE TABLE "cbp_transmissions" (
    "id" UUID NOT NULL,
    "org_id" UUID,
    "environment" VARCHAR(4) NOT NULL,
    "application" VARCHAR(2) NOT NULL,
    "action" VARCHAR(2),
    "entity_type" VARCHAR(32),
    "entity_id" UUID,
    "filer_code" VARCHAR(3) NOT NULL,
    "user_data_tag" VARCHAR(21) NOT NULL,
    "entry_number" VARCHAR(11),
    "isf_transaction_number" VARCHAR(15),
    "reference" VARCHAR(35),
    "wire_text" TEXT NOT NULL,
    "mq_message_id" VARCHAR(48),
    "status" VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMPTZ,
    "responded_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cbp_transmissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbp_inbound_messages" (
    "id" UUID NOT NULL,
    "environment" VARCHAR(4) NOT NULL,
    "mq_message_id" VARCHAR(48) NOT NULL,
    "raw_text" TEXT NOT NULL,
    "application" VARCHAR(2),
    "user_data_tag" VARCHAR(21),
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsed" JSONB,
    "parse_error" TEXT,
    "transmission_id" UUID,
    "matched_entity_type" VARCHAR(32),
    "matched_entity_id" UUID,
    "dispatched_at" TIMESTAMPTZ,

    CONSTRAINT "cbp_inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cbp_transmissions_user_data_tag_key" ON "cbp_transmissions"("user_data_tag");

-- CreateIndex
CREATE INDEX "cbp_transmissions_entity_type_entity_id_idx" ON "cbp_transmissions"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "cbp_transmissions_entry_number_idx" ON "cbp_transmissions"("entry_number");

-- CreateIndex
CREATE INDEX "cbp_transmissions_isf_transaction_number_idx" ON "cbp_transmissions"("isf_transaction_number");

-- CreateIndex
CREATE INDEX "cbp_transmissions_status_idx" ON "cbp_transmissions"("status");

-- CreateIndex
CREATE INDEX "cbp_inbound_messages_dispatched_at_idx" ON "cbp_inbound_messages"("dispatched_at");

-- CreateIndex
CREATE INDEX "cbp_inbound_messages_transmission_id_idx" ON "cbp_inbound_messages"("transmission_id");

-- CreateIndex
CREATE INDEX "cbp_inbound_messages_user_data_tag_idx" ON "cbp_inbound_messages"("user_data_tag");

-- CreateIndex
CREATE UNIQUE INDEX "cbp_inbound_messages_environment_mq_message_id_key" ON "cbp_inbound_messages"("environment", "mq_message_id");

-- AddForeignKey
ALTER TABLE "cbp_transmissions" ADD CONSTRAINT "cbp_transmissions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbp_inbound_messages" ADD CONSTRAINT "cbp_inbound_messages_transmission_id_fkey" FOREIGN KEY ("transmission_id") REFERENCES "cbp_transmissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Recordkeeping (19 CFR 163, audit BPR-02): what crossed the wire is
-- write-once and CBP traffic rows are never deleted. Status and correlation
-- columns stay updatable; the filed/received text and its identity do not.
CREATE OR REPLACE FUNCTION cbp_transmissions_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'cbp_transmissions rows are retained and cannot be deleted';
  END IF;
  IF NEW.wire_text IS DISTINCT FROM OLD.wire_text
    OR NEW.environment IS DISTINCT FROM OLD.environment
    OR NEW.user_data_tag IS DISTINCT FROM OLD.user_data_tag
    OR NEW.filer_code IS DISTINCT FROM OLD.filer_code
    OR NEW.application IS DISTINCT FROM OLD.application THEN
    RAISE EXCEPTION 'cbp_transmissions: the transmitted wire and its identity are write-once';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cbp_inbound_messages_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'cbp_inbound_messages rows are retained and cannot be deleted';
  END IF;
  IF NEW.raw_text IS DISTINCT FROM OLD.raw_text
    OR NEW.environment IS DISTINCT FROM OLD.environment
    OR NEW.mq_message_id IS DISTINCT FROM OLD.mq_message_id
    OR NEW.received_at IS DISTINCT FROM OLD.received_at THEN
    RAISE EXCEPTION 'cbp_inbound_messages: the received message and its identity are write-once';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cbp_transmissions_immutable
  BEFORE UPDATE OR DELETE ON "cbp_transmissions"
  FOR EACH ROW EXECUTE FUNCTION cbp_transmissions_immutable();

CREATE TRIGGER cbp_inbound_messages_immutable
  BEFORE UPDATE OR DELETE ON "cbp_inbound_messages"
  FOR EACH ROW EXECUTE FUNCTION cbp_inbound_messages_immutable();
