# CyMetric Scorecard — 20 development requirements

This checklist covers the **20 development requirements KPI-001 through KPI-020**, not the separate catalogue of **46 cybersecurity assessment KPIs**.

| ID | Requirement | Implementation in this branch | Validation |
|---|---|---|---|
| KPI-001 | Fix duplicate/truncated heading | `apps/mobile/app/(app)/scorecard.tsx` uses a concise Scorecard top bar | Device visual QA required |
| KPI-002 | Display overall KPI score percentage | Score ring and dashboard show performance percentage | Device visual QA required |
| KPI-003 | Consistent KPI scoring | `apps/api/src/lib/scoring.ts`, `scorecard.ts`, 46-KPI catalogue regression tests | Automated CI still required |
| KPI-004 | Category scoring weights | Scorecard People/Process/Company cards show maximum-weighted-point shares | Validate with sample assessments |
| KPI-005 | RED/AMBER/GREEN thresholds | Shared >=80 GREEN, >=50 AMBER, otherwise RED | Regression coverage added |
| KPI-006 | Completed and pending assessment counts | Category and overall Scorecard cards | Device visual QA required |
| KPI-007 | Completeness separate from performance | Scorecard + dashboard copy and independent values | Regression coverage added |
| KPI-008 | People/Process/Company scores | Weighted aggregate per category and cards | Regression coverage added |
| KPI-009 | Result-based recommendations | Specific RED and AMBER suggestions for all 46 canonical KPIs | Catalogue static check completed |
| KPI-010 | Priority and severity | Recommendation entries show HIGH/MEDIUM priority and RED/AMBER severity | Device visual QA required |
| KPI-011 | Assign action owner | `improvement_actions` model + `/api/v1/actions` + Scorecard edit view | DB migration + integration QA required |
| KPI-012 | Target date and progress tracking | Due date, OPEN/IN_PROGRESS/COMPLETED, notes, completedAt | DB migration + integration QA required |
| KPI-013 | Evidence uploads and validation | Signed browser upload link, storage presign, R2 HEAD validation, own-answer check, audit entry | R2 credentials/CORS and Android integration QA required |
| KPI-014 | ISO 27001:2022 mapping | Canonical control IDs and framework lens filter | Proposed mappings require compliance approval |
| KPI-015 | History/trends | Existing snapshot history API and mobile analytics chart | Data-backed QA required |
| KPI-016 | PDF/Excel reports | Authenticated detailed PDF/XLSX API plus short-lived public summary PDF/XLSX mobile browser downloads | Download and document-opening QA required |
| KPI-017 | Change history | Audit records for KPI submission/N/A, score calculation, action edits and evidence; restricted mobile history | Audit persistence QA required |
| KPI-018 | Responsive card/layout | Shorter heading and adjusted scorecard information hierarchy | Android small-screen visual QA required |
| KPI-019 | Score-range/missing-answer validation | Exclusive tier boundaries, negative penalties, 0–100 API validation, pending/N/A handling | Catalogue static check passed; CI required |
| KPI-020 | Role-based assessment/results access | Existing access gates; corrective-action reads scoped to permitted levels and admin-only edits/audit | Access-control integration testing required |

## Database deployment

Apply `apps/api/prisma/migrations/20261125120000_improvement_action_tracking/migration.sql` via the existing migration pipeline **after backing up the database**. Do not run the seed directly on production without reconciling existing responses against changed tier boundaries.

## Mobile evidence upload

The assessment question screen now lets a user save the selected answer and launch a browser-based file picker. The signed link expires after five minutes. R2 must allow the web app origin to PUT evidence via CORS. Server confirmation checks the uploaded object with HEAD before linking it.

## Reports

The export API `GET /api/v1/reports/export?framework=EXCEL&format=pdf|xlsx` requires an authenticated bearer token and includes **per-KPI** results and action metadata. Mobile buttons use expiring share-token URLs and export **summary-only** data to avoid putting access tokens in browser URLs. Both outputs are actual PDF / Office Open XML workbook formats.

## Release checklist

1. CI must pass `npm ci`, Prisma client generation, workspace typecheck and all Vitest tests.
2. Run Android Metro export and EAS build; test file picker and all 20 screens/flows on a device.
3. Back up and migrate the database; verify RLS and action assignment permissions.
4. Verify real R2 uploads, object HEAD validation and storage CORS.
5. Validate NIST and ISO mapping choices with security/compliance owners.
6. Perform staging smoke tests with SOLO, ENTERPRISE ADMIN and ENTERPRISE EMPLOYEE users.
7. Review and merge the **draft PR** only after these checks pass.
