import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

async function main() {
  const email = process.argv[2];
  const code = process.argv[3] ?? '123456';

  if (!email) {
    console.error('Usage: tsx scripts/set-dev-otp.ts <email> [code]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const otpHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const updated = await prisma.otpVerification.updateMany({
    where: { email: email.toLowerCase(), used: false, purpose: 'REGISTER' },
    data: { otpHash, expiresAt, attempts: 0 },
  });

  if (updated.count === 0) {
    await prisma.otpVerification.create({
      data: { email: email.toLowerCase(), otpHash, purpose: 'REGISTER', expiresAt },
    });
    console.log(`Created new OTP row for ${email}: ${code}`);
  } else {
    console.log(`Updated ${updated.count} OTP row(s) for ${email}: ${code}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
