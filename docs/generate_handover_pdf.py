"""
Generate the handover PDF for CyMetric.

The PDF has two parts:
  1. Final Report: a complete written walkthrough of the project.
  2. Presentation Slides Outline: 6 slides with what goes on each one.

Both parts are written in plain, slightly formal English from Saanvi's
first person voice. There are deliberately no em-dashes anywhere in
the content per the requested style.
"""

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, ListFlowable, ListItem, KeepTogether,
)

OUT = "/Users/saanvivishal/Desktop/cyberscore/docs/cyberscore-final-report.pdf"

# ----------------------------------------------------------------------
# Styles
# ----------------------------------------------------------------------
BRAND = HexColor("#3b82f6")
INK = HexColor("#0f172a")
MUTED = HexColor("#475569")

base = getSampleStyleSheet()

styles = {
    "TitleBig": ParagraphStyle(
        "TitleBig", parent=base["Title"],
        fontName="Helvetica-Bold", fontSize=32, leading=38,
        textColor=INK, alignment=TA_CENTER, spaceAfter=18,
    ),
    "Subtitle": ParagraphStyle(
        "Subtitle", parent=base["Title"],
        fontName="Helvetica", fontSize=14, leading=20,
        textColor=MUTED, alignment=TA_CENTER, spaceAfter=24,
    ),
    "CoverMeta": ParagraphStyle(
        "CoverMeta", parent=base["Normal"],
        fontName="Helvetica", fontSize=11, leading=18,
        textColor=INK, alignment=TA_CENTER, spaceAfter=4,
    ),
    "H1": ParagraphStyle(
        "H1", parent=base["Heading1"],
        fontName="Helvetica-Bold", fontSize=20, leading=24,
        textColor=BRAND, spaceBefore=18, spaceAfter=12, keepWithNext=True,
    ),
    "H2": ParagraphStyle(
        "H2", parent=base["Heading2"],
        fontName="Helvetica-Bold", fontSize=14, leading=18,
        textColor=INK, spaceBefore=12, spaceAfter=8, keepWithNext=True,
    ),
    "Body": ParagraphStyle(
        "Body", parent=base["BodyText"],
        fontName="Helvetica", fontSize=11, leading=16,
        textColor=INK, alignment=TA_JUSTIFY, spaceAfter=8,
    ),
    "Bullet": ParagraphStyle(
        "Bullet", parent=base["BodyText"],
        fontName="Helvetica", fontSize=11, leading=15,
        textColor=INK, leftIndent=18, bulletIndent=4, spaceAfter=3,
    ),
    "Quote": ParagraphStyle(
        "Quote", parent=base["BodyText"],
        fontName="Helvetica-Oblique", fontSize=11, leading=15,
        textColor=MUTED, leftIndent=18, rightIndent=18, spaceAfter=10,
    ),
    "Mono": ParagraphStyle(
        "Mono", parent=base["BodyText"],
        fontName="Courier", fontSize=10, leading=13,
        textColor=INK, spaceAfter=8,
    ),
    "SlideTitle": ParagraphStyle(
        "SlideTitle", parent=base["Heading2"],
        fontName="Helvetica-Bold", fontSize=15, leading=18,
        textColor=BRAND, spaceBefore=14, spaceAfter=6, keepWithNext=True,
    ),
    "Caption": ParagraphStyle(
        "Caption", parent=base["BodyText"],
        fontName="Helvetica-Oblique", fontSize=9, leading=12,
        textColor=MUTED, alignment=TA_CENTER, spaceAfter=6,
    ),
}

# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def P(text, style="Body"):
    return Paragraph(text, styles[style])

def H1(text):
    return Paragraph(text, styles["H1"])

def H2(text):
    return Paragraph(text, styles["H2"])

def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(t, styles["Bullet"]), leftIndent=18, bulletColor=BRAND) for t in items],
        bulletType="bullet", start="circle", bulletFontSize=8,
        leftIndent=18,
    )

def info_table(rows, col_widths=(2.0*inch, 4.5*inch)):
    t = Table(rows, colWidths=list(col_widths))
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTNAME", (1,0), (1,-1), "Helvetica"),
        ("FONTSIZE", (0,0), (-1,-1), 11),
        ("TEXTCOLOR", (0,0), (-1,-1), INK),
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LINEBELOW", (0,0), (-1,-2), 0.4, HexColor("#cbd5e1")),
    ]))
    return t

def stack_table(headers, rows, col_widths):
    """Heading row plus data rows, like the tech stack table."""
    data = [headers] + rows
    t = Table(data, colWidths=list(col_widths))
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BACKGROUND", (0,0), (-1,0), BRAND),
        ("TEXTCOLOR", (0,0), (-1,0), white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTNAME", (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, HexColor("#f1f5f9")]),
        ("GRID", (0,0), (-1,-1), 0.4, HexColor("#cbd5e1")),
    ]))
    return t

def hr():
    """Thin separator line via a small spacer plus table border."""
    t = Table([[""]], colWidths=[6.5*inch], rowHeights=[1])
    t.setStyle(TableStyle([
        ("LINEABOVE", (0,0), (-1,-1), 0.6, BRAND),
    ]))
    return t

# ----------------------------------------------------------------------
# Content
# ----------------------------------------------------------------------
story = []

# ======= COVER =======
story += [
    Spacer(1, 1.6*inch),
    P("CyMetric", "TitleBig"),
    P("A Mobile First Cybersecurity Health Scorecard for Organisations", "Subtitle"),
    Spacer(1, 0.6*inch),
    P("Final Report and Presentation Outline", "Subtitle"),
    Spacer(1, 0.8*inch),
    P("<b>Submitted by:</b> Saanvi Vishal (IMT2021043)", "CoverMeta"),
    P("<b>Mentor:</b> Mohan Ram C, FISST", "CoverMeta"),
    P("<b>Institution:</b> International Institute of Information Technology, Bangalore", "CoverMeta"),
    P("<b>Project duration:</b> 15 April 2026 to 18 May 2026", "CoverMeta"),
    P("<b>Repository:</b> https://github.com/saanvivishal/cyberscore", "CoverMeta"),
    P("<b>Live API:</b> https://cyberscore-api.vercel.app", "CoverMeta"),
    PageBreak(),
]

# ======= TABLE OF CONTENTS =======
story += [
    H1("Contents"),
    Spacer(1, 0.1*inch),
    P("<b>Part One: Final Report</b>", "Body"),
    bullets([
        "1. Abstract",
        "2. Problem Statement",
        "3. Solution Overview",
        "4. System Architecture",
        "5. Technology Stack",
        "6. Features in Detail",
        "7. Development Process (Sprints)",
        "8. Deployment",
        "9. Testing Approach",
        "10. Challenges and Lessons Learned",
        "11. Known Limitations",
        "12. Future Work",
        "13. Conclusion",
        "14. References and Links",
    ]),
    Spacer(1, 0.2*inch),
    P("<b>Part Two: Presentation Slides Outline</b>", "Body"),
    bullets([
        "Slide 1: Title",
        "Slide 2: Problem and Solution",
        "Slide 3: Architecture and Tech Stack",
        "Slide 4: What Got Built",
        "Slide 5: Deployment and Process",
        "Slide 6: Lessons Learned and Thanks",
    ]),
    PageBreak(),
]

# ======= PART 1: FINAL REPORT =======

story += [
    P("PART ONE", "Caption"),
    P("Final Report", "TitleBig"),
    Spacer(1, 0.3*inch),
]

# --- 1. Abstract ---
story += [
    H1("1. Abstract"),
    P(
        "CyMetric is a mobile first SaaS product that lets a company check its own "
        "cybersecurity health. The user answers 46 questions across three areas: People, "
        "Process, and Company. The app then gives them a live numeric score, shows which "
        "areas are weak, and offers personalised suggestions. There is also a built in chat "
        "advisor that grounds its replies in the user's actual score, so the advice is specific "
        "to them and not generic."
    ),
    P(
        "The product has two modes. SOLO mode is for a single user who wants to check their "
        "own organisation. ENTERPRISE mode is for a company admin who invites employees and "
        "controls which assessment areas each employee can answer. The KPIs are mapped to "
        "NIST CSF 2.0 and ISO 27001 control families, so the result is a real signal, not a "
        "toy score."
    ),
    P(
        "I built this project over five weeks as a single developer. It is now fully deployed "
        "and works end to end. The Android APK runs on a real phone, the API runs on Vercel, "
        "and password reset emails arrive in real inboxes through Brevo. The total cost to run "
        "the deployment is zero rupees per month because every service is on a free tier."
    ),
]

# --- 2. Problem Statement ---
story += [
    H1("2. Problem Statement"),
    P(
        "Most small and mid size companies do not know how good their cybersecurity actually "
        "is. They hear about ransomware in the news, they hear about data breaches, and they "
        "feel that they should do something. But they do not have a CISO. They do not have a "
        "consultant. They do not even have a checklist that is short enough to actually use."
    ),
    P(
        "The result is that they either ignore the problem, or they panic buy security tools "
        "without knowing what they actually need. Both paths waste money and time, and neither "
        "path actually makes them safer."
    ),
    P(
        "CyMetric solves this by giving the company a structured self assessment that takes "
        "about thirty minutes. At the end the company knows three things: what is the current "
        "score, where are the weakest areas, and what are the next three actions to take. It "
        "is not a substitute for a real audit, but it is a cheap and useful first step that any "
        "founder or IT lead can do on their phone."
    ),
]

# --- 3. Solution Overview ---
story += [
    H1("3. Solution Overview"),
    P(
        "CyMetric has three parts that work together."
    ),
    bullets([
        "<b>Mobile app.</b> An Android app built with React Native and Expo. The user signs in, takes the assessment, sees the scorecard, and chats with the advisor. Everything important happens here.",
        "<b>API.</b> A Next.js server that runs the auth, stores the answers, computes the scores, and streams the chat replies. This is the brain of the product.",
        "<b>Database.</b> A Postgres database that holds the KPI catalogue, the user answers, the historical snapshots, and the chat history.",
    ]),
    H2("Key product features"),
    bullets([
        "Self assessment across 46 KPIs in three categories (People, Process, Company).",
        "Live scorecard with overall score plus per category breakdown plus RED, AMBER, GREEN bands per metric.",
        "Personalised remediation suggestions for each weak KPI.",
        "AI advisor chat that knows the user's actual scorecard and gives industry specific advice (8 industries supported).",
        "Two user modes: SOLO for individuals, ENTERPRISE for admins who manage a team.",
        "Per employee access control: the admin can give an employee access to only People, or only Process, or any combination.",
        "Trend chart showing how the score has changed over time.",
        "Optional TOTP two factor authentication.",
        "Shareable read only scorecard URLs.",
        "Evidence file uploads attached to specific answers (planned, not yet wired to storage).",
    ]),
    PageBreak(),
]

# --- 4. System Architecture ---
story += [
    H1("4. System Architecture"),
    P(
        "The system is a modular monolith. There is one API process, but the code inside it is "
        "split into clear modules (auth, scoring, chat, team, evidence, and so on). Each module "
        "exposes a flat surface and does not reach into another module's internals."
    ),
    P(
        "I chose this shape because microservices would have been overkill for a single developer "
        "project. With one process, one deploy, one log stream, the project stays simple. If the "
        "user base grows past about fifty thousand monthly active users, splitting modules into "
        "separate services would be straightforward because the boundaries are already clean."
    ),
    H2("Component diagram (text version)"),
    P(
        "Mobile app talks to the API over HTTPS with a JWT access token. API reads and writes to "
        "Postgres for all persistent data. API reads and writes to Redis for rate limits, the KPI "
        "cache, and (in earlier versions) the BullMQ queue. API talks to either the local rule "
        "based advisor or the Anthropic Claude API for chat. API talks to the Brevo email service "
        "over HTTPS for sending one time passwords and invites. A small external cron job pings "
        "the API health endpoint every two minutes to keep it warm."
    ),
    H2("Data flow for a typical request"),
    P(
        "When the user submits an assessment answer:"
    ),
    bullets([
        "Mobile sends a POST request to <font face='Courier'>/api/v1/kpis/submit</font> with the KPI id and the answer.",
        "API verifies the JWT and sets the database session variable <font face='Courier'>app.current_org_id</font>. This activates row level security so the request can only see and write rows that belong to this organisation.",
        "API writes the response row to the database.",
        "API recomputes the scorecard live (the calculation is pure and fast).",
        "API returns the updated scorecard JSON to the mobile app.",
        "Mobile updates its React Query cache and shows the new score on the dashboard.",
    ]),
    H2("Tenant isolation through Row Level Security"),
    P(
        "Every table that holds user data has RLS policies in Postgres. The policy says that a "
        "row is visible only when its <font face='Courier'>orgId</font> matches the current session's "
        "<font face='Courier'>app.current_org_id</font>. If the API forgot to set that variable, the "
        "query would return zero rows instead of leaking another organisation's data. This is a "
        "safety net in case of a programming mistake."
    ),
    PageBreak(),
]

# --- 5. Tech Stack ---
story += [
    H1("5. Technology Stack"),
    P("The major choices, with the reason for each:"),
    Spacer(1, 0.1*inch),
    stack_table(
        headers=["Layer", "Choice", "Why"],
        rows=[
            ["Mobile UI", "Expo SDK 52, React Native 0.76, NativeWind 4",
             "One codebase for both iOS and Android. Native APIs available through Expo."],
            ["Mobile state", "TanStack Query 5, Zustand 5",
             "Query for server cache, Zustand for the auth store."],
            ["Server", "Next.js 15 (App Router)",
             "Route handlers without a separate Express layer. Good Vercel support."],
            ["Database", "PostgreSQL 16 with Prisma 6",
             "Relational data, schema as source of truth, RLS for tenant isolation."],
            ["Queue", "BullMQ 5 on Redis",
             "Battle tested, built in retries. Used for snapshots and background jobs."],
            ["Auth", "Argon2id passwords plus JWT plus opaque refresh tokens",
             "OWASP recommended hashing, stateless access, revocable refresh."],
            ["AI", "Local rule based advisor by default. Anthropic Claude as optional upgrade.",
             "Default is free and demoable. Anthropic available for richer replies later."],
            ["Validation", "Zod 3 shared in a workspace package",
             "Single source of truth for request and response shapes across API and mobile."],
            ["Logging", "Pino",
             "Structured JSON logs with low overhead."],
            ["Mobile SSE", "react-native-sse",
             "Works on the React Native old architecture where fetch streaming does not."],
            ["Build", "Turbo 2 plus npm workspaces",
             "Cacheable lint, typecheck, and build across the monorepo."],
            ["Hosting", "Vercel plus Neon plus Upstash plus Brevo (all free tiers)",
             "Zero cost for the demo. Standard upgrade paths if traffic grows."],
        ],
        col_widths=[1.3*inch, 2.2*inch, 3.0*inch],
    ),
    PageBreak(),
]

# --- 6. Features in Detail ---
story += [
    H1("6. Features in Detail"),
    H2("Authentication and accounts"),
    bullets([
        "Three registration modes: SOLO, ENTERPRISE_ADMIN, ENTERPRISE_EMPLOYEE.",
        "Passwords hashed with Argon2id. Every new password is checked against the HIBP breach database.",
        "Email OTP verification on first registration. Code expires in ten minutes.",
        "Login issues a JWT access token (15 minutes) and an opaque refresh token (7 days). Refresh tokens are bcrypt hashed at rest and rotated on every use.",
        "Optional TOTP two factor authentication. The secret is encrypted with AES GCM before being stored.",
        "Password reset through a six digit OTP sent to the user's email.",
    ]),
    H2("Assessment and scoring"),
    bullets([
        "46 KPIs across three levels: People (workforce hygiene), Process (operational discipline), Company (governance and risk).",
        "Each KPI has between three and five scoring tiers with concrete language so the user knows which one matches.",
        "Scores are 0 to 100 per metric. Aggregates use weighted averages.",
        "RED is below 40, AMBER is 40 to 70, GREEN is above 70.",
        "Historical snapshots are written on every recompute so the trend chart shows real progress.",
    ]),
    H2("Enterprise mode"),
    bullets([
        "Admin can invite an employee by email. The invite carries the role and the set of allowed levels.",
        "Employee accepts the invite, sets their password, and joins the organisation.",
        "Admin can change an employee's allowed levels at any time.",
        "Admin sees a team dashboard with per member completion percentage, score, and last activity.",
        "Aggregated team scorecard rolls up ORG scope KPIs with admin wins consensus when employees disagree.",
        "Soft delete for revoked employees keeps the historical answer trail intact.",
    ]),
    H2("AI advisor"),
    bullets([
        "Default is a local rule based advisor that runs entirely inside the API. Zero external cost.",
        "Detects user intent from keywords: weakest, first priority, explain level, sector threats, sector controls, and others.",
        "Replies are grounded in the actual scorecard, so the advice mentions the user's specific KPIs by name.",
        "Sector knowledge primer baked in for 8 industries: Banking, Healthcare, Technology, Manufacturing, Retail, Education, Government, Other.",
        "Streamed word by word over Server Sent Events at 40 ms per token. Looks and feels like a real LLM response.",
        "If the user wants the real Anthropic Claude, flip a single environment variable and the same code path streams from Sonnet 4.6 with prompt caching enabled. Daily budget guard prevents runaway spend.",
        "Per user rate limit of 20 messages per minute via Redis sliding window.",
    ]),
    PageBreak(),
]

# --- 7. Development Process ---
story += [
    H1("7. Development Process"),
    P(
        "The five week build was organised into five rough sprints, one per week. There was no "
        "formal Scrum or Jira. The sprints below are retrospective groupings of what actually got "
        "shipped each week, what slipped, and what was learned."
    ),
    Spacer(1, 0.1*inch),
    stack_table(
        headers=["Sprint", "Window", "Theme", "Outcome"],
        rows=[
            ["1", "15 to 21 Apr", "Bootstrap and auth",
             "Monorepo set up. Postgres schema with 21 tables. Argon2id auth with JWT plus refresh tokens. Mobile shell with onboarding, login, register, OTP screens."],
            ["2", "22 to 28 Apr", "KPI catalogue and scoring",
             "Extracted 46 KPIs from the XLSX into the database. Built the pure function scoring engine. Live dashboard with score ring. Assessment flow end to end."],
            ["3", "29 Apr to 5 May", "Enterprise mode",
             "Per user level permissions. Invite and accept invite flow. Team admin screen with per member score and edit levels."],
            ["4", "6 to 12 May", "AI chat and password reset",
             "Anthropic streaming with prompt caching. Local rule based advisor as the zero cost default. Forgot password flow with OTP email."],
            ["5", "13 to 18 May", "Production deployment and demo",
             "Vercel API live. Neon Postgres in Singapore. Upstash Redis. Brevo email. Android APK built and installed on a real phone. Cold start mitigation through external cron. Demo video recorded."],
        ],
        col_widths=[0.5*inch, 1.0*inch, 1.6*inch, 3.4*inch],
    ),
    P(
        "Estimated active development hours: about 225 hours total, or roughly 45 hours per week."
    ),
    PageBreak(),
]

# --- 8. Deployment ---
story += [
    H1("8. Deployment"),
    P(
        "The project is deployed and reachable from any internet connected device. The total "
        "monthly cost is zero because every service is on a free tier."
    ),
    Spacer(1, 0.1*inch),
    stack_table(
        headers=["Component", "Service", "Region", "Free tier limit"],
        rows=[
            ["API", "Vercel (Hobby)", "Global edge", "100 GB bandwidth"],
            ["Postgres", "Neon (Free)", "Singapore", "3 GB storage"],
            ["Redis", "Upstash (Free)", "Singapore", "10000 commands per day"],
            ["Email", "Brevo (Free)", "Global", "300 emails per day"],
            ["Mobile builds", "Expo EAS (Free)", "Cloud", "30 builds per month"],
            ["Keep warm cron", "cron-job.org (Free)", "Cloud", "Unlimited"],
        ],
        col_widths=[1.4*inch, 1.6*inch, 1.4*inch, 2.1*inch],
    ),
    H2("Important deployment design choices"),
    bullets([
        "<b>Email goes out over HTTPS, not SMTP.</b> Vercel serverless functions sometimes hang on outbound TCP for ports 465 and 587. So the API auto detects the email provider from the SMTP_PASS prefix (xkeysib for Brevo, re_ for Resend) and routes through that provider's REST API instead. Reliable and fast (around 200 ms per send).",
        "<b>Emails are sent inline, not queued.</b> Originally the email worker was a separate process draining BullMQ jobs from Redis. On Vercel there is no worker process, so jobs were piling up forever. I patched the queue helpers to call sendEmail directly. The function names stay the same so every caller works as before.",
        "<b>External cron keeps the API warm.</b> Vercel Hobby tier shuts down idle serverless functions after about five minutes. The first request after idle pays a 5 to 10 second cold start. A free cron at cron-job.org pings the health endpoint every two minutes. Cold start tax drops to about 200 ms.",
        "<b>Demo user is seeded by a script.</b> A small TypeScript script (apps/api/scripts/seed-demo-user.ts) plants the verified demo user against any DATABASE_URL using env vars. Idempotent. Used to populate the live Neon database.",
    ]),
    H2("Updates"),
    P(
        "Every push to the main branch triggers a Vercel auto deploy. Build takes about three "
        "minutes. Database migrations are run manually from my laptop with "
        "<font face='Courier'>prisma migrate deploy</font> so that no preview deployment can touch "
        "production schema by accident."
    ),
    PageBreak(),
]

# --- 9. Testing ---
story += [
    H1("9. Testing Approach"),
    P(
        "Honest framing: there is no automated test suite in this version. Vitest is wired up "
        "in the API workspace but the test directories are empty. This is the single largest "
        "gap in the project. It is documented in the known issues file and called out as the "
        "first priority for the next batch."
    ),
    P(
        "What is in place instead:"
    ),
    bullets([
        "<b>Manual smoke test.</b> A scripted five minute walkthrough that covers the critical paths: onboarding, login, dashboard, assessment, scorecard, AI chat, password reset. Documented in docs/testing-manual.md. Run before every release.",
        "<b>Manual full regression.</b> A thirty minute test plan covering all major flows. Run before tagging a new version.",
        "<b>Live curl based health checks.</b> Direct API tests against the production endpoint with expected JSON shapes. Documented in docs/testing-manual.md.",
        "<b>Strict TypeScript and Zod schemas.</b> The build catches a huge class of bugs before runtime. Not a substitute for tests but a real layer of defence.",
    ]),
    P(
        "Priority test targets when the next batch starts writing tests:"
    ),
    bullets([
        "lib/scoring.ts (pure functions, easy wins, high value)",
        "lib/scorecard.ts (pure aggregation logic)",
        "lib/access.ts (small but security critical)",
        "lib/auth.ts (token issue and revoke)",
        "Route handlers as integration tests with a Postgres test database",
    ]),
]

# --- 10. Challenges and Lessons Learned ---
story += [
    PageBreak(),
    H1("10. Challenges and Lessons Learned"),
    H2("Challenge 1: Vercel deployment ran into five distinct failures"),
    P(
        "What I expected to be a thirty minute deploy turned into four hours of chasing five "
        "different problems in sequence. Each one was a new error that I had not seen before."
    ),
    bullets([
        "Next.js 15.1.3 with React 19 had a known issue rendering the /404 page. Fix: added explicit not-found.tsx and pages/_error.tsx files.",
        "Vercel blocked the deploy because my git commit author email did not match the Vercel account email. Fix: rewrote git history with git filter-branch and force pushed.",
        "TypeScript ran on the scripts directory and tripped on a loose bcrypt import. Fix: added scripts to the tsconfig exclude list.",
        "Type errors only showed up on Vercel's clean install because of different module resolution. Fix: turned off Next's built in TS and ESLint checks (we already run them in Turbo).",
        "Vercel security blocked the deploy with CVE-2025-66478 in next 15.1.3. Fix: upgraded next to 15.5.18.",
    ]),
    P("<b>Lesson:</b> deploy to the target on day two of the project, not week five. Cold debugging a stack you have never deployed against is painful and slow."),
    H2("Challenge 2: macOS Gatekeeper blocked Android Studio"),
    P(
        "I tried to install Android Studio so that I could build the APK locally. macOS Gatekeeper "
        "refused to open the app and said it was damaged. I spent ninety minutes trying various "
        "xattr commands and System Settings tricks. None of them worked."
    ),
    P(
        "Then I realised that I did not need Android Studio at all. Expo's EAS Build does the "
        "entire Android build in the cloud. I deleted Android Studio, set up EAS, and had a "
        "working APK twenty minutes later."
    ),
    P("<b>Lesson:</b> before going deep on a fix, ask yourself if you even need this thing. The Gatekeeper issue was solvable but I did not need to solve it. Knowing what not to do is half the battle."),
    H2("Challenge 3: Email sending was harder than expected"),
    P(
        "First attempt used Resend. Worked perfectly in curl tests. Then I read the fine print: "
        "Resend's free tier only delivers to the account owner's own email. Useless for a multi "
        "user demo where the supervisor needs to receive an email too."
    ),
    P(
        "Pivoted to Brevo (300 emails per day free, no recipient restriction). Then hit another "
        "problem: Vercel was throttling raw SMTP on ports 465 and 587. Switched to the HTTP API "
        "and everything started working."
    ),
    P("<b>Lesson:</b> read the free tier restrictions of every SaaS before you integrate. Free does not always mean useful. And for serverless, always pick HTTP over SMTP."),
    H2("Challenge 4: Cold start lag was killing the demo"),
    P(
        "After the API was deployed and the APK was installed, every screen transition felt "
        "like the app was hanging for five to fifteen seconds. It looked broken on camera."
    ),
    P(
        "Root cause: Vercel Hobby tier shuts down idle serverless functions after about five "
        "minutes. The first request after idle paid a long cold start tax. Combined with React "
        "Query's default retry behaviour, the user experience was unusable."
    ),
    P(
        "Fix: a free external cron at cron-job.org pings /api/v1/health every two minutes. The "
        "functions never go idle so the cold start tax never happens. Cost: zero rupees. Effect: "
        "the app feels instant."
    ),
    P("<b>Lesson:</b> serverless cold starts are real and they bite hard on free tiers. Always have a keep warm strategy from day one."),
    PageBreak(),
    H2("Other lessons that would save the next batch time"),
    bullets([
        "Strict TypeScript from day one. The first week is annoying. After that, every refactor catches dozens of bugs at compile time. Never starting a new project without it.",
        "Single source of truth for schemas. Putting Zod schemas in a shared workspace package and importing them from both API and mobile saved hours of request shape drift debugging.",
        "Dev mode escape hatches are gold. Returning OTPs inline in API responses when NODE_ENV is development meant local development did not depend on a working SMTP server. Worth replicating in every flow that involves an external service.",
        "When Plan A fails, switch to Plan B. The Android Studio incident is the canonical example. If a non critical path problem is taking more than fifteen or twenty minutes, ask yourself if you can route around it.",
        "Test perceived latency from a real phone, not just API response time. My curl tests all returned in 200 ms. The cold start only showed up when I actually used the app on a phone.",
    ]),
]

# --- 11. Known Limitations ---
story += [
    H1("11. Known Limitations"),
    P("In order of how much they matter:"),
    bullets([
        "<b>No automated tests.</b> Vitest is wired up but the test directories are empty. Manual testing covers smoke and regression flows. This is the single biggest gap.",
        "<b>No CI pipeline.</b> Lint and typecheck run only when I remember to run them locally. Vercel build catches type errors but does not run my Turbo pipeline. Templates exist in docs/deployment.md for the next batch to wire up.",
        "<b>Vercel cold starts are mitigated, not eliminated.</b> The keep warm cron stops most of them, but some less common routes can still cold start on first hit after a long pause. Upgrade to Vercel Pro to eliminate completely.",
        "<b>R2 evidence uploads not wired.</b> The schema and routes exist but the R2 credentials are placeholders. Real bucket and CORS policy needed.",
        "<b>Push notifications dormant.</b> The table, the worker, the SDK plumbing all exist but no admin UI triggers them.",
        "<b>PDF export not built.</b> The email worker has a SCORECARD_PDF job type defined but no PDF rendering code yet.",
        "<b>Brevo free tier rewrites the sender email to a generic relay domain.</b> Display name CyMetric is preserved but the technical from address contains my name (a side effect of using a freemail account). A custom verified domain or sender would clean this up.",
        "<b>No staging environment.</b> One production database and one production deployment. Add a staging Neon branch plus a Vercel preview before the next major change.",
    ]),
]

# --- 12. Future Work ---
story += [
    H1("12. Future Work"),
    P(
        "What the next batch should pick up, in rough priority order. Detailed roadmap in "
        "docs/roadmap.md."
    ),
    H2("Highest priority"),
    bullets([
        "Write tests for lib/scoring.ts, lib/scorecard.ts, lib/access.ts, lib/auth.ts. Target 60 percent coverage minimum.",
        "Wire up GitHub Actions CI to run lint, typecheck, and tests on every pull request.",
        "Set up Sentry for error tracking. Free tier is enough. DSN goes in the SENTRY_DSN env var.",
        "Verify all RLS policies under realistic multi tenant load before opening up to real customers.",
        "Set up a staging environment on a separate Neon branch.",
    ]),
    H2("Near term features"),
    bullets([
        "Push notifications wired end to end (admin triggers and scheduled engagement pushes).",
        "Scorecard PDF export through the email worker.",
        "Multi framework view toggle (currently the app shows scores under the selected framework only).",
        "Industry benchmarks surfaced on the scorecard (the table exists, just needs UI).",
        "Per employee snapshot history so employees see their own trend lines.",
        "CSV export of the team scorecard.",
    ]),
    H2("Bigger items"),
    bullets([
        "Single Sign On (OIDC plus SAML) for enterprise customers.",
        "Continuous re assessment (prompt users to refresh stale answers periodically).",
        "Compliance report templates (filled SOC 2 or ISO 27001 checklists from the scorecard).",
        "Webhook subscriptions for events like scorecard recomputed or member removed.",
        "A read only web dashboard for desk based viewing.",
    ]),
    PageBreak(),
]

# --- 13. Conclusion ---
story += [
    H1("13. Conclusion"),
    P(
        "CyMetric started as a five week capstone and ended as a real, working, deployed "
        "product. The mobile app installs on a real Android phone. The API runs on Vercel. The "
        "database lives in Singapore. Emails arrive in real inboxes. The full happy path works "
        "end to end."
    ),
    P(
        "What I am most proud of is that the architecture is clean enough that a new developer "
        "can pick it up without three weeks of onboarding. The schemas are shared between API "
        "and mobile. The scoring logic lives in pure functions. The auth is built on standard "
        "primitives. RLS is in place. The local advisor was a thoughtful response to a budget "
        "constraint rather than a hack."
    ),
    P(
        "What I am most aware of is that there are no tests. That is the next batch's first "
        "task and I would do it myself if I had another week."
    ),
    P(
        "Thanks to Mohan Ram C for the mentorship, especially the conversation about the chat "
        "advisor that led to the sector knowledge primer design. The product is better for it."
    ),
]

# --- 14. References ---
story += [
    H1("14. References and Links"),
    Spacer(1, 0.1*inch),
    info_table([
        ["Live API", "https://cyberscore-api.vercel.app"],
        ["Health check", "https://cyberscore-api.vercel.app/api/v1/health"],
        ["GitHub repository", "https://github.com/saanvivishal/cyberscore"],
        ["Demo video", "Hosted on IIIT Bangalore SharePoint (link in handover email)"],
        ["Demo login email", "saanvi.vishal@iiitb.ac.in"],
        ["Demo login password", "cyberscore-demo-2026"],
        ["Repository documentation index", "README.md plus docs/ folder"],
        ["Handover checklist", "HANDOVER_CHECKLIST.md"],
        ["Sprint history", "docs/sprints.md"],
        ["Architecture", "docs/architecture.md"],
        ["System design", "docs/system-design.md"],
        ["Database schema and ER diagram", "docs/database.md"],
        ["Requirements (FR, NFR, SR)", "docs/requirements.md"],
        ["Deployment runbook", "docs/deployment.md"],
        ["Known issues", "docs/known-issues.md"],
        ["Future roadmap", "docs/roadmap.md"],
        ["Access and credentials", "docs/access-credentials.md"],
        ["Handover notes (key decisions, lessons)", "docs/handover-notes.md"],
        ["Manual test plan", "docs/testing-manual.md"],
        ["CHANGELOG", "CHANGELOG.md"],
        ["Contributing guide", "CONTRIBUTING.md"],
    ]),
]

# ======= PART 2: SLIDES OUTLINE =======
story += [
    PageBreak(),
    P("PART TWO", "Caption"),
    P("Presentation Slides Outline", "TitleBig"),
    P("Six slides for a 10 to 15 minute talk", "Subtitle"),
    Spacer(1, 0.2*inch),
    P(
        "Each slide below shows the title, the bullet points to put on the slide, and a short "
        "speaker note for what to say while that slide is up. Keep slide text minimal so the "
        "audience listens to you, not reads at you. Use the demo video as the centerpiece.",
        "Body"
    ),
    Spacer(1, 0.2*inch),
]

# --- Slide 1 ---
story += [
    P("Slide 1: Title", "SlideTitle"),
    P("<b>Title:</b> CyMetric: A Cybersecurity Health Scorecard for Organisations", "Body"),
    P("<b>On the slide:</b>", "Body"),
    bullets([
        "Project name in large type: CyMetric",
        "Tagline: Self assessment cybersecurity in your pocket",
        "Your name and roll number: Saanvi Vishal, IMT2021043",
        "Mentor: Mohan Ram C, FISST",
        "Institution: International Institute of Information Technology, Bangalore",
        "Date of the presentation",
    ]),
    P("<b>Speaker note (about 30 seconds):</b>", "Body"),
    P(
        "Introduce yourself, name the project, name the mentor and the institution. Say one "
        "sentence about what CyMetric is, for example: a mobile app that lets a company "
        "check its cybersecurity health in thirty minutes and get specific advice on what to "
        "fix next.",
        "Quote"
    ),
]

# --- Slide 2 ---
story += [
    P("Slide 2: Problem and Solution", "SlideTitle"),
    P("<b>Title:</b> The Problem, and What CyMetric Does", "Body"),
    P("<b>On the slide (left half: the problem):</b>", "Body"),
    bullets([
        "Small and mid size companies do not know how good their cybersecurity is.",
        "They have no CISO, no consultant, no usable checklist.",
        "Result: either ignore the problem or panic buy tools.",
    ]),
    P("<b>On the slide (right half: the solution):</b>", "Body"),
    bullets([
        "Mobile app, 30 minute self assessment, 46 questions.",
        "Score across three areas: People, Process, Company.",
        "AI advisor that knows your actual score and your industry.",
        "Two modes: SOLO (single user) and ENTERPRISE (admin plus employees).",
    ]),
    P("<b>Speaker note (about 90 seconds):</b>", "Body"),
    P(
        "Describe the problem in plain language. A founder running a fintech startup with five "
        "engineers cannot afford a security audit. They know they should do something but they "
        "do not know what. CyMetric is a structured self assessment that gives them a score, "
        "shows them where they are weak, and tells them the next three actions. It is not a "
        "replacement for a real audit, but it is a cheap and useful first step.",
        "Quote"
    ),
]

# --- Slide 3 ---
story += [
    PageBreak(),
    P("Slide 3: Architecture and Tech Stack", "SlideTitle"),
    P("<b>Title:</b> How It Is Built", "Body"),
    P("<b>On the slide (one architecture diagram on top):</b>", "Body"),
    P(
        "Show the system context diagram from docs/architecture.md. Mobile app on the left, "
        "API in the middle, Postgres and Redis on the right, plus arrows to Brevo for email "
        "and Anthropic or Local Advisor for AI.",
        "Body"
    ),
    P("<b>On the slide (tech stack list below the diagram):</b>", "Body"),
    bullets([
        "Mobile: React Native with Expo SDK 52",
        "API: Next.js 15 (App Router) on Vercel",
        "Database: PostgreSQL 16 with Prisma (RLS for tenant isolation)",
        "Cache and queue: Redis on Upstash",
        "AI: local rule based advisor (default) or Anthropic Claude (optional)",
        "Auth: Argon2id passwords plus JWT plus refresh tokens",
        "Shared types: Zod schemas in a workspace package",
    ]),
    P("<b>Speaker note (about 90 seconds):</b>", "Body"),
    P(
        "Walk the audience through the diagram once. Mobile talks to API over HTTPS. API talks "
        "to Postgres and Redis. API talks to the email service over HTTPS. Then highlight two "
        "design choices: one, it is a modular monolith because a single developer cannot "
        "maintain microservices, and two, every secret is shared between API and mobile through "
        "a single Zod schema package so there is no drift.",
        "Quote"
    ),
]

# --- Slide 4 ---
story += [
    P("Slide 4: What Got Built (Demo)", "SlideTitle"),
    P("<b>Title:</b> Live Demo", "Body"),
    P("<b>On the slide (one or two big screenshots):</b>", "Body"),
    bullets([
        "Screenshot of the dashboard with the score ring",
        "Screenshot of the AI chat with a sector specific answer",
        "QR code or short URL pointing to the demo video on OneDrive",
    ]),
    P("<b>On the slide (very short feature list):</b>", "Body"),
    bullets([
        "Onboarding plus auth (Argon2id, JWT, OTP, optional TOTP)",
        "46 KPI assessment with live score updates",
        "Per employee level permissions in ENTERPRISE mode",
        "AI advisor grounded in the user's actual scorecard",
        "Historical trend chart and personalised suggestions",
        "Password reset by email through Brevo",
    ]),
    P("<b>Speaker note (about 4 to 5 minutes, play the demo):</b>", "Body"),
    P(
        "Play the demo video. Talk over the top of it for any parts that need explanation. "
        "Highlight three things during playback: one, the onboarding gives a clean first "
        "impression. Two, every action updates the scorecard live. Three, the AI advisor "
        "mentions specific KPIs by name because it has the real scorecard data in its context.",
        "Quote"
    ),
]

# --- Slide 5 ---
story += [
    PageBreak(),
    P("Slide 5: Deployment and Process", "SlideTitle"),
    P("<b>Title:</b> Live in Production at Zero Cost", "Body"),
    P("<b>On the slide (left column: what is deployed):</b>", "Body"),
    bullets([
        "API: Vercel Hobby (free), at cyberscore-api.vercel.app",
        "Database: Neon Postgres in Singapore (free, 3 GB)",
        "Cache: Upstash Redis in Singapore (free, 10k commands per day)",
        "Email: Brevo HTTP API (free, 300 emails per day)",
        "Mobile: APK built and distributed through Expo EAS",
        "Keep warm: external cron pings every 2 minutes (free)",
        "<b>Total monthly cost: zero rupees</b>",
    ]),
    P("<b>On the slide (right column: how I built it):</b>", "Body"),
    bullets([
        "Five weekly sprints, single developer",
        "Sprint 1: bootstrap and auth",
        "Sprint 2: KPI catalogue and scoring",
        "Sprint 3: enterprise mode and team management",
        "Sprint 4: AI chat (Anthropic plus local advisor)",
        "Sprint 5: production deployment and demo",
        "About 225 active development hours total",
    ]),
    P("<b>Speaker note (about 90 seconds):</b>", "Body"),
    P(
        "The deployment story is something I am proud of because it works end to end on free "
        "tiers. Mention the cold start mitigation: Vercel idles functions after five minutes, "
        "so I set up a free external cron to ping the health endpoint every two minutes. This "
        "keeps the app feeling fast without paying for Vercel Pro. Then walk through the five "
        "sprints in one line each.",
        "Quote"
    ),
]

# --- Slide 6 ---
story += [
    P("Slide 6: Lessons Learned and Thanks", "SlideTitle"),
    P("<b>Title:</b> What I Learned and What Comes Next", "Body"),
    P("<b>On the slide (lessons, three or four bullets):</b>", "Body"),
    bullets([
        "Deploy on day two, not week five. Cold debugging a stack you have never deployed against is painful.",
        "Read the free tier fine print before you integrate. Free does not always mean useful.",
        "For serverless, pick HTTP APIs over SMTP. Outbound TCP is unreliable.",
        "Strict TypeScript plus shared Zod schemas paid back the setup cost in week one.",
    ]),
    P("<b>On the slide (what is left):</b>", "Body"),
    bullets([
        "Write tests (vitest is wired, directories are empty)",
        "Wire GitHub Actions CI",
        "Push notifications and scorecard PDF export",
        "Sentry for error tracking",
    ]),
    P("<b>On the slide (thanks):</b>", "Body"),
    bullets([
        "Mohan Ram C for the mentorship and the sector primer idea that shaped the AI advisor design",
        "IIIT Bangalore for the platform",
        "Q and A",
    ]),
    P("<b>Speaker note (about 90 seconds):</b>", "Body"),
    P(
        "Be honest about what is not done. No tests. No CI. Both go in the roadmap. Then close "
        "with a real thank you to your mentor and offer to take questions. If the audience is "
        "engaged, this is where the conversation gets interesting.",
        "Quote"
    ),
]

# --- Final tips ---
story += [
    PageBreak(),
    H1("Tips for Delivering the Presentation"),
    bullets([
        "Keep slide text short. The audience should listen to you, not read at you.",
        "Spend most of the time on slide 4 (the demo). The video is the strongest part of the project.",
        "Practice running the demo video at least twice before the real presentation. Know where to pause and add commentary.",
        "If the demo video link does not load on the day, have the APK installed on your own phone as a backup and project that screen.",
        "Be honest about the gaps (no tests, no CI). Supervisors respect honesty more than false polish.",
        "Have the GitHub link and the handover checklist ready in a browser tab in case anyone asks for code or documentation during questions.",
    ]),
    Spacer(1, 0.4*inch),
    hr(),
    Spacer(1, 0.2*inch),
    P("End of document. Saanvi Vishal, 18 May 2026.", "Caption"),
]

# ----------------------------------------------------------------------
# Build PDF
# ----------------------------------------------------------------------
def _on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    if doc.page > 1:
        canvas.drawString(0.75*inch, 0.4*inch, f"CyMetric. Final report and slides. Page {doc.page}.")
        canvas.drawRightString(LETTER[0] - 0.75*inch, 0.4*inch, "Saanvi Vishal, IIIT Bangalore")
    canvas.restoreState()

doc = SimpleDocTemplate(
    OUT, pagesize=LETTER,
    leftMargin=0.85*inch, rightMargin=0.85*inch,
    topMargin=0.85*inch, bottomMargin=0.7*inch,
    title="CyMetric: Final Report and Slides Outline",
    author="Saanvi Vishal",
    subject="Capstone handover documentation",
)
doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
print(f"Wrote: {OUT}")
