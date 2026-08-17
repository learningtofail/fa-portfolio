// Single source of truth for portfolio content — the page (src/pages/index.astro)
// and the PDF export (scripts/generate-pdf.mjs) both read from this file, so the
// two can't drift apart. Sourced from the approved Phase 2 portfolio copy
// (claude/phase-2-portfolio-copy.md in the project docs).

export const meta = {
  title: "Faysal Ahmed — VP of SEO & Organic Growth",
  description: "22 years turning organic search into a growth engine — technical SEO, marketing analytics, and embedded product leadership, in-house and agency.",
};

export const summary = {
  name: "Faysal Ahmed",
  headline: "VP of SEO & Organic Growth",
  subhead: "22 years turning organic search into a growth engine — technical SEO, marketing analytics, and embedded product leadership, in-house and agency.",
  // Off by default so the build never references a file that doesn't exist yet.
  // To add a real photo (Phase 9): drop it at public/headshot.jpg — square-ish
  // crop, at least 480x480, shoulders-up — then flip enabled to true.
  headshot: { enabled: false, src: "/headshot.jpg", alt: "Faysal Ahmed" },
  body: [
    "Digital marketing and SEO professional with 22 years of experience driving organic growth at scale. Career spans independent consulting, agency work at Cardinal Path and Merkle Cardinal Path, regulated-industry marketing at Klick Health, and in-house Director-level leadership at Canada's largest automotive marketplace, AutoTrader.ca.",
    "Distinctive combination of deep technical SEO expertise, marketing analytics fluency, and hands-on product management for engineering teams. Currently targeting VP of SEO, PM/SEO Growth, Director of Digital Marketing, or Director of Marketing Analytics roles — open to in-house and agency, with a preference for SaaS, technology, and marketplace environments.",
  ],
  stats: [
    "22 years since 2004",
    "10M+ monthly sessions owned",
    "~$400K annual budget managed",
    "Top-3 rankings, >90% of Canadian markets",
  ],
};

export const experience = [
  {
    company: "Trader Corporation (AutoTrader.ca & AutoHebdo.net)",
    location: "Mississauga, ON",
    role: "Director, SEO — Consumer Marketing & Organic Product Lead",
    dates: "June 2023 – June 2026",
    intro: "Recruited to reverse a 20–25% year-over-year organic traffic decline at Canada's largest automotive marketplace. Operated at the intersection of technical product management, engineering governance, and multi-channel marketing across 5–6M indexed URLs and 10M+ monthly sessions on both the English (autotrader.ca) and French (autohebdo.net) properties.",
    bulletGroups: [
      {
        label: "Scope & leadership",
        bullets: [
          "Embedded Product Manager for a dedicated SEO engineering squad of up to 6 (engineering lead, developers, QA), owning roadmap via Stack Rank governance and directing sprint backlogs and architecture via Jira/Confluence.",
          "Owned an annual SEO operating budget of approximately CAD $400,000; terminated legacy BrightEdge contracts and provisioned seoClarity, Ahrefs, and Semrush Enterprise in their place.",
          "Unified organic and paid search on landing page architecture and intent-matching; directed editorial roadmap to maximize organic conversion.",
        ],
      },
      {
        label: "Results",
        bullets: [
          "Remediated a broken hreflang and canonicalization architecture across the entire marketplace — top-3 organic ranking for core non-branded categories (SUV, car, hatchback) across virtually every Canadian city, town, and province, more than 90% of the time (Q3 2025–June 2026).",
          "Re-engineered internal linking from a static 20–30 city model to a fully dynamic, multi-dimensional framework (brand, body type, features, price), eliminating crawl opacity and indexing tens of thousands of previously orphaned pages.",
          "Led two end-to-end CMS migrations — Umbraco v7/8 to Headless Umbraco v13, and Umbraco to Contently — with zero organic traffic loss.",
          'Brought Core Web Vitals to Google "Good" status on Homepage, VSRP, and VDP templates: LCP from 6s to <2.5s, CLS from 0.3 to 0.1.',
        ],
      },
    ],
    closing: "AutoScout24 acquired Trader Corporation at the end of 2024. The Canadian SEO engineering squad was sunset and merged into European engineering during a 2025–2026 restructuring; left cleanly on June 24, 2026, concluding a successful 3-year tenure.",
  },
  {
    company: "Self-Employed — Independent Digital Marketing Consultant",
    location: "",
    role: "",
    dates: "April 2007 – April 2019, and June 2023 – Present (concurrent with Trader Corporation, disclosed to employer of record)",
    bulletGroups: [
      {
        bullets: [
          "Grew qualified leads for an e-commerce retail client from ~20/month to 120+ (+500%) within 6–12 months by rebuilding conversion funnels and correcting checkout errors.",
          "Cut campaign management costs by over 34% by building automated Python data extraction to replace manual tracking with real-time dashboarding.",
          "Ran targeted UX/CRO A/B testing programs, improving conversion rates by up to 250%.",
          "Led technical SEO and compliance web development for clients in strictly regulated spaces (cannabis, vaping), maximizing visibility under federal advertising restrictions.",
          "Delivered technical SEO and web development for a global eSIM travel connectivity platform.",
        ],
      },
    ],
  },
  {
    company: "Merkle Cardinal Path",
    location: "Toronto, ON (Remote)",
    role: "Senior Consultant, Digital Marketing / Analysis & Insights",
    dates: "June 2019 – July 2022",
    bulletGroups: [
      {
        bullets: [
          "Led and mentored a team of digital consultants on enterprise technical, on-page, and off-page search projects.",
          "Facilitated the largest enterprise SEO contract in company history — a multinational pharmaceutical engagement won on combined technical SEO and FDA/PAAB regulatory expertise.",
          "Designed cross-functional programs integrating organic and paid search budgets; built custom Core Web Vitals (RUM) capture, and real-time dashboards in Power BI, Tableau, and Data Studio.",
          "Awarded Q4 2021 Innovation & Collaboration Award for cross-functional dashboard development and sales enablement.",
        ],
      },
    ],
  },
  {
    company: "Klick Health",
    location: "Greater Toronto Area, ON",
    role: "Manager, Digital Marketing / SEO",
    dates: "April 2018 – June 2019",
    bulletGroups: [
      {
        bullets: [
          "Built automated ETL and Python reporting processes, eliminating over $60,000/year in redundant software licensing.",
          "Engineered schema markup and data-layer configurations to support pharmaceutical compliance audits against FDA, Health Canada, and PAAB regulations.",
          "Shaped digital strategy for a major global pharmaceutical company's blockbuster gastrointestinal brand, sustaining patient and HCP organic acquisition under strict regulatory limits.",
        ],
      },
    ],
  },
  {
    company: "Cardinal Path",
    location: "Toronto, ON (Hybrid)",
    role: "Staff Consultant / Trainer, Digital Marketing & Analytics",
    dates: "December 2015 – April 2018",
    bulletGroups: [
      {
        bullets: [
          "Built paid and organic search strategies that grew organic traffic +150% and qualified leads +60% year-over-year.",
          "Led adoption of unified reporting workflows, recovering 300+ billable hours per consultant annually across a 7-client enterprise portfolio.",
          "Led international/bilingual SEO for a global financial services firm, resolving overlapping regional subdomain and hreflang conflicts across English, French, and German.",
          "Designed and delivered analytics and search optimization workshops for the Cardinal Path Training Academy.",
        ],
      },
    ],
  },
  {
    company: "Orkin Canada",
    location: "Mississauga, ON",
    role: "Digital Marketing Coordinator (De Facto Digital Lead)",
    dates: "May 2013 – November 2015",
    bulletGroups: [
      {
        bullets: [
          "Owned the complete digital presence for a ~1,000-domain acquired subsidiary (EnviroLogic), including hosting, analytics, and bilingual platform assets.",
          "Managed an annual paid search budget of ~CAD $60,000 for subsidiary properties.",
          "Built customer data matching and deduplication models to identify unacquired commercial targets, fueling territory-based field sales.",
          "Led bilingual (EN/FR) web publishing and localization workflows across national properties.",
        ],
      },
    ],
  },
  {
    company: "Early Career",
    location: "",
    role: "",
    dates: "2004 – 2013",
    prose: "Foundation years spanning freelance graphic design and web development, a marketing coordinator contract rebuilding a firm's web infrastructure on WordPress, and early roles in technical support and client services.",
  },
];

export const skills = [
  {
    category: "Technical SEO & Localization",
    items: "Crawl & indexation, site architecture, canonicalization, hreflang & internationalization at enterprise scale, Core Web Vitals (LCP, CLS, INP), JS rendering optimization, schema markup, faceted navigation. Tools: Google Search Console, Screaming Frog, Lumar (DeepCrawl), Ryte, plus the certified platforms below.",
  },
  {
    category: "Analytics & BI",
    items: "GA4/UA, Adobe Analytics, Piwik/Matomo, Looker Studio, Looker, Power BI, Tableau, GTM, A/B testing & statistical CRO analysis.",
  },
  {
    category: "Data & Scripting",
    items: "Python (automation, ETL, API connectors), SQL, BigQuery, advanced Excel.",
  },
  {
    category: "Product & Operations",
    items: "Jira & Confluence sprint administration, Stack Rank executive business cases, SOW/WBS scheduling, Agile workflow governance, cross-functional leadership.",
  },
  {
    category: "Regulated Marketing",
    items: "PAAB, Health Canada, and FDA compliance marketing; CASL & GDPR compliance strategy.",
  },
  {
    category: "Development & Platforms",
    items: "HTML, CSS, PHP, JavaScript, headless architectures, Umbraco (v7/8 and Headless v13), Contently, WordPress.",
  },
  {
    category: "Languages",
    items: "Professional working proficiency in French (Humber College certificate).",
  },
  {
    category: "Certifications",
    items: "Ahrefs, SEMrush, SEO Clarity, BrightEdge (platform certifications). Humber College: Business Administration Diploma, Marketing Diploma, Business Analyst Certificate, Project Management Certificate.",
  },
];

export const toolsIntro = "A few things built to put this skill set to work: live, interactive, and client-side — nothing you upload leaves your browser.";

export const contact = {
  name: "Faysal Ahmed",
  location: "Mississauga, Ontario, Canada",
  email: "contactfaysal@gmail.com",
  linkedin: "linkedin.com/in/faysalahmed",
  linkedinUrl: "https://linkedin.com/in/faysalahmed",
  phone: "(647) 234-8739",
};
