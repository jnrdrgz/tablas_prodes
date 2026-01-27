-- CreateTable
CREATE TABLE "WhatsappInput" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "gameweekId" INTEGER,
    "rawText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappInput_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WhatsappInput" ADD CONSTRAINT "WhatsappInput_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
