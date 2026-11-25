import type { Prisma } from '@prisma/client';
import { Framework } from '@cymetric/types';

// The canonical 46 KPI records are stored once under EXCEL and annotated with
// NIST CSF / ISO 27001 controls. A framework selection is a *lens* over those
// records, not an instruction to query nonexistent framework-specific copies.
// Preserve separately authored framework KPIs where present.
export function frameworkKpiFilter(framework: Framework | null): Prisma.KpiWhereInput {
  switch (framework) {
    case Framework.EXCEL:
      return { frameworkCode: 'EXCEL' };
    case Framework.NIST_CSF:
      return {
        OR: [
          { frameworkCode: 'NIST_CSF' },
          { frameworkCode: 'EXCEL', nistControlIds: { isEmpty: false } },
        ],
      };
    case Framework.ISO27001:
      return {
        OR: [
          { frameworkCode: 'ISO27001' },
          { frameworkCode: 'EXCEL', isoControlIds: { isEmpty: false } },
        ],
      };
    default:
      return {};
  }
}
