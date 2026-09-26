import type { ScoreRange, SuggestionPriority } from '@cymetric/types';

// Default improvement suggestions per KPI name, broken out by score band.
// Shown on the scorecard for any KPI at AMBER (50–74%) or RED (<50%).
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
