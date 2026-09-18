// Maps backend Framework enum codes to user-facing labels.
// The backend still uses 'EXCEL' for historical reasons (it was the default
// KPI workbook) — we don't rename the enum to avoid a migration, but every
// user-facing surface should go through `frameworkLabel`.
export type FrameworkCode = 'EXCEL' | 'NIST_CSF' | 'ISO27001';

export const FRAMEWORKS: Array<{
  code: FrameworkCode;
  label: string;
  description: string;
}> = [
  {
    code: 'EXCEL',
    label: 'KPI Scorecard',
    description: 'Default 46-KPI baseline — recommended for first-time assessments',
  },
  {
    code: 'NIST_CSF',
    label: 'NIST CSF',
    description: 'NIST Cybersecurity Framework — Identify / Protect / Detect / Respond / Recover',
  },
  {
    code: 'ISO27001',
    label: 'ISO 27001',
    description: 'Information-security management controls (Annex A)',
  },
];

export function frameworkLabel(code: string | null | undefined): string {
  if (!code) return '—';
  const match = FRAMEWORKS.find((f) => f.code === code);
  return match?.label ?? code;
}
