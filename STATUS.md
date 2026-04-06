# Build AI — Operations Platform · Status & Next Steps

> Last updated: 2026-04-01 (v1.5.0)
> Environment: Frontend → Vercel (`buildai-dlc.vercel.app`) · Backend → Railway

---

## ✅ Fully Working Modules

| Module | What works |
|--------|-----------|
| **Authentication** | OTP registration, JWT login, session restore, session expiry → auto-logout |
| **Ticket Creation** | Factory operator creates tickets; title auto-generated; creator auto-added as member |
| **Role-Based Ticket Visibility** | Factory: only their tickets; Ingestion: only ingestion-stage; Logistics/Admin: all |
| **Chat — Text** | Real-time WebSocket text messages, reply threading |
| **Chat — Images** | Attach and send photos; compressed to < 200KB before sending; previewed inline |
| **Chat — Voice** | Record and send voice messages; playable in chat with `playsInline` for mobile |
| **Chat — Video** | Attach and send videos |
| **Chat — PDF** | Attach and preview PDFs |
| **Voice Recording** | Stop (sends) in recording bar; Cancel ✕ (discards) in input row — no more duplicate buttons |
| **Ticket Status Tracker** | Visual stepper showing every stage; current stage highlighted |
| **Logistics: Accept / Reject** | Logistics accepts/rejects an open ticket |
| **Logistics: Ship to Factory** | Popup with actual quantities (devices, SD cards, cables, hubs, ext. boxes) + carrier; updates title + approved_qty |
| **Factory: Mark Received** | Factory confirms delivery; status → `factory_received` |
| **Factory: Return Ship to HQ** | Popup with quantities returned + "items NOT returned / sent elsewhere" field |
| **Logistics: HQ Partial Receipt** | Separate confirmation per item type (SD cards, devices, cables, hubs, ext. boxes) |
| **Logistics: Transfer to Ingestion** | Sends ticket to ingestion team; status → `transferred_to_ingestion` |
| **Ingestion: Confirm Receipt** | "✅ Confirm Receipt & Start Processing" button with warning banner before starting |
| **Ingestion: Batch Processing** | Log batches with QR scan, good/bad/missing SD card counts, progress bar |
| **Ingestion: Auto-Complete** | When total good + bad across all batches ≥ expected SD cards, ticket auto-moves to `ingestion_completed` |
| **Ingestion: Mark Done** | Manual "Mark Ingestion Done" button also available |
| **Admin: Edit Ticket Title** | Admin sees ✎ Edit button on title bar; can update title inline |
| **Ticket Close** | Logistics / Admin can close any ticket; requires reason |
| **Member Management** | Admin/Logistics invite users by email (instant); factory sees only their tickets + invited |
| **Logistics: Claim / Self-Assign** | Logistics person claims an open ticket; shown as assigned |
| **QR Code Generation** | Logistics generates QR labels per package; downloadable SVG |
| **QR Scan → Web Page** | Mobile camera scan redirects to public detail page |
| **Scanner Station** | Dedicated input field for hardware red-light scanners |
| **Inventory** | View SD cards, devices, cables, hubs; activity log with filters |
| **Merit Scores** | Per-team performance scores |
| **Auto Ticket Poll** | Ticket list refreshes every 30 s — new tickets appear without page reload |
| **Keep-Alive** | Frontend pings Railway every 4 min; "Waking up server" banner on cold start |
| **Vercel Cron** | Daily cron job to keep Railway warm (Hobby plan: once/day) |

---

## 🐛 Known Bugs (Remaining)

| # | Bug | Location | Priority |
|---|-----|----------|----------|
| 1 | Chat doesn't auto-scroll to bottom on new message in iOS Safari | `ticket-chat-panel.tsx` scroll ref | Medium |
| 2 | Mobile: "Details" tab content can overflow on phones < 375px wide | `ticket-detail-panel.tsx` | Medium |
| 3 | Ingestion batch QR scan field doesn't auto-submit — user must press Save | `ingestion-workspace.tsx` | Low |
| 4 | Admin "Close Ticket" on ingestion-stage tickets goes through without warning | `ticket-detail-panel.tsx` | Low |

---

## 🧪 Full End-to-End Test Flow

### Step 1 — Factory: Create Ticket
- Register as Factory Operator
- Click "New Ticket" → fill Team Name, Factory Name, Deploy Date, Devices, SD Cards
- Title auto-generated and locked (non-editable)
- Submit → ticket appears in your list

### Step 2 — Logistics: Accept & Chat
- Register as Logistics → ticket appears in their list within 30 s (auto-poll)
- Open ticket → Accept or Reject
- Chat about the deployment; send text, images, voice

### Step 3 — Logistics: Ship to Factory
- Click "Ship to Factory" → popup appears
- **Enter actual quantities** (may differ from requested): Devices, SD Cards, Cables, USB Hubs, Extension Boxes
- Select carrier (optional) + tracking number
- Confirm → ticket title updates to reflect actual quantities; approved_qty stored

### Step 4 — Factory: Confirm Receipt
- Click "I've Received the Shipment" → status → `factory_received`

### Step 5 — Factory: Return Ship to HQ
- Click "Ship Return to HQ" → popup appears
- **Enter quantities being returned** to HQ
- **Enter anything NOT returned** (sent to another factory, kept on-site) in the note field
- Confirm → status → `return_shipped`

### Step 6 — Logistics: HQ Partial Receipt
- Click "HQ Received Return" → **partial receipt popup**
- Enter exactly what arrived (SD cards might arrive before devices)
- Add note (e.g., "Devices arriving separately tomorrow")
- Confirm → status → `hq_received`; quantities recorded

### Step 7 — Logistics: Transfer to Ingestion
- Click "Send to Ingestion Team" → status → `transferred_to_ingestion`
- Ticket disappears from Factory/Logistics view (ingestion team can now see it)

### Step 8 — Ingestion: Confirm Receipt & Process
- Ingestion person opens ticket → sees warning banner
- Click **"✅ Confirm Receipt & Start Processing"** → status → `ingestion_processing`
- Click "+ Log New Batch":
  - Scan QR code (or type package ID)
  - Enter total in packet, good SD cards, bad SD cards (missing auto-calculated)
  - "Save Batch" or "Save & Mark Done"
- Progress bar updates across all batches
- **Auto-completes** when total processed ≥ expected SD cards

### Step 9 — Logistics/Admin: Close Ticket
- When ingestion is done → Logistics or Admin clicks "Close Ticket"
- Enter closure reason → ticket closed

---

## 📋 Remaining Nice-to-Have Items

| Item | Effort | Notes |
|------|--------|-------|
| Push notifications | High | Needs service workers + FCM; not critical for v1 |
| Offline mode / cache | High | PWA caching; not critical for v1 |
| Export to PDF | Medium | Generate printable ticket summary |
| Multi-factory transfer tracking | Medium | Devices sent factory-to-factory without going to HQ |
| Inventory auto-decrement | Medium | Deduct from inventory when logistics ships |
| Admin: bulk ticket management | Low | Select multiple tickets for status updates |
| Hardware QR scanner URL length | Low | Verify QR URL fits scanner's character buffer |

---

## 🗂️ Repository Info

| Repo | URL | Branch |
|------|-----|--------|
| Frontend | `github.com/krnkiran22/Buildai_DLC` | `main` |
| Backend | `github.com/krnkiran22/DLC_Service` | `main` |
| Frontend deploy | `buildai-dlc.vercel.app` | Auto-deploy on push to main |
| Backend deploy | Railway | Auto-deploy on push to main |
