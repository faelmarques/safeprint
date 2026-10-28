-- Adiciona lastSeenAt (heartbeat do Pi) em Printer
ALTER TABLE "Printer" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
