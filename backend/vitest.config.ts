import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      AI_MOCK_DELAY_MS: '0',
      JWT_SECRET: 'test-secret-key',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      TELEGRAM_ENABLED: 'true',
      TELEGRAM_BOT_TOKEN: '123456789:TESTTOKENabcdefghijklmnopqrstuvwxyz',
      TELEGRAM_ADMIN_CHAT_ID: '999999999',
      TELEGRAM_BOT_USERNAME: 'SipantauTestBot',
      TELEGRAM_WEBHOOK_SECRET: 'test-telegram-webhook-secret',
      TELEGRAM_LINK_CODE_TTL_MINUTES: '15',
      TELEGRAM_MAX_LINK_ATTEMPTS: '5',
    },
    include: ['tests/**/*.test.ts'],
  },
});
