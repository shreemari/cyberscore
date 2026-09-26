import { notFound } from 'next/navigation';
import { resolvePublicShare } from '@/lib/share';

export const dynamic = 'force-dynamic';

// Public HTML landing for a shared scorecard. Targets of the shareUrl from
// POST /api/v1/share — vendors, insurers, board members opening the OS
// share-sheet link. Read-only, no auth, no analytics beyond the per-token
// view counter bumped inside resolvePublicShare.

const BAND_COLOR = {
  GREEN: '#16a34a',
  AMBER: '#f59e0b',
  RED: '#dc2626',
} as const;

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await resolvePublicShare(token);
  if (!data) notFound();

  const bandColor = BAND_COLOR[data.colorBand];
  const expiresDate = new Date(data.expiresAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <header style={styles.header}>
          <div style={styles.brand}>CyMetric</div>
          <div style={styles.shared}>Shared Scorecard</div>
        </header>

        <h1 style={styles.org}>{data.orgName}</h1>
        {data.industry && <div style={styles.industry}>{data.industry}</div>}

        <div style={styles.ringWrap}>
          <div style={{ ...styles.ring, borderColor: bandColor }}>
            <div style={{ ...styles.ringValue, color: bandColor }}>
              {Math.round(data.overallScore)}
            </div>
            <div style={styles.ringLabel}>overall</div>
          </div>
        </div>

        <div style={styles.levels}>
          <LevelRow name="People" data={data.levelBreakdown.people} />
          <LevelRow name="Process" data={data.levelBreakdown.process} />
          <LevelRow name="Company" data={data.levelBreakdown.company} />
        </div>

        <footer style={styles.footer}>
          <div>Completeness: {Math.round(data.completeness)}%</div>
          <div>Link expires {expiresDate}</div>
        </footer>
      </div>
    </main>
  );
}

function LevelRow({
  name,
  data,
}: {
  name: string;
  data: {
    score: number;
    answered: number;
    total: number;
    colorBand: 'GREEN' | 'AMBER' | 'RED';
  };
}) {
  const color = BAND_COLOR[data.colorBand];
  return (
    <div style={styles.levelRow}>
      <div style={styles.levelHeader}>
        <span style={styles.levelName}>{name}</span>
        <span style={{ ...styles.levelScore, color }}>
          {Math.round(data.score)}
        </span>
      </div>
      <div style={styles.bar}>
        <div
          style={{
            ...styles.barFill,
            width: `${Math.min(data.score, 100)}%`,
            background: color,
          }}
        />
      </div>
      <div style={styles.levelMeta}>
        {data.answered}/{data.total} KPIs answered
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg,#0a0a0f 0%,#0f1420 100%)',
    color: '#e2e8f0',
    fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
    padding: '32px 16px',
    display: 'flex',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    background: 'rgba(15,20,32,0.8)',
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 20,
    padding: '32px 28px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  brand: {
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: 800,
    color: '#38bdf8',
  },
  shared: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#64748b',
    textTransform: 'uppercase' as const,
  },
  org: {
    fontSize: 28,
    fontWeight: 800,
    margin: '0 0 4px 0',
    color: '#f1f5f9',
  },
  industry: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 28,
    textTransform: 'capitalize' as const,
  },
  ringWrap: {
    display: 'flex',
    justifyContent: 'center',
    margin: '12px 0 32px 0',
  },
  ring: {
    width: 180,
    height: 180,
    borderRadius: '50%',
    border: '10px solid',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 56,
    fontWeight: 800,
    lineHeight: 1,
  },
  ringLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    marginTop: 6,
  },
  levels: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 18,
    marginBottom: 24,
  },
  levelRow: {},
  levelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  levelName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#cbd5e1',
  },
  levelScore: {
    fontSize: 18,
    fontWeight: 800,
  },
  bar: {
    height: 6,
    background: 'rgba(148,163,184,0.15)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 300ms ease',
  },
  levelMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    color: '#64748b',
    borderTop: '1px solid rgba(148,163,184,0.15)',
    paddingTop: 16,
  },
};
