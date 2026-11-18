-- Integrasi Fonnte WhatsApp: pengaturan runtime + privasi log pengiriman.

-- CreateTable
CREATE TABLE "integration_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("key")
);

-- AlterTable
ALTER TABLE "whatsapp_message_logs" ADD COLUMN     "recipient_masked" TEXT,
ADD COLUMN     "recipient_hash" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "provider_process" TEXT;

-- Privasi: nomor penerima pada log lama dimasking (baris tetap tersimpan,
-- tidak ada data yang dihapus). Hash dipakai untuk dedup/anti-spam.
UPDATE "whatsapp_message_logs"
SET "recipient_masked" = CASE
        WHEN length("recipient_number") > 8 THEN left("recipient_number", 4) || '****' || right("recipient_number", 4)
        ELSE left("recipient_number", 2) || '****'
    END,
    "recipient_number" = CASE
        WHEN length("recipient_number") > 8 THEN left("recipient_number", 4) || '****' || right("recipient_number", 4)
        ELSE left("recipient_number", 2) || '****'
    END,
    "recipient_hash" = md5("recipient_number"),
    "provider" = COALESCE("provider", 'fonte');

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_recipient_hash_created_at_idx" ON "whatsapp_message_logs"("recipient_hash", "created_at");
