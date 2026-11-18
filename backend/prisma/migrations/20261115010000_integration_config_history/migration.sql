-- Riwayat perubahan konfigurasi integrasi (audit).
-- Tidak menyimpan nilai rahasia: hanya NAMA field yang berubah.
CREATE TABLE "integration_config_history" (
    "id" TEXT NOT NULL,
    "config_type" TEXT NOT NULL,
    "provider" TEXT,
    "admin_id" TEXT,
    "admin_email" TEXT,
    "changed_fields" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_config_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integration_config_history_config_type_created_at_idx" ON "integration_config_history"("config_type", "created_at");
CREATE INDEX "integration_config_history_created_at_idx" ON "integration_config_history"("created_at");
