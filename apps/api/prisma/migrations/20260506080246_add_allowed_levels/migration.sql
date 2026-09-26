-- AlterTable
ALTER TABLE "invites" ADD COLUMN     "allowedLevels" "Level"[] DEFAULT ARRAY['PEOPLE', 'PROCESS', 'COMPANY']::"Level"[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "allowedLevels" "Level"[] DEFAULT ARRAY['PEOPLE', 'PROCESS', 'COMPANY']::"Level"[];
