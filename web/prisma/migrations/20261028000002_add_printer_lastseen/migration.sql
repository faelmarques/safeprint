-- Adiciona lastSeenAt (heartbeat do Pi) em Printer
ALTER TABLE "Printer" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
