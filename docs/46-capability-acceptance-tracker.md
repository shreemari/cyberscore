# CyMetric — 46 capability requirements acceptance tracker

**Source:** 49-item original CyMetric capability-gap report (`CyMetric_49_Capability_Requirements_Details.md`). Items 1–46 are the requested scope. Items 47–49 are additional capabilities.

**Meaning:** Code updated ≠ tested, deployed, or accepted. `Needs verification` means implementation or part of implementation exists, but release evidence is missing.

| # | Capability | Original classification | Current status | Remaining work / evidence |
|---:|---|---|---|---|
| 1 | 46-KPI catalogue | Implement new - required | Partial | 46 existing KPI records present; independent New_KPIs workbook comparison not yet done |
| 2 | Tier scoring engine | Fix existing | Code updated, unverified | Scoring tier data and validation corrected for 46 KPIs, 212 options; CI pending |
| 3 | 'Unknown / not sure' handling | Fix existing | Partial | Unknown choices now score zero; separate unknown quality flag missing |
| 4 | Critical-control gating | Implement new - required | Not completed | Must-pass gates cap the band at AMBER/RED (S05) |
| 5 | Risk-based weights and CSF-function (domain) view | Implement new - required | Partial | Scorecard category weights displayed; CSF function risk weighting missing |
| 6 | Measure metadata (owner, source, frequency, target, formula) | Implement new - required | Not completed | Add fields to Kpi model and show in app (S13; NIST SP 800-55 Vol.2) |
| 7 | Evidence-linked answers, as-of date and expiry | Implement new - required | Partial | R2 evidence flow present; expiry/attestation missing |
| 8 | Maturity levels and Current vs Target Profile | Good to have | Not completed | Map score to CSF Tiers/CMMI-style level; target profile per org (S09) |
| 9 | Automated measurement (EDR, IdP, scanner, CSPM, SIEM connectors) | Good to have | Not completed — external/infrastructure | Pull evidence-grade values instead of self-reporting; start with IdP (MFA) and vulnerability scanner |
| 10 | Framework selection (EXCEL / NIST_CSF / ISO27001) | Keep as is | Partial | Keep |
| 11 | NIST CSF and ISO 27001 catalogues | Implement new - required | Code updated, unverified | Framework lenses implemented for ISO and NIST (mapped KPI view) |
| 12 | Per-framework progress and scorecards | Fix existing | Partial | Progress and scorecard framework paths updated; integration tests pending |
| 13 | Control-ID mapping integrity | Fix existing | Partial | Missing mappings populated, official full mapping validator missing |
| 14 | CIS v8.1, SOC 2 TSC, DPDP mapping lenses | Good to have | Not completed | Add CIS IG1-3 view and SOC 2 criteria view (useful for FISST audit work) |
| 15 | Compliance report templates (roadmap M4) | Good to have | Not completed | Generate filled SOC 2 / ISO / NIST checklists from the scorecard |
| 16 | Risk register, treatment plans, risk acceptance and exceptions | Implement new - required | Not completed | New module; basis for ISO clause 6.1.2 and CSF GV.RM / ID.RA |
| 17 | Remediation action tracker (owner, due date, status) | Implement new - required | Code updated, unverified | Action owner/deadline/status UI/API added; deployment unverified |
| 18 | Policy and legal/contractual obligations registers | Good to have | Not completed | Registers with review dates and control links |
| 19 | Board / executive reporting pack (PDF export, roadmap F2) | Implement new - required | Partial | Summary PDF/XLSX exports implemented; full board pack missing |
| 20 | Platform admin vs organisation admin separation | Fix existing | Code updated, unverified | Cross-org routes restricted to PLATFORM_ADMIN_USER_IDS allow-list; production configuration needed |
| 21 | Impersonation controls | Fix existing | Not completed — external/infrastructure | Audit trail, short expiry, reason, customer consent, revocation |
| 22 | Tenant isolation (RLS) verification | Fix existing | Partial | RLS SQL exists; real-role tenant isolation tests missing |
| 23 | Refresh-token handling | Fix existing | Not completed — external/infrastructure | Indexed hash lookup, per-user scope, rotation with reuse detection |
| 24 | Public share-link lookup | Fix existing | Not completed — external/infrastructure | Prefix-indexed token lookup and rate limit |
| 25 | Login hardening | Fix existing | Not completed — external/infrastructure | Per-account lockout, uniform timing, mandatory MFA for admins |
| 26 | CORS policy | Fix existing | Code updated, unverified | CORS allow-list added to middleware; CORS_ALLOWED_ORIGINS requires setup |
| 27 | Access-token revocation and role re-check | Implement new - required | Not completed — external/infrastructure | Session/jti store for revocation, esp. impersonation tokens |
| 28 | Evidence upload integrity | Fix existing | Partial | R2 HEAD/MIME/size verification added; malware scan remains |
| 29 | Dependency and secret hygiene | Fix existing | Partial | Update vulnerable production dependencies, pin versions, rotate demo account, clean README |
| 30 | SSO (OIDC/SAML) (roadmap M1) | Good to have | Not completed — external/infrastructure | Enterprise requirement; WorkOS/Auth0 fastest |
| 31 | API keys and webhooks (roadmap M5, M6) | Good to have | Not completed — external/infrastructure | Implement with HMAC signing, scopes, rotation |
| 32 | Audit log export / tamper evidence | Good to have | Not completed | Export to storage, hash chaining |
| 33 | Automated tests | Implement new - required | Partial | KPI catalogue and scorecard unit tests added, auth coverage incomplete |
| 34 | CI/CD (lint, typecheck, test, npm audit, migrate) | Implement new - required | Partial | GitHub Actions checks added, pass status not yet confirmed |
| 35 | Staging environment and migration discipline | Implement new - required | Not completed — external/infrastructure | Neon staging branch; migrate there first |
| 36 | Observability | Implement new - required | Partial | Enable Sentry, structured logs, uptime and error alerts |
| 37 | Background workers (snapshots, PDF, push, abandonment) | Fix existing | Partial | Run via scheduled functions or a worker host; required for trend history |
| 38 | Mobile token refresh through SDK | Fix existing | Code updated, unverified | Dashboard and Scorecard moved to SDK-backed requests |
| 39 | Release and config hygiene | Fix existing | Not completed | Consolidate config; pin versions; restore platform binaries |
| 40 | Data residency / multi-region (roadmap M8) | Good to have | Not completed — external/infrastructure | Region column and routing when customers require it |
| 41 | CyMetric's own compliance posture (SOC 2 / ISO 27001 / DPDP) | Implement new - required | Not completed — external/infrastructure | Privacy notice, DPA, retention and erasure, breach process, vendor register, before holding customer data commercially |
| 42 | Independent penetration test of the platform | Implement new - required | Not completed — external/infrastructure | Test after admin/RLS fixes |
| 43 | AI advisor | Good to have | Partial | Ground answers in verified KPIs and cited standards; prompt-injection and data-leak guards; friendly error mapping |
| 44 | Industry benchmarks | Good to have | Partial | Sourced benchmarks with sample size and date (S12) |
| 45 | Trend history and snapshots | Fix existing | Partial | History endpoint/analytics exists; scheduled snapshots not verified |
| 46 | Notifications and push end-to-end | Good to have | Partial | Push functionality is partial; operational end-to-end check missing |
| 47 | Team analytics (consensus signals, drill-down, CSV) | Good to have | Partial | Per-KPI disagreement view and exports (roadmap F7) |
| 48 | Web dashboard | Good to have | Not completed | Read-only web view on the shared SDK (roadmap M7) |
| 49 | Localisation and theming | Good to have | Not completed | English/Hindi first; light theme |

## Release acceptance

1. Confirm all 46 rows with functional tests or a signed manual test record; no unverified row is marked complete.
2. Run database migration and seed only in staging first with a verified backup.
3. Configure platform admin allow-list and CORS allowed origins in deployment.
4. Validate RLS, MFA, token revocation and evidence authorization on real accounts.
5. Confirm typecheck, unit tests, security audit, Android bundle and EAS APK build.
6. Obtain an independent penetration test and legal/privacy reviews before customer production use.

## Additional capability items

The original file has **49** entries. Items 47–49 (team analytics, web dashboard, localisation/theming) remain outside the requested 1–46 scope unless explicitly included.

## Security migration rollout notes (2026-11-25)

- Apply `20261125150000_token_lookup_indexes` on a staging database first. Both lookup columns are nullable for compatibility with existing records, but old token records lack lookup keys; existing refresh sessions will need to **sign in again**, and existing public share links must be recreated.
- Configure `PLATFORM_ADMIN_USER_IDS` as a comma-separated list of approved organisation ADMIN user IDs before using global routes. Empty configuration deliberately denies cross-tenant admin access. Provision each platform admin's TOTP before enabling login enforcement or they may be locked out.
- Configure `CORS_ALLOWED_ORIGINS` as an exact comma-separated list of browser origins; native Expo mobile applications do not need browser CORS.
- Confirm login throttling and refresh reuse responses with integration tests before allowing production traffic. Concurrent refresh races require device-level testing.
- The platform's penetration test, privacy documents, hosting regions and third-party SSO require external work; do not label those requirements complete based on repository changes.
