-- AlterTable
ALTER TABLE "Match" ADD COLUMN "espnEventId" TEXT,
ADD COLUMN "espnDate" TEXT;

-- CreateIndex
CREATE INDEX "Match_espnEventId_idx" ON "Match"("espnEventId");
