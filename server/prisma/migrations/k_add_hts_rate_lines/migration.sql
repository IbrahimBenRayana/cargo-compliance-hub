-- ABI engine refdata: USITC HTS rate lines (workstream F).
CREATE TABLE "hts_rate_lines" (
    "hts_number" VARCHAR(10) NOT NULL,
    "description" TEXT NOT NULL,
    "indent" INTEGER NOT NULL,
    "is_rate_line" BOOLEAN NOT NULL,
    "general_rate" TEXT NOT NULL,
    "special_rate" TEXT NOT NULL,
    "other_rate" TEXT NOT NULL,
    "units" TEXT[],
    "revision" VARCHAR(40) NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hts_rate_lines_pkey" PRIMARY KEY ("hts_number")
);
