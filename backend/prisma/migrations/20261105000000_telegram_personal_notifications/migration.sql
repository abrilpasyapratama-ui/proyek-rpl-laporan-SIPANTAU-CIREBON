-- CreateEnum
CREATE TYPE "TelegramConnectionStatus" AS ENUM ('DISCONNECTED', 'PENDING', 'CONNECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telegram_chat_id" TEXT,
ADD COLUMN     "telegram_connected_at" TIMESTAMP(3),
ADD COLUMN     "telegram_status" "TelegramConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED';

-- CreateTable
CREATE TABLE "telegram_link_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_message_logs" (
    "id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "user_id" TEXT,
    "report_id" TEXT,
    "chat_id_masked" TEXT NOT NULL,
    "message_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "telegram_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_link_codes_code_hash_key" ON "telegram_link_codes"("code_hash");

-- CreateIndex
CREATE INDEX "telegram_link_codes_user_id_used_at_idx" ON "telegram_link_codes"("user_id", "used_at");

-- CreateIndex
CREATE INDEX "telegram_link_codes_expires_at_idx" ON "telegram_link_codes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_message_logs_event_key_key" ON "telegram_message_logs"("event_key");

-- CreateIndex
CREATE INDEX "telegram_message_logs_user_id_created_at_idx" ON "telegram_message_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "telegram_message_logs_report_id_created_at_idx" ON "telegram_message_logs"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "telegram_message_logs_status_idx" ON "telegram_message_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_chat_id_key" ON "users"("telegram_chat_id");

-- AddForeignKey
ALTER TABLE "telegram_link_codes" ADD CONSTRAINT "telegram_link_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_message_logs" ADD CONSTRAINT "telegram_message_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
