import { Level, ScoreRange } from '@cymetric/types';
import type { AggregatedScorecard } from './scorecard';

// ─────────────────────────────────────────────────────────────────────────────
// Local advisor — deterministic, rule-based responses grounded in the user's
// real scorecard data, with a hand-curated sector knowledge primer woven in.
//
// This module exists as a zero-cost alternative to the Anthropic API for
// student / demo deployments. Set USE_LOCAL_ADVISOR=true in .env to route
// chat requests here instead of to Claude. The wire format is identical
// (SSE deltas + done event) so the mobile app sees no difference.
//
// When budget for a real LLM becomes available, flip the flag off — the
// Anthropic code path in messages/route.ts is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdvisorContext {
  scorecard: AggregatedScorecard;
  industry: string;
  history: Array<{ role: 'USER' | 'ASSISTANT'; content: string }>;
  userMessage: string;
}

// Hand-authored, structured knowledge for each industry. Sourced from
// well-known cybersecurity playbooks (NIST CSF profiles, sector ISACs,
// regulatory guidance). Stable text — doesn't change request-to-request
// so the response feels grounded.
type SectorPrimer = {
  topThreats: string[]; // 3–5 items, ordered by typical priority
  keyControls: string[]; // 3–5 critical controls for this sector
  regulations: string[]; // applicable frameworks / laws
  oneLiner: string; // a single sentence we can paste into a generic answer
};

const SECTOR_KNOWLEDGE: Record<string, SectorPrimer> = {
  Banking: {
    topThreats: [
      'Account takeover via credential stuffing and phishing',
      'Insider fraud and unauthorised transaction approvals',
      'Vendor / third-party software compromise',
      'ATM and POS malware (skimming, jackpotting)',
      'Wire fraud and business email compromise',
    ],
    keyControls: [
      'Phishing-resistant MFA for all customer-facing apps + internal admin',
      'Transaction monitoring with anomaly detection',
      'Quarterly insider-fraud awareness training',
      'Vendor risk reviews on every integration touching customer data',
      'Encrypted backups + tested recovery for core banking systems',
    ],
    regulations: ['PCI DSS', 'RBI cyber guidelines', 'SOX (if listed)', 'GDPR for EU customers'],
    oneLiner:
      'In banking the bar is regulator-grade: PCI DSS scope, RBI cyber guidelines, and zero tolerance for credential-based fraud.',
  },
  Healthcare: {
    topThreats: [
      'Ransomware locking electronic health records and imaging systems',
      'Insider PHI theft (curiosity, financial)',
      'Medical IoT device compromise (infusion pumps, imaging)',
      'Phishing targeting clinicians',
      'Vendor breach exposing patient records',
    ],
    keyControls: [
      'HIPAA admin / technical / physical safeguards across the org',
      'BAAs signed with every vendor that touches PHI',
      'PHI encrypted at rest and in transit; role-based access only',
      'Network segmentation for clinical IoT vs business systems',
      'Tested ransomware recovery — backups offline + immutable',
    ],
    regulations: ['HIPAA', 'HITECH', 'GDPR for EU patients', 'state breach-notification laws'],
    oneLiner:
      'Healthcare lives under HIPAA; the chief risk is ransomware against clinical systems, and recovery — not prevention — is the differentiator.',
  },
  Technology: {
    topThreats: [
      'Supply-chain compromise via npm / PyPI / container images',
      'Source-code leakage and credential exposure in repos',
      'Phishing harvesting developer SSO tokens',
      'Unpatched OSS dependencies in production',
      'Insider code exfiltration',
    ],
    keyControls: [
      'Software Bill of Materials (SBOM) for every release',
      'Secrets management: vault for prod creds, scanning in CI',
      'Phishing-resistant MFA (hardware keys) for developers',
      'Dependency scanning in CI; weekly patch reviews',
      'Code-signing on artefacts; tamper-evident builds',
    ],
    regulations: ['SOC 2 Type II', 'ISO 27001', 'GDPR', 'sector-specific (HIPAA / PCI) when applicable'],
    oneLiner:
      'Tech companies fail most often on supply-chain hygiene: SBOM, dependency scanning, and developer-grade MFA cover ~70% of the realistic threat surface.',
  },
  Manufacturing: {
    topThreats: [
      'OT (operational technology) ransomware halting production',
      'Intellectual property theft (designs, formulas, processes)',
      'IT-to-OT lateral movement after IT compromise',
      'Supply-chain attacks on automation vendors',
      'Insider sabotage',
    ],
    keyControls: [
      'Strict IT / OT network segmentation with a DMZ',
      'Backups of CAD / PLM / MES systems, tested quarterly',
      'ICS monitoring (e.g. Claroty, Nozomi) on plant networks',
      'Vendor risk review before any PLC firmware update',
      'IP classification + DLP for design files',
    ],
    regulations: ['NIST 800-82 (ICS)', 'IEC 62443', 'GDPR', 'export-control rules for defence work'],
    oneLiner:
      'Manufacturing risk is bimodal: IP theft on the IT side, ransomware halting production on the OT side. Segmentation between them is the keystone.',
  },
  Retail: {
    topThreats: [
      'POS skimming and card data harvesting',
      'E-commerce fraud (card-not-present, account takeover)',
      'Supply-chain attacks via marketing / payment SaaS',
      'Phishing during peak shopping seasons',
      'Loyalty programme account takeover',
    ],
    keyControls: [
      'PCI DSS scope reduction via tokenisation',
      'Web application firewall on the e-commerce stack',
      'MFA on admin accounts; rate limiting on login endpoints',
      'Vendor reviews on payment, analytics, and shipping integrations',
      'PCI penetration testing annually',
    ],
    regulations: ['PCI DSS', 'GDPR for EU shoppers', 'CCPA for California'],
    oneLiner:
      'Retail is PCI-dominated: shrinking scope by tokenising card data + hardening the e-commerce stack covers most actual breaches.',
  },
  Education: {
    topThreats: [
      'Ransomware against K-12 / university IT',
      'Student / staff PII breaches',
      'DDoS during exam periods',
      'Account compromise via reused passwords',
      'Research data theft (universities)',
    ],
    keyControls: [
      'MFA mandatory for faculty / admin (not just IT staff)',
      'Network segmentation: student labs vs admin systems',
      'Backups offline; ransomware recovery rehearsed',
      'Phishing simulations targeting financial-aid + payroll roles',
      'Research data classification + access reviews',
    ],
    regulations: ['FERPA (US)', 'GDPR (EU)', 'state breach-notification laws'],
    oneLiner:
      'Education is a ransomware target because budgets are tight and segmentation is poor — MFA for non-IT staff is the single highest-impact control.',
  },
  Government: {
    topThreats: [
      'Nation-state APT targeting classified or sensitive data',
      'Supply-chain compromise via contractors',
      'Phishing for credential harvesting',
      'Ransomware against citizen-services systems',
      'Insider threat with privileged access',
    ],
    keyControls: [
      'Classified-information handling per regional standards',
      'Supply-chain risk management for every contractor',
      'Continuous monitoring (SIEM) with 24/7 SOC coverage',
      'Phishing-resistant MFA across all .gov.* accounts',
      'Mandatory background checks for privileged roles',
    ],
    regulations: ['FISMA / FedRAMP (US)', 'CERT-In (India)', 'GDPR (EU)', 'national equivalents'],
    oneLiner:
      'Government is the nation-state APT target — supply-chain risk management and continuous monitoring matter more than perimeter controls.',
  },
  Other: {
    topThreats: [
      'Phishing harvesting employee credentials',
      'Unpatched VPN / remote access infrastructure',
      'Ransomware via email or RDP exposure',
      'Insider data exfiltration',
      'Vendor / third-party breach',
    ],
    keyControls: [
      'MFA on every external-facing system',
      'Patch management with documented SLAs',
      'Offline backups + recovery drills',
      'Annual phishing training + simulation',
      'Vendor risk reviews for any integration with sensitive data',
    ],
    regulations: ['ISO 27001 baseline', 'GDPR if EU customers', 'SOC 2 if SaaS customer base'],
    oneLiner:
      'For most organisations the 80/20 is: MFA everywhere, patch promptly, train against phishing, and review your vendors.',
  },
};

const ALL_LEVELS: Level[] = [Level.PEOPLE, Level.PROCESS, Level.COMPANY];

const LEVEL_PROSE: Record<Level, string> = {
  [Level.PEOPLE]: 'People (awareness, training, insider risk)',
  [Level.PROCESS]: 'Process (policies, incident response, governance)',
  [Level.COMPANY]: 'Company (technical controls, network, endpoints)',
};

// ─────────────────────────────────────────────────────────────────────────────
// Intent detection
// ─────────────────────────────────────────────────────────────────────────────

type Intent =
  | 'weakest'
  | 'first_priority'
  | 'improve_level'
  | 'explain_level'
  | 'overall_summary'
  | 'sector_threats'
  | 'sector_controls'
  | 'sector_regulations'
  | 'completeness'
  | 'greeting'
  | 'unknown';

interface DetectedIntent {
  intent: Intent;
  level?: Level; // for improve_level / explain_level
}

function detectIntent(message: string): DetectedIntent {
  const m = message.toLowerCase();

  // Greetings — match early so "hi, what should I focus on" still picks the
  // priority intent (longer phrases dominate).
  if (/^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b[!.?]*$/i.test(message.trim())) {
    return { intent: 'greeting' };
  }

  // Level-specific questions take precedence over generic ones.
  const levelMatch = matchLevel(m);

  if (levelMatch && /(improve|raise|fix|boost|increase|move|red|amber)/.test(m)) {
    return { intent: 'improve_level', level: levelMatch };
  }
  if (levelMatch && /(explain|what is|what's|what does|describe|tell me about)/.test(m)) {
    return { intent: 'explain_level', level: levelMatch };
  }

  // Sector-specific questions. `s?\b` matches both singular ("threat") and
  // plural ("threats"); `\b` alone fails on plurals.
  if (
    /(threat|attack|risk|breach|ransomware|phishing)s?\b.*(industry|sector|company|our|us)/.test(m)
  ) {
    return { intent: 'sector_threats' };
  }
  if (/(threat|risk)s?\b/.test(m) && !levelMatch) {
    return { intent: 'sector_threats' };
  }
  if (/(regulation|compliance|standard|law|gdpr|hipaa|pci|soc 2|iso)/.test(m)) {
    return { intent: 'sector_regulations' };
  }
  if (/(control|safeguard|defen[sc]e|recommend)s?\b.*(industry|sector|us|we)/.test(m)) {
    return { intent: 'sector_controls' };
  }

  // Generic "where am I weak"
  if (/(weak|lowest|worst|poor|red|gap)/.test(m)) {
    return { intent: 'weakest' };
  }
  // "What should I do first"
  if (
    /(first|priority|start|begin|where (to|do i) start|next step|action|focus|do first)/.test(m)
  ) {
    return { intent: 'first_priority' };
  }
  // "Tell me about my score / progress"
  if (/(overall|summary|score|how am i|where (am i|do i stand)|progress)/.test(m)) {
    return { intent: 'overall_summary' };
  }
  if (/(completeness|complete|finish|done|how (much|many))/.test(m)) {
    return { intent: 'completeness' };
  }

  return { intent: 'unknown' };
}

function matchLevel(messageLower: string): Level | undefined {
  if (/\bpeople\b/.test(messageLower)) return Level.PEOPLE;
  if (/\bprocess\b/.test(messageLower)) return Level.PROCESS;
  if (/\bcompany\b/.test(messageLower)) return Level.COMPANY;
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response templates
// ─────────────────────────────────────────────────────────────────────────────

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

function bandLabel(r: ScoreRange): string {
  switch (r) {
    case ScoreRange.RED:
      return 'in the RED band — urgent';
    case ScoreRange.AMBER:
      return 'in the AMBER band — needs attention';
    case ScoreRange.GREEN:
      return 'in the GREEN band — healthy';
  }
}

function lowestLevel(s: AggregatedScorecard): Level {
  const scores: Array<[Level, number]> = [
    [Level.PEOPLE, s.levelBreakdown.people.score],
    [Level.PROCESS, s.levelBreakdown.process.score],
    [Level.COMPANY, s.levelBreakdown.company.score],
  ];
  scores.sort((a, b) => a[1] - b[1]);
  return scores[0]![0];
}

function levelStats(s: AggregatedScorecard, level: Level) {
  switch (level) {
    case Level.PEOPLE:
      return s.levelBreakdown.people;
    case Level.PROCESS:
      return s.levelBreakdown.process;
    case Level.COMPANY:
      return s.levelBreakdown.company;
  }
}

function sectorOf(industry: string): SectorPrimer {
  return SECTOR_KNOWLEDGE[industry] ?? SECTOR_KNOWLEDGE.Other!;
}

function bulletList(items: string[]): string {
  return items.map((i) => `• ${i}`).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-intent generators
// ─────────────────────────────────────────────────────────────────────────────

function answerOverallSummary(ctx: AdvisorContext): string {
  const s = ctx.scorecard;
  return [
    `Your overall score is ${pct(s.overallScore)}, ${bandLabel(s.colorBand)}.`,
    ``,
    `Level breakdown:`,
    `• People: ${pct(s.levelBreakdown.people.score)} (${s.levelBreakdown.people.answered}/${s.levelBreakdown.people.total} KPIs answered)`,
    `• Process: ${pct(s.levelBreakdown.process.score)} (${s.levelBreakdown.process.answered}/${s.levelBreakdown.process.total} KPIs answered)`,
    `• Company: ${pct(s.levelBreakdown.company.score)} (${s.levelBreakdown.company.answered}/${s.levelBreakdown.company.total} KPIs answered)`,
    ``,
    `Completeness: ${pct(s.completeness)}.`,
    s.underperforming.length > 0
      ? `You have ${s.underperforming.length} KPI${s.underperforming.length === 1 ? '' : 's'} in RED or AMBER that are dragging the score down.`
      : `No KPIs are currently in RED or AMBER — solid work.`,
  ].join('\n');
}

function answerWeakest(ctx: AdvisorContext): string {
  const s = ctx.scorecard;
  if (s.underperforming.length === 0 && s.completeness < 30) {
    return [
      `It's too early to say where you're weakest — you've only completed ${pct(s.completeness)} of the assessment.`,
      ``,
      `Finish more KPIs and ask me again. I can give you grounded advice once there's enough data.`,
    ].join('\n');
  }

  const weakest = [...s.underperforming].sort((a, b) => a.currentScore - b.currentScore).slice(0, 3);
  const lowLevel = lowestLevel(s);
  const stats = levelStats(s, lowLevel);

  if (weakest.length === 0) {
    return [
      `Nothing is in RED or AMBER right now, but your lowest level is ${LEVEL_PROSE[lowLevel]} at ${pct(stats.score)}.`,
      ``,
      `If you want to push the overall score higher, that's where the marginal effort pays off.`,
    ].join('\n');
  }

  return [
    `Your weakest area is ${LEVEL_PROSE[lowLevel]} at ${pct(stats.score)} — ${bandLabel(stats.colorBand)}.`,
    ``,
    `The three KPIs hurting your score the most:`,
    ...weakest.map(
      (w, i) =>
        `${i + 1}. ${w.kpiName} — currently scoring ${pct(w.currentScore)} (${w.scoreRange})`,
    ),
    ``,
    `Tap any of these on your Scorecard tab to see the recommended remediation.`,
  ].join('\n');
}

function answerFirstPriority(ctx: AdvisorContext): string {
  const s = ctx.scorecard;
  const sector = sectorOf(ctx.industry);

  if (s.completeness < 30) {
    return [
      `Honestly? Finish the assessment first.`,
      ``,
      `You're only ${pct(s.completeness)} complete — without data on the rest of the KPIs I can't tell you what's actually broken vs what's just unanswered.`,
      ``,
      `Pick the level with the most unanswered KPIs and work through them. I'll be here with concrete advice once we have a real picture.`,
    ].join('\n');
  }

  // Find the top RED KPI; if none, top AMBER.
  const sorted = [...s.underperforming].sort((a, b) => {
    if (a.scoreRange !== b.scoreRange) {
      return a.scoreRange === ScoreRange.RED ? -1 : 1;
    }
    return a.currentScore - b.currentScore;
  });

  if (sorted.length === 0) {
    return [
      `Everything is in the GREEN band — no urgent fires.`,
      ``,
      `For sustained improvement in ${ctx.industry}, the highest-leverage next step is usually: ${sector.oneLiner}`,
      ``,
      `If you want to push the overall score from ${pct(s.overallScore)} higher, focus on your lowest level — ${LEVEL_PROSE[lowestLevel(s)]} — and re-tier the KPIs that are sitting at the edge of GREEN.`,
    ].join('\n');
  }

  const top = sorted[0]!;
  return [
    `Start with this: ${top.kpiName}.`,
    ``,
    `It's currently scoring ${pct(top.currentScore)} (${top.scoreRange}) — your single biggest opportunity for a quick win.`,
    ``,
    `Why this first: it's a ${top.scoreRange} band KPI, which means concrete remediation is well-understood. Open it from the Scorecard tab and you'll see specific tier-upgrade guidance.`,
    ``,
    `For context on your sector: ${sector.oneLiner}`,
  ].join('\n');
}

function answerImproveLevel(ctx: AdvisorContext, level: Level): string {
  const s = ctx.scorecard;
  const stats = levelStats(s, level);
  const sector = sectorOf(ctx.industry);
  const underInLevel = s.underperforming.filter((u) => {
    // We don't have level on underperforming directly; match on which KPIs
    // are in which level via the breakdown stats — accept that this gives
    // a slight approximation.
    void u;
    return true; // shown below — we already have the names from the response
  });
  void underInLevel;

  const sectorTip =
    level === Level.PEOPLE
      ? `For your sector specifically, watch for: ${sector.topThreats[0]}.`
      : level === Level.PROCESS
        ? `For your sector specifically, the most relevant regulation is: ${sector.regulations[0]}.`
        : `For your sector specifically, the highest-impact control to verify is: ${sector.keyControls[0]}.`;

  return [
    `${LEVEL_PROSE[level]} is at ${pct(stats.score)} — ${bandLabel(stats.colorBand)}, with ${stats.answered}/${stats.total} KPIs answered.`,
    ``,
    `To raise this score:`,
    `1. Open the assessment for this level. Re-check any KPIs you marked at the lowest tier — most are upgradable with a small policy or technical change.`,
    `2. Prioritise KPIs that are RED before AMBER, and AMBER before GREEN — the marginal lift is bigger.`,
    `3. After each tier upgrade, the snapshot worker will recompute your score within ~5 seconds.`,
    ``,
    sectorTip,
  ].join('\n');
}

function answerExplainLevel(_ctx: AdvisorContext, level: Level): string {
  if (level === Level.PEOPLE) {
    return [
      `**People** covers everything about your team as a security surface — what they know, how they behave, and how you protect them from being the entry point.`,
      ``,
      `The KPIs in this level look at:`,
      `• Awareness training frequency and coverage`,
      `• Phishing simulation results`,
      `• Insider risk programmes`,
      `• Background checks and onboarding security`,
      `• Off-boarding hygiene (access revocation)`,
      ``,
      `Why it matters: most breaches start with a human action — clicking a phishing link, reusing a password, mishandling data. People-level controls are where the cheapest, highest-ROI improvements live.`,
    ].join('\n');
  }
  if (level === Level.PROCESS) {
    return [
      `**Process** covers the documented, repeatable ways you handle security — policies, incident response, vendor reviews, change management.`,
      ``,
      `The KPIs in this level look at:`,
      `• Written security policies (and whether anyone reads them)`,
      `• Incident response plans + drills`,
      `• Vendor / third-party risk reviews`,
      `• Change management and access reviews`,
      `• Governance: who's accountable, what gets reported to leadership`,
      ``,
      `Why it matters: technical controls without process drift into chaos. Process is what makes security survive employee turnover.`,
    ].join('\n');
  }
  return [
    `**Company** covers the technical controls — your networks, endpoints, identity systems, applications, and infrastructure.`,
    ``,
    `The KPIs in this level look at:`,
    `• MFA coverage on critical apps`,
    `• Patch management cadence`,
    `• Network segmentation`,
    `• Endpoint protection (EDR, antivirus)`,
    `• Backups and disaster recovery`,
    `• Application security (WAF, vuln scanning)`,
    ``,
    `Why it matters: this is the layer most people picture when they think "cybersecurity." Strong technical controls slow attackers down even when People and Process aren't perfect.`,
  ].join('\n');
}

function answerSectorThreats(ctx: AdvisorContext): string {
  const sector = sectorOf(ctx.industry);
  return [
    `Top cybersecurity threats for ${ctx.industry}:`,
    ``,
    bulletList(sector.topThreats),
    ``,
    `${sector.oneLiner}`,
    ``,
    `If you want, ask me how your current scorecard compares against these.`,
  ].join('\n');
}

function answerSectorControls(ctx: AdvisorContext): string {
  const sector = sectorOf(ctx.industry);
  return [
    `Critical controls for ${ctx.industry}:`,
    ``,
    bulletList(sector.keyControls),
    ``,
    `Cross-reference these against your KPIs in the Scorecard tab — any KPI scoring in RED or AMBER that maps to one of these is a priority fix.`,
  ].join('\n');
}

function answerSectorRegulations(ctx: AdvisorContext): string {
  const sector = sectorOf(ctx.industry);
  return [
    `Regulations and frameworks relevant to ${ctx.industry}:`,
    ``,
    bulletList(sector.regulations),
    ``,
    `Note that CyMetric's KPI catalogue is mapped to NIST CSF 2.0 and ISO 27001 control families — pick the framework lens that matches your compliance reporting in your profile.`,
  ].join('\n');
}

function answerCompleteness(ctx: AdvisorContext): string {
  const s = ctx.scorecard;
  const remaining = {
    people: s.levelBreakdown.people.total - s.levelBreakdown.people.answered,
    process: s.levelBreakdown.process.total - s.levelBreakdown.process.answered,
    company: s.levelBreakdown.company.total - s.levelBreakdown.company.answered,
  };
  const totalRemaining = remaining.people + remaining.process + remaining.company;

  if (totalRemaining === 0) {
    return `You've completed every KPI — ${pct(s.completeness)} done. Nice work.`;
  }
  return [
    `Your assessment is ${pct(s.completeness)} complete.`,
    ``,
    `Remaining:`,
    `• People: ${remaining.people} KPIs left`,
    `• Process: ${remaining.process} KPIs left`,
    `• Company: ${remaining.company} KPIs left`,
    ``,
    `${totalRemaining} total. Finish these for a more accurate score and better recommendations from me.`,
  ].join('\n');
}

function answerGreeting(ctx: AdvisorContext): string {
  const s = ctx.scorecard;
  return [
    `Hello. I'm your CyMetric advisor.`,
    ``,
    `You're sitting at ${pct(s.overallScore)} overall (${bandLabel(s.colorBand)}) with ${pct(s.completeness)} of the assessment complete.`,
    ``,
    `Things you can ask me:`,
    `• "Where am I weakest?"`,
    `• "What should I focus on first?"`,
    `• "How do I improve my People score?"`,
    `• "What threats matter for ${ctx.industry}?"`,
    `• "Explain my Company level"`,
  ].join('\n');
}

function answerUnknown(ctx: AdvisorContext): string {
  return [
    `I'm not sure what you're asking, but here's what I can help with:`,
    ``,
    `• Where am I weakest?`,
    `• What should I focus on first?`,
    `• How do I improve my People / Process / Company score?`,
    `• Explain the People / Process / Company level`,
    `• What threats / regulations / controls matter for ${ctx.industry}?`,
    `• Overall summary / How am I doing?`,
    `• How much have I completed?`,
    ``,
    `Try rephrasing along those lines.`,
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function generateAdvisorReply(ctx: AdvisorContext): string {
  const { intent, level } = detectIntent(ctx.userMessage);
  switch (intent) {
    case 'overall_summary':
      return answerOverallSummary(ctx);
    case 'weakest':
      return answerWeakest(ctx);
    case 'first_priority':
      return answerFirstPriority(ctx);
    case 'improve_level':
      return answerImproveLevel(ctx, level ?? lowestLevel(ctx.scorecard));
    case 'explain_level':
      return answerExplainLevel(ctx, level ?? Level.PEOPLE);
    case 'sector_threats':
      return answerSectorThreats(ctx);
    case 'sector_controls':
      return answerSectorControls(ctx);
    case 'sector_regulations':
      return answerSectorRegulations(ctx);
    case 'completeness':
      return answerCompleteness(ctx);
    case 'greeting':
      return answerGreeting(ctx);
    case 'unknown':
      return answerUnknown(ctx);
  }
}

// Convert the full reply to an async iterable of word-sized chunks so the
// streaming SSE handler can yield deltas. Word delay is configurable — keep
// at 35–60ms for an "AI feels alive" effect without it dragging.
export async function* streamAdvisorReply(
  text: string,
  delayMs = 40,
): AsyncIterable<string> {
  // Split keeping whitespace as separate tokens so we don't lose newlines
  // or collapse spacing.
  const tokens = text.split(/(\s+)/).filter((t) => t.length > 0);
  for (const t of tokens) {
    yield t;
    if (!/^\s+$/.test(t)) {
      // Only pause between content tokens, not between every whitespace.
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// Used by `void` callsites to signal the constant is intentional.
// Exposes the sector list for the chat suggestions UI to read if useful.
export const SUPPORTED_INDUSTRIES = Object.keys(SECTOR_KNOWLEDGE);
// Avoid unused-export warnings in strict mode:
void ALL_LEVELS;
