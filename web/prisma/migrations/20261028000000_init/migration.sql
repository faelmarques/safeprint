-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "printerSlug" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "pages" JSONB NOT NULL,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "duplex" BOOLEAN NOT NULL DEFAULT false,
    "pagesPerSheet" INTEGER,
    "landscape" BOOLEAN,
    "sheets" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "discountCents" INTEGER,
    "couponCode" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "customerPhone" TEXT,
    "fileDataUrl" TEXT,
    "mpPaymentId" INTEGER,
    "mpStatus" TEXT,
    "mpQrBase64" TEXT,
    "mpCopyPaste" TEXT,
    "mpRefunded" BOOLEAN NOT NULL DEFAULT false,
    "fileKey" TEXT,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "motive" TEXT NOT NULL,
    "motiveLabel" TEXT NOT NULL,
    "description" TEXT,
    "name" TEXT,
    "whatsapp" TEXT,
    "photoDataUrl" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'online',
    "paperCurrent" INTEGER NOT NULL DEFAULT 0,
    "paperCapacity" INTEGER NOT NULL DEFAULT 0,
    "paperAlertAt" INTEGER NOT NULL DEFAULT 50,
    "tiers" JSONB NOT NULL,
    "colorAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrinterMeta" (
    "id" TEXT NOT NULL,
    "printerId" TEXT NOT NULL,
    "code" TEXT,
    "status" TEXT,
    "paperCapacity" INTEGER,
    "paperAlertAt" INTEGER,
    "tiers" JSONB,
    "name" TEXT,
    "location" TEXT,
    "address" TEXT,
    "lifetimeSheets" INTEGER,

    CONSTRAINT "PrinterMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tiers" JSONB NOT NULL,
    "promo" JSONB NOT NULL,
    "coupons" JSONB NOT NULL,
    "site" JSONB NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponUsed" (
    "code" TEXT NOT NULL,

    CONSTRAINT "CouponUsed_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "SecurityState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "passwordHash" TEXT,
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SecurityState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrinterMeta_printerId_key" ON "PrinterMeta"("printerId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

