# Plan: Service integrations in Master Settings

Split the Master Settings → Integrations area into **two distinct sections** so sourcing (Apify actors) and communication services (OAuth/REST APIs) are modelled correctly.

## New structure

```
Master Settings
├── Integrations
│   ├── Service integrations    ← NEW (Calendar, Zoom, WhatsApp, Email, Slack…)
│   └── (existing Apify status row stays here as a backend dependency)
├── Sourcing actors             ← unchanged (LinkedIn, Naukri, etc.)
└── AI ranking                  ← unchanged
```

## Service integrations to add

| Integration | Auth pattern | App feature it powers | v1 state |
|---|---|---|---|
| **Google Calendar + Meet** | Lovable `google_calendar` connector | `/interviews` scheduling, auto Meet links | Connect button |
| **Microsoft Outlook + Teams** | Lovable `microsoft_outlook` / `microsoft_teams` connector | Same for Outlook clients | Connect button |
| **Zoom** | `add_secret` for ZOOM_ACCOUNT_ID / CLIENT_ID / CLIENT_SECRET (server-to-server OAuth) | Alt video link on interviews | Connect button |
| **WhatsApp Business** | `add_secret` for WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN (Meta Cloud API) | Candidate outreach in `/messages` | Connect button |
| **Email (sender)** | Lovable Emails (built-in) or Resend connector | Outbound to candidates/clients | Connect button |
| **Twilio SMS** | Lovable `twilio` connector | Interview reminders / OTP nudges | Locked (soon) |
| **Slack** | Lovable `slack` connector | Internal team notifications | Locked (soon) |
| **Calendly / Cal.com** | API key via `add_secret` | Candidate self-booking | Locked (soon) |
| **DocuSign** | OAuth via `add_secret` | Offer letters in `/billing` | Locked (soon) |
| **Stripe** | Already wired in `/billing` | Surface status here too | Connected pill (read-only) |
| **Resume parser** (Affinda/Rchilli) | `add_secret` | Parse uploads in `/client/upload` | Locked (soon) |
| **ATS sync** (Greenhouse/Lever/Ashby) | API key via `add_secret` | One-way candidate push to clients | Locked (soon) |

## Files

### `src/lib/integrations.ts` (new)
Registry, modelled after `SCOUT_SOURCES`:
```ts
type IntegrationKind = 'connector' | 'secret' | 'builtin';
type IntegrationCategory = 'comms' | 'scheduling' | 'video' | 'docs' | 'billing' | 'ats' | 'enrichment';
type IntegrationStatus = 'connected' | 'available' | 'locked';

interface Integration {
  id: string;
  label: string;
  description: string;
  category: IntegrationCategory;
  kind: IntegrationKind;
  envVars?: string[];        // probed server-side
  connectorId?: string;      // for kind='connector'
  hasIntegration: boolean;   // false → render Lock + "soon"
  docsHint?: string;
}
```
No actor slug field on this side.

### `src/lib/admin-settings.functions.ts` (edit)
Add `getServiceIntegrationStatus()` server fn — loops the registry, returns `{ [id]: 'connected'|'available'|'locked' }` by probing `process.env[envVar]` for each.

### `src/routes/admin.settings.tsx` (edit)
- Add a **"Service integrations"** section above the existing Sourcing actors table.
- Group rows by category (Communications, Scheduling, Video, Docs, Billing, ATS, Enrichment).
- Each row: icon, name, description, status pill, CTA:
  - `connected` → "Manage" (deep link to Lovable Cloud secrets/connectors panel)
  - `available` → "Connect" (no-op stub in v1, just shows toast "Open Lovable Cloud → Connectors / Secrets to wire this up")
  - `locked` → Lock icon, no CTA
- Keep the existing Sourcing actors table untouched — that's where the actor-slug field still belongs.

## Out of scope (v1)
- Actually wiring any service (sending a WhatsApp message, creating a Calendar event, etc.) — this is purely the **Master Settings panel + status visibility**. Each integration becomes its own follow-up task.
- Per-recruiter OAuth (each user connects their own Google account) — still a separate bigger plan.
- No DB migration. Status is read-only / derived from secrets + connectors.

## Confirm before I build
Build the registry with **all integrations from the table above** (locked ones included as "soon" rows)? Or only the four you originally named (Calendar/Meet, Zoom, WhatsApp, Email) and skip Twilio/Slack/Calendly/DocuSign/Stripe/Resume parser/ATS until you ask?
