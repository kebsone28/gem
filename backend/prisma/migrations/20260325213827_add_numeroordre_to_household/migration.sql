-- AddColumn
ALTER TABLE "Household" ADD COLUMN "numeroordre" TEXT UNIQUE;

-- CreateIndex
CREATE INDEX "Household_numeroordre_idx" on "Household"("numeroordre");
