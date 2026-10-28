-- Adiciona coluna de storage S3/R2 (key do objeto; null = legacy base64 em fileDataUrl)
ALTER TABLE "Job" ADD COLUMN "fileKey" TEXT;
