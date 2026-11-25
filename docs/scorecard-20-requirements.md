# CyMetric KPI Scorecard — 20 development requirements

This checklist records **implementation on the draft GitHub branch**, not a claim
that production deployment or an Android APK has passed all acceptance tests.

| ID | Requirement | Implementation evidence | Acceptance test |
| --- | --- | --- | --- |
| KPI-001 | Remove duplicated/truncated heading | `apps/mobile/app/(app)/scorecard.tsx`, `TopBar.tsx` | On a narrow Android device, title reads 'KPI SCORECARD' once |
| KPI-002 | Display overall percentage | `dashboard.tsx`, `ScoreRing`, `/api/v1/scorecard` | 0–100 KPI score is visible once a response is submitted |
| KPI-003 | Consistent scoring | `apps/api/src/lib/scoring.ts`, `scorecard.ts` | Run catalogue and aggregation regression tests |
| KPI-004 | Category weights | `scorecard.tsx` + API `levelBreakdown.maxPossible` | Weights display and sum to about 100%, allowing rounding |
| KPI-005 | RED/AMBER/GREEN | `packages/types/src/enums.ts`, mobile colors | RED below 50, AMBER 50–79, GREEN 80–100 |
| KPI-006 | Completed/pending counts | `scorecard.tsx`, `levelBreakdown.answered/total` | N/A counts as answered, unanswered as pending |
| KPI-007 | Separate completeness/performance | `scorecard.tsx`, `dashboard.tsx`, `aggregate()` | Completion can be 100% with a low security score |
| KPI-008 | People/Process/Company scores | `aggregate()`, `LevelSummary` | All three match the weighted API calculation |
| KPI-009 | KPI-level recommendations | `apps/api/prisma/seed/suggestions.ts`, scorecard endpoint | Every low-scoring KPI returns its own suggestions |
| KPI-010 | Severity and priority labels | `scorecard.tsx`, suggestion priority/scoreRange fields | RED/AMBER and HIGH/MEDIUM text visible per action |
| KPI-011 | Assign action owner | `/api/v1/actions`, `ActionTracker`, `ImprovementAction` model | Admin assigns an existing organisation user |
| KPI-012 | Dates and progress | Same action API + tracker | Date and OPEN/IN_PROGRESS/COMPLETED persist across reload |
| KPI-013 | Evidence upload/validation | `evidence/browser-link`, `evidence/browser-upload`, R2 verification | File upload, MIME/size check, tenant/submitter restriction work |
| KPI-014 | ISO 27001:2022 mappings | `seed/kpi-data.json`, `framework-kpis.ts` | Framework view lists mapped KPI controls; review mappings with GRC |
| KPI-015 | Historical trends | `/api/v1/scorecard/history`, `analytics.tsx` | Two or more snapshots render a trend |
| KPI-016 | PDF and Excel reports | `report-export.ts`, `share/public/[token]/export` | Download PDF and XLSX, open both in common viewers |
| KPI-017 | Assessment/scoring history | `audit.ts`, `/api/v1/audit/assessments` | Admin sees response, score and action changes |
| KPI-018 | Responsive cards and layout | `scorecard.tsx`, `TopBar.tsx`, shared `Card` | Manual phone-size, font-scale, iOS and Android visual QA |
| KPI-019 | Score validation/missing answers | `scoring.ts`, submit endpoint, `aggregate()` | Invalid values rejected; missing and N/A treated separately |
| KPI-020 | Role-based security | `access.ts`, submit/N/A/action/audit/evidence routes | Employee cannot edit admin actions or inaccessible KPI levels |

## Release gate

1. GitHub Actions must pass **Prisma generation, all workspace TypeScript checks, API unit tests and Expo Android JS export**.
2. Review SQL migrations and perform a database backup; deploy them before using new actions API.
3. Run the updated KPI seed in staging after reviewing preservation of existing scored responses.
4. Validate ISO and NIST control mappings; mapping is not certification or a compliance audit.
5. Manually verify R2 evidence upload/download and PDF/XLSX exports against configured cloud services.
6. Verify action-owner assignment, privilege boundaries, audit retention, history trends and narrow-screen layouts with test accounts.
7. Only after the gate passes, merge the draft PR and create a fresh EAS Android build.

**Status:** Code implementation is present on the draft PR branch. Runtime and production acceptance remain gated by CI, migrations and device/end-to-end testing.
