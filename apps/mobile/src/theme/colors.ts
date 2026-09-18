// Design tokens — imported by non-Tailwind call sites (SVG fills, gradients,
// status bars). Keep in sync with tailwind.config.js:theme.extend.colors.
//
// Futuristic/cyberpunk palette: deep navy background, neon cyan primary,
// electric magenta secondary. Score ramp stays green/amber/red for legibility.
export const colors = {
  bg: {
    base: '#05060d',
    surface: '#0b0f1d',
    card: '#0e1424',
    elevated: '#141b2e',
  },
  border: {
    subtle: '#1f2937',
    muted: '#374151',
  },
  text: {
    primary: '#f9fafb',
    secondary: '#9ca3af',
    muted: '#6b7280',
  },
  brand: {
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
  },
  // Neon accents for glows, highlights and active states.
  neon: {
    cyan: '#22d3ee',
    violet: '#a855f7',
    magenta: '#ec4899',
    lime: '#a3e635',
  },
  score: {
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
  },
} as const;

export type ScoreBand = 'GREEN' | 'AMBER' | 'RED';

export function scoreColor(band: ScoreBand): string {
  if (band === 'GREEN') return colors.score.green;
  if (band === 'AMBER') return colors.score.amber;
  return colors.score.red;
}

export function scoreColorForValue(score: number): string {
  if (score >= 75) return colors.score.green;
  if (score >= 50) return colors.score.amber;
  return colors.score.red;
}

// Drop-in iOS glow shadow. React Native shadows are opinionated: only iOS
// renders the cyan bloom we want. Android falls back to elevation which tints
// from elevation colour.
export function neonShadow(color = colors.neon.cyan, opacity = 0.6, radius = 20) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: 8,
  } as const;
}
