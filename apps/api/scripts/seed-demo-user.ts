import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// Plants a verified ENTERPRISE admin user for demos against the live cloud DB.
//
// ENTERPRISE (not SOLO) so the dashboard shows the Company Rollup banner
// with the MANAGE button. That banner gates on org.mode === ENTERPRISE
// AND user.role === ADMIN — see apps/mobile/app/(app)/dashboard.tsx.
// SOLO orgs deliberately hide the team management UI because there is no
// team to manage.
//
// Usage:
//   DATABASE_URL='...' npx tsx scripts/seed-demo-user.ts
//
// Idempotent — upserts by email. Re-running flips an existing SOLO demo
// org to ENTERPRISE (the `update` branch now sets mode too, not just the
// create branch).
async function main() {
  const prisma = new PrismaClient();

  const email = process.env.DEMO_EMAIL ?? 'saanvi.vishal@iiitb.ac.in';
  const password = process.env.DEMO_PASSWORD ?? 'cyberscore-demo-2026';
  const orgName = process.env.DEMO_ORG_NAME ?? 'IIIT Bangalore';
  const industry = process.env.DEMO_INDUSTRY ?? 'Banking';
  const name = process.env.DEMO_NAME ?? 'Saanvi Vishal';

  console.log(`Seeding demo user: ${email}`);

  const passwordHash = await argon2.hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  // Upsert the org. Email is unique on Organisation.
  // joinMode defaults to INVITE_ONLY (admin must explicitly invite each
  // employee). frameworkLocked is left false so the demo admin can still
  // switch frameworks from the Profile screen.
  const org = await prisma.organisation.upsert({
    where: { email },
    update: {
      orgName,
      industry,
      isVerified: true,
      passwordHash,
      mode: 'ENTERPRISE',
    },
    create: {
      email,
      orgName,
      industry,
      isVerified: true,
      passwordHash,
      selectedFramework: 'EXCEL',
      mode: 'ENTERPRISE',
    },
    select: { id: true },
  });

  // Upsert the admin user.
  await prisma.user.upsert({
    where: { email },
    update: {
      orgId: org.id,
      name,
      role: 'ADMIN',
      passwordHash,
      allowedLevels: ['PEOPLE', 'PROCESS', 'COMPANY'],
    },
    create: {
      orgId: org.id,
      email,
      name,
      role: 'ADMIN',
      passwordHash,
      allowedLevels: ['PEOPLE', 'PROCESS', 'COMPANY'],
    },
  });

  console.log(`✓ User ready. Login with:`);
  console.log(`    email:    ${email}`);
  console.log(`    password: ${password}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
