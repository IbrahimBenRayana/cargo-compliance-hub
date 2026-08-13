-- Phase-5 shadow run: native wire + note alongside each CC submission.
ALTER TABLE "abi_documents" ADD COLUMN "native_wire_text" TEXT;
ALTER TABLE "abi_documents" ADD COLUMN "native_shadow_note" TEXT;
