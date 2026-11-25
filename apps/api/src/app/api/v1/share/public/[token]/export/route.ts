import { NextResponse } from 'next/server';
import { resolvePublicShare } from '@/lib/share';
import { pdfReport, xlsxReport, type ReportTable } from '@/lib/report-export';

// A share token explicitly grants access to the *summary* scorecard only.
// Detailed KPI answers / action ownership are never exposed here.
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const format = new URL(req.url).searchParams.get('format');
  if (format !== 'pdf' && format !== 'xlsx') {
    return NextResponse.json({ error: 'Use pdf or xlsx' }, { status: 400 });
  }
  const { token } = await params;
  const payload = await resolvePublicShare(token);
  if (!payload) return NextResponse.json({ error: 'Link expired or invalid' }, { status: 404 });
  const table: ReportTable = {
    title: `CyMetric Shared KPI Scorecard - ${payload.orgName} - ${new Date().toISOString().slice(0, 10)}`,
    columns: ['Category', 'Performance %', 'Completed', 'Pending', 'Status'],
    rows: [
      ...([
        ['People', payload.levelBreakdown.people],
        ['Process', payload.levelBreakdown.process],
        ['Company', payload.levelBreakdown.company],
      ] as const).map(([name, stats]) => [
        name, stats.score, stats.answered, stats.total - stats.answered, stats.colorBand,
      ]),
      ['Overall', payload.overallScore, payload.completeness, '', payload.colorBand],
    ],
  };
  const report = format === 'pdf' ? pdfReport(table) : xlsxReport(table);
  return new Response(new Uint8Array(report), {
    headers: {
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="CyMetric-Scorecard.${format}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
