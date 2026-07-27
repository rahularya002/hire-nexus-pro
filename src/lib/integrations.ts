import {
  Calendar,
  Video,
  MessageCircle,
  Mail,
  MessageSquare,
  Slack,
  CalendarCheck,
  FileSignature,
  CreditCard,
  FileText,
  Briefcase,
  Database,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type IntegrationKind = "connector" | "secret" | "builtin";
export type IntegrationCategory =
  | "comms"
  | "scheduling"
  | "video"
  | "docs"
  | "billing"
  | "ats"
  | "enrichment"
  | "backend";

export type Integration = {
  id: string;
  label: string;
  description: string;
  category: IntegrationCategory;
  kind: IntegrationKind;
  icon: LucideIcon;
  /** Secret names to probe server-side. ANY of these present → considered connected. */
  envVars?: string[];
  /** Lovable connector id (for kind='connector'). */
  connectorId?: string;
  /** False → render Lock + "soon" (no wiring yet). */
  hasIntegration: boolean;
  /** Short hint shown under the row, e.g. setup tip. */
  docsHint?: string;
};

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  comms: "Communications",
  scheduling: "Scheduling",
  video: "Video conferencing",
  docs: "Documents & signing",
  billing: "Billing",
  ats: "ATS sync",
  enrichment: "Enrichment & parsing",
  backend: "Backend services",
};

export const INTEGRATIONS: Integration[] = [
  // Backend services (existing)
  {
    id: "apify",
    label: "Apify",
    description: "Runs sourcing actors for LinkedIn, GitHub, and other channels.",
    category: "backend",
    kind: "connector",
    icon: Database,
    connectorId: "apify",
    envVars: ["APIFY_API_KEY"],
    hasIntegration: true,
    docsHint: "Connected via the Apify connector — calls route through the Lovable gateway.",
  },
  {
    id: "lovable_ai",
    label: "Lovable AI",
    description: "Ranks sourced candidates against the JD using Gemini.",
    category: "backend",
    kind: "builtin",
    icon: Sparkles,
    envVars: ["LOVABLE_API_KEY"],
    hasIntegration: true,
    docsHint: "Managed by Lovable Cloud — no setup required.",
  },

  // Communications
  {
    id: "email",
    label: "Email (sender)",
    description: "Outbound email to candidates and clients (offers, threads, reminders).",
    category: "comms",
    kind: "builtin",
    icon: Mail,
    envVars: ["RESEND_API_KEY"],
    hasIntegration: true,
    docsHint: "Use Lovable Emails (built-in) or connect Resend.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp Business",
    description: "Candidate outreach and interview reminders via WhatsApp Cloud API.",
    category: "comms",
    kind: "secret",
    icon: MessageCircle,
    envVars: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    hasIntegration: true,
    docsHint: "Requires Meta Business app + phone number ID + access token.",
  },
  {
    id: "twilio_sms",
    label: "Twilio SMS",
    description: "SMS reminders and OTP-style nudges where WhatsApp isn't allowed.",
    category: "comms",
    kind: "connector",
    icon: MessageSquare,
    connectorId: "twilio",
    hasIntegration: false,
    docsHint: "Coming soon.",
  },
  {
    id: "slack",
    label: "Slack",
    description: "Internal team notifications (new candidate, interview booked, offer accepted).",
    category: "comms",
    kind: "connector",
    icon: Slack,
    connectorId: "slack",
    hasIntegration: false,
    docsHint: "Coming soon.",
  },

  // Scheduling
  {
    id: "google_calendar",
    label: "Google Calendar + Meet",
    description: "Schedules interviews and auto-generates Meet links on each event.",
    category: "scheduling",
    kind: "connector",
    icon: Calendar,
    connectorId: "google_calendar",
    hasIntegration: true,
    docsHint: "Connect via Lovable Cloud → Connectors → Google Calendar.",
  },
  {
    id: "microsoft_outlook",
    label: "Outlook Calendar + Teams",
    description: "Calendar + Teams meeting link for clients on Microsoft 365.",
    category: "scheduling",
    kind: "connector",
    icon: Calendar,
    connectorId: "microsoft_outlook",
    hasIntegration: true,
    docsHint: "Connect via Lovable Cloud → Connectors → Microsoft Outlook.",
  },
  {
    id: "calendly",
    label: "Calendly / Cal.com",
    description: "Let candidates self-book interview slots instead of manual scheduling.",
    category: "scheduling",
    kind: "secret",
    icon: CalendarCheck,
    envVars: ["CALENDLY_API_TOKEN"],
    hasIntegration: false,
    docsHint: "Coming soon.",
  },

  // Video
  {
    id: "zoom",
    label: "Zoom",
    description: "Alternative video link on interviews for clients who prefer Zoom.",
    category: "video",
    kind: "secret",
    icon: Video,
    envVars: ["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET"],
    hasIntegration: true,
    docsHint: "Server-to-server OAuth: account id + client id + client secret.",
  },

  // Documents
  {
    id: "docusign",
    label: "DocuSign",
    description: "Send offer letters and client agreements for e-signature.",
    category: "docs",
    kind: "secret",
    icon: FileSignature,
    envVars: ["DOCUSIGN_INTEGRATION_KEY", "DOCUSIGN_SECRET"],
    hasIntegration: false,
    docsHint: "Coming soon.",
  },

  // Billing
  {
    id: "stripe",
    label: "Stripe",
    description: "Powers client billing, invoices, and payment links.",
    category: "billing",
    kind: "secret",
    icon: CreditCard,
    envVars: ["STRIPE_SECRET_KEY"],
    hasIntegration: true,
    docsHint: "Configured per-workspace via Lovable Cloud secrets.",
  },

  // ATS
  {
    id: "ats_sync",
    label: "ATS sync (Greenhouse / Lever / Ashby)",
    description: "One-way push of submitted candidates into the client's ATS.",
    category: "ats",
    kind: "secret",
    icon: Briefcase,
    hasIntegration: false,
    docsHint: "Coming soon.",
  },

  // Enrichment
  {
    id: "resume_parser",
    label: "Resume parser",
    description: "Extract structured fields from uploaded resumes (Affinda / Rchilli).",
    category: "enrichment",
    kind: "secret",
    icon: FileText,
    hasIntegration: false,
    docsHint: "Coming soon.",
  },
  {
    id: "email_finder",
    label: "Email finder",
    description: "Resolve email addresses for sourced LinkedIn profiles.",
    category: "enrichment",
    kind: "secret",
    icon: Mail,
    hasIntegration: false,
    docsHint: "Coming soon.",
  },
];

export const INTEGRATION_CATEGORY_ORDER: IntegrationCategory[] = [
  "comms",
  "scheduling",
  "video",
  "docs",
  "ats",
  "enrichment",
  "billing",
];