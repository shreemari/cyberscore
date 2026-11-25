import type { ScoreRange, SuggestionPriority } from '@cymetric/types';

// Default improvement suggestions per KPI name, broken out by score band.
// Shown on the scorecard for any KPI at AMBER (50–79%) or RED (<50%).
// Kept deliberately practical — no generic "improve your security posture".
//
// Admins can add more via POST /api/v1/admin/suggestions.

export interface SuggestionSeed {
  scoreRange: ScoreRange;
  suggestionText: string;
  priority: SuggestionPriority;
}

export const SUGGESTIONS_BY_KPI: Record<string, SuggestionSeed[]> = {
  'User Awareness Training Completion': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Mandate training completion within 14 days for all employees. Escalate incomplete records to line managers weekly.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Send automated reminders 7 days before training due date; publish team completion rates on a shared dashboard.',
    },
  ],
  'Phishing Click Rate': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Run weekly phishing simulations and require remedial training for anyone who clicks. Roll out a "report phishing" button in email clients.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Run monthly simulations targeting the roles most commonly clicked. Publish team click-rate trends (anonymised).',
    },
  ],
  'Security Awareness — Social Engineering Failure Rate': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Schedule vishing and pretexting simulations quarterly; follow up each failure with 1:1 coaching within 48 hours.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Add social-engineering scenarios to the annual training path and track individual pass rates.',
    },
  ],
  'Security Awareness — Quiz Score (% employees passing)': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Lower the pass threshold is not the answer — rewrite quiz content for clarity and require re-attempts until pass.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Review the 3 most-failed questions each quarter; ship short refresher content addressing those gaps.',
    },
  ],
  'Policy Violations — Data in Personal Space': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Deploy DLP policies blocking corporate data upload to personal cloud storage; audit violations weekly.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Educate on approved storage locations and flag policy violations in monthly team reviews.',
    },
  ],
  'Policy Violations — Data Classification': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Roll out automated classification tooling (Microsoft Purview / Google Data Loss Prevention) with mandatory labelling.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Publish a one-page classification cheat-sheet and audit a sample of new documents each month.',
    },
  ],
  'Policy Violations — Unauthorised Software Installs': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Enforce application allow-listing (Windows AppLocker / macOS Gatekeeper); revoke local admin rights by default.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Ship a curated internal software portal so employees can self-serve approved tools without seeking workarounds.',
    },
  ],
  'Policy Violations — Removable Media Usage': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Disable USB mass-storage on managed endpoints; require approved encrypted drives for exceptions.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Log all removable media events centrally and review anomalies weekly.',
    },
  ],
  'MTTD — Avg Detection Time (weekly)': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Centralise logs into a SIEM, tune high-signal alerts (auth, EDR, DNS, egress) and run weekly alert triage reviews.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Add runbooks for top-10 alert types and measure time-to-acknowledge separately from time-to-detect.',
    },
  ],
  'MTTR — Avg Response Time (weekly)': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Stand up a 24/7 on-call rotation and define severity SLAs; automate containment playbooks for top incident types.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Publish response runbooks for the 5 most common incident types; rehearse them quarterly.',
    },
  ],
  'MTBF — Mean Time Between Failures': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Conduct root-cause analyses on the last 5 incidents; prioritise fixes for the top recurring failure modes.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Track failure categories in a shared register and review trends at monthly ops reviews.',
    },
  ],
  'MTTC — Mean Time to Contain': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Automate containment actions (isolate host, disable account, revoke sessions) directly from SIEM/EDR workflows.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Document containment runbooks and pre-approve common actions to shorten decision latency.',
    },
  ],
  'Patch Compliance Rate': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Implement automated patch management with enforced deadlines; quarantine non-compliant endpoints from sensitive networks.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Publish a patch-compliance dashboard by team; tie compliance to team-level OKRs.',
    },
  ],
  'Security Patch Deployment Time': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Adopt a tiered SLA: critical CVEs in 48h, high in 7d; auto-schedule maintenance windows for critical patches.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Pre-stage patches in a test ring; promote to production within the published SLA unless a block is filed.',
    },
  ],
  'Cloud Misconfiguration Rate': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Deploy CSPM (Wiz / Prisma Cloud / AWS Config) with auto-remediation for the top 10 misconfiguration types.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Enforce infrastructure-as-code and reject drift at merge time; remediate weekly.',
    },
  ],
  'EDR Coverage — % Systems Covered': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Block network access for endpoints without EDR via NAC or zero-trust policy; report exception requests to leadership.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Automate EDR agent deployment in device provisioning; alert when an endpoint reports in without the agent.',
    },
  ],
  'Backup & Recovery Efficacy (Recovery Time)': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Run a full restore drill this quarter; set an RTO for each tier-1 system and test against it.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Automate backup integrity checks and alert on failed restores.',
    },
  ],
  'Unresolved Critical Vulnerabilities (avg monthly CVEs)': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Set SLAs by severity (critical 14d, high 30d); publish a public dashboard of aged findings to leadership.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Integrate vulnerability data with ticketing so ownership is always assigned within 24 hours.',
    },
  ],
  'Third-Party Vendor Risk Score (monthly % adherence)': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Require SOC 2 / ISO 27001 reports for tier-1 vendors; block renewals on non-compliant suppliers.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Send annual security questionnaires and review responses at the vendor renewal gate.',
    },
  ],
  'Security Assessment Completion Rate': [
    {
      scoreRange: 'RED',
      priority: 'HIGH',
      suggestionText:
        'Calendar assessments a quarter ahead; assign a single owner per assessment type to avoid handoff slippage.',
    },
    {
      scoreRange: 'AMBER',
      priority: 'MEDIUM',
      suggestionText:
        'Track assessment completion as an OKR; publish status weekly.',
    },
  ],
  "MTTD — Month-on-Month Trend": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Investigate detection delays by source and shift; restore missing log feeds and establish a weekly time-to-detect review." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Trend detection time monthly by incident severity, with an owner for slow-to-detect cases." },
  ],
  "MTTR — Month-on-Month Trend": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Run post-incident reviews for slow responses, assign on-call escalation paths and test containment runbooks." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Track time to triage, containment and recovery separately to target the largest delay." },
  ],
  "Intrusion — Malicious Login Attempts Blocked": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Enforce MFA and conditional access, enable account lockout controls and alert on credential-stuffing patterns." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Review blocked login attempts weekly and tune identity-provider risk policies for exposed accounts." },
  ],
  "Intrusion — Malicious Port Scans Blocked": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Close unused inbound ports, enforce network segmentation and alert on external and internal scan activity." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Review firewall deny logs and validate scanning coverage during monthly exposure reviews." },
  ],
  "Intrusion — Known Exploit Payloads Blocked": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Update IPS signatures and WAF rules, patch exploited services and confirm alerts reach incident responders." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Test exploit-blocking rules against safe validation traffic and monitor bypass attempts." },
  ],
  "Intrusion — Viruses / Ransomware Blocked": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Isolate unprotected endpoints, enable tamper-resistant EDR and test ransomware containment and recovery." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Review malware detections weekly and close endpoint coverage gaps before the next drill." },
  ],
  "Intrusion — False Positive Verification & Whitelist": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Audit allowlists for overbroad exemptions, require approvals and investigate alerts suppressed without evidence." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Review whitelist changes monthly and retire exceptions that no longer have a valid owner." },
  ],
  "Zero-Day Exploit Cases — % Contained": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Adopt emergency isolation playbooks for exploited assets, deploy compensating controls and rehearse urgent escalation." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Review containment times after each new exploit advisory and verify workaround deployment." },
  ],
  "Data Exfiltration Attempts — % Contained": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Enable outbound DLP and egress alerts, restrict high-risk transfers and run an exfiltration tabletop exercise." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Tune sensitive-data classifications and review blocked transfer cases with data owners." },
  ],
  "DNS & C2 Traffic — % Identified & Prevented": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Route endpoints through protective DNS, block known C2 destinations and alert on suspicious beaconing." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Audit DNS telemetry coverage and tune detections for newly observed malicious domains." },
  ],
  "User Privilege Escalation — % Identified & Prevented": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Remove standing administrative privileges, enable privileged-access approval and alert on role changes." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Review privileged access grants weekly and simulate unauthorized escalation attempts." },
  ],
  "Severity of Incidents (High & Critical / month)": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Prioritise repeat high-severity incidents, assign root-cause owners and test the incident escalation process." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Trend high and critical incidents by cause and verify closure of corrective actions." },
  ],
  "Root Cause — Misconfigurations": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Enforce secure configuration baselines through policy-as-code and remediate high-risk drift first." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Schedule monthly baseline drift checks and capture ownership for every exception." },
  ],
  "Root Cause — Phishing": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Deploy phishing-resistant MFA, strengthen mail protections and deliver targeted simulation follow-ups." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Review reported phishing patterns and coach teams with repeated simulation failures." },
  ],
  "Root Cause — Outdated Software": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Inventory unsupported software, deploy prioritized security updates and block unpatched high-risk systems." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Measure patch-age exceptions weekly and automate update reminders for application owners." },
  ],
  "Root Cause — Privileged Misuse": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Review all privileged grants, implement just-in-time access and alert on high-risk admin actions." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Require periodic privileged-access recertification and audit exception approvals." },
  ],
  "Root Cause — Other Issues": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Classify recurring unknown causes, require incident root-cause review and assign corrective action owners." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Improve incident categorisation and close gaps found during monthly problem reviews." },
  ],
  "Failed Login Rate (weekly % of total logins)": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Investigate account lockouts, credential stuffing and authentication outages; enforce MFA and rate limiting." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Monitor failed logins by source and account and tune thresholds to reduce false alarms." },
  ],
  "Vulnerability Recurrence Rate (monthly %)": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Identify repeatedly reopened findings, fix underlying deployment patterns and add regression checks to CI." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Review recurring vulnerabilities by owner monthly and add preventive configuration tests." },
  ],
  "System Hardening Status (CIS Benchmark %)": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Apply prioritized CIS hardening controls to exposed servers and endpoints, with tracked exceptions." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Run automated CIS compliance scans and resolve baseline drift with asset owners." },
  ],
  "Anti-Phishing / Email Gateway Effectiveness": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Review mail authentication and filtering, quarantine high-risk payloads and validate detection with safe phishing simulations." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Tune gateway policies using missed phishing cases and monitor false positives monthly." },
  ],
  "Browser & Application Patch Level": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Patch internet-facing browsers and critical applications urgently, then remove unsupported versions." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Automate browser and app update deployment and report devices outside the patch SLA." },
  ],
  "Privileged Account Monitoring (% monitored)": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Enable centralized audit logs and alerts for every admin account, service identity and break-glass account." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Review privileged session coverage and verify high-risk activity alerts reach a responder." },
  ],
  "Average Incident Cost (M2M trend)": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Identify the most expensive incident types, fund preventive controls and track recovery costs by event." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Review incident cost trends quarterly and validate whether corrective actions reduce repeat expenses." },
  ],
  "Budget vs Actual Spend": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Reconcile security spend against approved priorities, pause low-value commitments and protect critical control coverage." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Forecast security costs monthly and flag material variance for leadership review." },
  ],
  "AI Impact in Security (vs peer adoption)": [
    { scoreRange: 'RED', priority: 'HIGH', suggestionText: "Assess AI use cases against specific security outcomes, set governance guardrails and run a measured pilot." },
    { scoreRange: 'AMBER', priority: 'MEDIUM', suggestionText: "Define detection or response KPIs for AI tooling and review pilot performance before expanding." },
  ],
};

// Generic fallback applied to any KPI without a specific entry.
// Keeps suggestion rendering non-empty while admins flesh out bespoke copy.
export const GENERIC_SUGGESTIONS: SuggestionSeed[] = [
  {
    scoreRange: 'RED',
    priority: 'HIGH',
    suggestionText:
      'Treat this KPI as a board-level priority. Assign a single owner, set a 30-day improvement target and review progress weekly.',
  },
  {
    scoreRange: 'AMBER',
    priority: 'MEDIUM',
    suggestionText:
      'Close the gap to green by the next quarter: identify the top 2 contributing factors, ship a specific control and measure weekly.',
  },
];
