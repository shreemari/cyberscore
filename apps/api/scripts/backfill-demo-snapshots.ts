import { PrismaClient } from '@prisma/client';

// Backfill historical scorecard snapshots for the demo organisation so the
// Analytics screen has something to plot. The snapshot worker only writes
// a new row when a KPI is submitted (debounced per org), so a user who
// answers everything in one sitting ends up with one or zero historical
// rows and the trend chart has nothing to draw.
//
// This script inserts a sequence of progressively-increasing snapshots
// ending at the demo user's current score. The shape is meant to look
// like an honest improvement curve: a low starting point, a couple of
// mid-points, and the current value at the end.
//
// Usage:
//   DATABASE_URL='...' npx tsx scripts/backfill-demo-snapshots.ts
//
// Idempotent. Deletes existing snapshots for the org before inserting,
// so re-running re-syncs the curve without piling on duplicates.

async function main() {
  const prisma = new PrismaClient();

  const email = process.env.DEMO_EMAIL ?? 'saanvi.vishal@iiitb.ac.in';

  const org = await prisma.organisation.findUnique({
    where: { email },
    select: { id: true, orgName: true },
  });

  if (!org) {
    console.error(`No organisation found for email ${email}.`);
    console.error('Run scripts/seed-demo-user.ts first.');
    process.exit(1);
  }

  console.log(`Backfilling snapshots for org ${org.orgName} (${org.id})`);

  // Clear any existing snapshots for this org so re-running is safe.
  const deleted = await prisma.scorecardSnapshot.deleteMany({
    where: { orgId: org.id },
  });
  console.log(`  Cleared ${deleted.count} existing snapshot(s)`);

  // Build a six-point progress curve over the past month. Final point
  // is approximately the user's current scorecard values so the chart
  // ends at the right place.
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const curve = [
    { daysAgo: 30, people: 10, process: 18, company: 8, completeness: 22 },
    { daysAgo: 24, people: 18, process: 28, company: 14, completeness: 38 },
    { daysAgo: 18, people: 26, process: 38, company: 22, completeness: 55 },
    { daysAgo: 12, people: 32, process: 48, company: 30, completeness: 72 },
    { daysAgo: 5, people: 38, process: 56, company: 36, completeness: 90 },
    { daysAgo: 0, people: 42, process: 61.82, company: 41.04, completeness: 100 },
  ];

  for (const row of curve) {
    const overall = (row.people + row.process + row.company) / 3;
    const generatedAt = new Date(now - row.daysAgo * day);
    await prisma.scorecardSnapshot.create({
      data: {
        orgId: org.id,
        peopleScore: row.people,
        processScore: row.process,
        companyScore: row.company,
        overallScore: Number(overall.toFixed(2)),
        completeness: row.completeness,
        generatedAt,
      },
    });
    console.log(
      `  + ${generatedAt.toISOString().slice(0, 10)}  overall=${overall.toFixed(1).padStart(5)}` +
        `  people=${String(row.people).padStart(2)}` +
        `  process=${String(row.process).padStart(5)}` +
        `  company=${String(row.company).padStart(5)}`,
    );
  }

  console.log(`Done. ${curve.length} snapshots written for ${org.orgName}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
