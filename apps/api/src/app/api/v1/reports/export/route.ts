import { NextResponse } from 'next/server';
import { Framework, OrgMode, Role } from '@cymetric/types';
import { withTenant } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-auth';
import { internalError } from '@/lib/problem';
import { aggregate, loadScorecardInputs } from '@/lib/scorecard';
import { effectiveAllowedLevels } from '@/lib/access';
import { pdfReport, xlsxReport, type ReportTable } from '@/lib/report-export';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = requireAuth(req);
  if ('response' in auth) return auth.response;
  const url = new URL(req.url);
  const format = url.searchParams.get('format');
  const framework = url.searchParams.get('framework') ?? Framework.EXCEL;
  if (format !== 'pdf' && format !== 'xlsx') {
    return NextResponse.json({ error: 'Supported formats: pdf, xlsx' }, { status: 400 });
  }
  if (!Object.values(Framework).includes(framework as Framework)) {
    return NextResponse.json({ error: 'Invalid framework' }, { status: 400 });
  }
  try {
    const result = await withTenant(auth.orgId, async tx => {
      const caller = await tx.user.findUnique({
        where: { id: auth.userId },
        select: { role: true, allowedLevels: true, org: { select: { mode: true, orgName: true } } },
      });
      if (!caller) return null;
      const { kpis, responses } = await loadScorecardInputs(tx, auth.orgId, framework as Framework);
      const personal = caller.org.mode === OrgMode.ENTERPRISE && caller.role !== Role.ADMIN;
      const allowed = new Set(effectiveAllowedLevels({
        role: caller.role, allowedLevels: caller.allowedLevels, orgMode: caller.org.mode,
      }));
      const scopedKpis = personal ? kpis.filter(k => allowed.has(k.level)) : kpis;
      const scopedResponses = personal && scopedKpis.length
        ? await tx.response.findMany({
          where: { orgId: auth.orgId, submittedById: auth.userId, kpiId: { in: scopedKpis.map(k => k.id) } },
          select: { kpiId: true, actualScore: true, weightedScore: true, isNa: true },
        })
        : personal ? [] : responses;
      const actionRows = await tx.improvementAction.findMany({
        where: { orgId: auth.orgId, kpiId: { in: scopedKpis.map(k => k.id) } },
        include: { owner: { select: { name: true } } },
      });
      return { name: caller.org.orgName, kpis: scopedKpis, responses: scopedResponses, actionRows };
    });
    if (!result) return NextResponse.json({ error: 'Account not found' }, { status: 401 });
    const scorecard = aggregate(result.kpis, result.responses);
    const byResponse = new Map(result.responses.map(row => [row.kpiId, row]));
    const byAction = new Map(result.actionRows.map(row => [row.kpiId, row]));
    const table: ReportTable = {
      title: `CyMetric KPI Scorecard - ${result.name} - ${framework} - ${new Date().toISOString().slice(0, 10)} - Score ${scorecard.overallScore}% - Completed ${scorecard.completeness}%`,
      columns: ['Category', 'KPI', 'Score %', 'Assessment', 'Action owner', 'Target date', 'Action status'],
      rows: result.kpis.map(kpi => {
        const response = byResponse.get(kpi.id);
        const action = byAction.get(kpi.id);
        return [
          kpi.level,
          kpi.kpiName,
          response && !response.isNa ? Math.max(0, Math.min(100, Math.round(response.actualScore / kpi.maxScore * 10000) / 100)) : null,
          !response ? 'PENDING' : response.isNa ? 'N/A' : 'COMPLETED',
          action?.owner?.name ?? '',
          action?.dueDate?.toISOString().slice(0, 10) ?? '',
          action?.status ?? 'OPEN',
        ];
      }),
    };
    const body = format === 'pdf' ? pdfReport(table) : xlsxReport(table);
    const mime = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const fileName = `CyMetric-${framework}-${new Date().toISOString().slice(0, 10)}.${format}`;
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return internalError(err, { route: 'report:export' });
  }
}
