# Build AI — Operations Platform · Status & Next Steps

> Last updated: 2026-04-01
> Environment: Frontend → Vercel (`buildai-dlc.vercel.app`) · Backend → Railway

---

## ✅ Fully Working Modules

| Module | What works |
|--------|-----------|
| **Authentication** | OTP registration, JWT login, session restore, session expiry → auto-logout |
| **Ticket Creation** | Factory operator creates tickets; title auto-generated; creator auto-added as member |
| **Role-Based Ticket Visibility** | Factory: only their tickets; Ingestion: only ingestion-stage; Logistics/Admin: all |
| **Chat — Text** | Real-time WebSocket text messages, reply threading |
| **Chat — Images** | Attach and send photos; previewed inline as bubbles |
| **Chat — Voice** | Record and send voice messages; playable in chat |
| **Chat — Video** | Attach and send videos |
| **Chat — PDF** | Attach and preview PDFs |
| **Ticket Status Tracker** | Visual stepper showing every stage; current stage highlighted |
| **Logistics: Accept / Reject** | Logistics accepts/rejects an open ticket |
| **Logistics: Ship to Factory** | Carrier + tracking number modal; status → `outbound_shipped` |
| **Factory: Mark Received** | Factory confirms delivery; status → `factory_received` |
| **Factory: Return Ship to HQ** | Carrier modal; status → `return_shipped` |
| **Logistics: HQ Received** | Confirms return arrived; status → `hq_received` |
| **Logistics: Transfer to Ingestion** | Sends ticket to ingestion team; status → `transferred_to_ingestion` |
| **Ingestion: Batch Processing** | Log batches with QR scan, good/bad/missing SD card counts, progress bar |
| **Ingestion: Mark Done** | Sets status → `ingestion_completed` |
| **Ticket Close** | Logistics / Admin can close any ticket; requires reason |
| **Member Management** | Admin/Logistics invite users by email (instant, no accept/reject); factory sees only their tickets + invited |
| **Logistics: Claim / Self-Assign** | Logistics person claims an open ticket; shown as assigned |
| **QR Code Generation** | Logistics generates QR labels per package; downloadable SVG |
| **QR Scan → Web Page** | Mobile camera scan redirects to public detail page |
| **Scanner Station** | Dedicated input field for hardware red-light scanners |
| **Inventory** | View SD cards, devices, cables, hubs; activity log with filters |
| **Merit Scores** | Per-team performance scores |
| **Keep-Alive** | Frontend pings Railway every 4 min; "Waking up server" banner on cold start |
| **Auto Ticket Poll** | Ticket list refreshes every 30 s so new tickets appear without page reload |
| **Sidebar Version Badge** | Shows `v1.4.0 · 2026-04-01` for deployment verification |

---

## 🐛 Known Bugs (To Fix)

### HIGH PRIORITY

| # | Bug | Location | Fix |
|---|-----|----------|-----|
| 1 | **Duplicate stop buttons** during voice recording — stop icon appears both in the recording bar AND the input row | `ticket-chat-panel.tsx` lines 700–711 | Bottom button should be a cancel (✕) that discards; top bar stop button sends |
| 2 | **Images / voice messages send slowly** — base64 encoding of large files causes UI freeze | `ticket-chat-panel.tsx` | Compress images before encoding; show upload progress indicator |
| 3 | **Ship to Factory has no quantity fields** — logistics can only enter carrier info, not actual devices/SD cards/cables/hubs being sent | `ticket-detail-panel.tsx` carrier modal | Add quantity fields to the modal; update ticket item `approved_qty` on submit |
| 4 | **Return Ship has no quantity fields** — factory enters no info about what they're returning | Same | Add quantity fields to return shipment modal |
| 5 | **HQ partial receipt not implemented** — logistics must confirm ALL items at once; can't mark "SD cards received, devices still in transit" | `ticket-detail-panel.tsx` | New partial-receipt modal per item type |
| 6 | **Ticket title not updated with actual shipped quantities** — title shows requested amounts even after logistics sends fewer | `ticket-detail-panel.tsx` | Update title after `outbound_shipped` confirmation |

### MEDIUM PRIORITY

| # | Bug | Location |
|---|-----|----------|
| 7 | Voice messages play through device speaker, not earpiece | `ticket-chat-panel.tsx` audio element |
| 8 | Chat doesn't scroll to bottom on new message on iOS Safari | `ticket-chat-panel.tsx` scroll ref |
| 9 | Mobile: "Details" tab content overflows on small screens (< 375px) | `ticket-detail-panel.tsx` |
| 10 | Ingestion batch QR scan doesn't auto-submit — user must still press Save | `ingestion-workspace.tsx` |
| 11 | Admin can see all tickets but `Close Ticket` on ingestion-stage tickets goes through without warning | `ticket-detail-panel.tsx` |

---

## 🚧 Incomplete / Partially Implemented

### 1. Shipment Quantity Tracking ← **Next major feature**

**What's needed:**
- When logistics clicks "Ship to Factory": popup asks for actual quantities sent (devices, SD cards, cables, USB hubs, extension boxes). These may differ from what was requested.
- These quantities are stored on the ticket and update each item's `approved_qty`.
- The ticket title updates to reflect actual quantities (e.g., `90 devices | 80 SD cards`).
- When factory ships back ("Ship Return to HQ"): popup asks how many of each item are being returned. Items NOT returned are noted as "sent to another location".
- When logistics confirms HQ receipt: separate confirmation per item type (SD cards arrived, devices arrived separately later).

**Backend changes needed:**
- Add `shipped_quantities: dict[str, int]` to `TicketStatusUpdateInput`
- On `outbound_shipped`: update `items[].approved_qty` with shipped values
- On `return_shipped`: store returned quantities as a sub-field
- On `hq_received`: allow partial confirmation

**Frontend changes needed:**
- Expand carrier modal with quantity fields
- New partial-receipt modal for HQ

---

### 2. Ingestion Workflow — Partial

**What works:** Logging batches, QR scan, good/bad/missing tracking, progress bar
**What's missing:**
- Ingestion team needs to confirm they physically received the packet (click "We have received the SD cards from Logistics") before they can start processing
- QR scan on a hardware scanner (red-light) inside the ingestion workspace should auto-trigger the batch form
- When all expected cards are processed across all batches, ticket auto-moves to `ingestion_completed`

---

### 3. QR Code Scanning

**Mobile camera scan:** Working — redirects to public page with package details
**Hardware scanner (red-light):** Works on Scanner Station page — types the ID into the input field
**Issue:** QR contains the full URL. Some hardware scanners truncate long URLs. Verify QR content length.

---

### 4. Media Performance

**Voice messages:** Recorded as WebM/OGG, encoded base64, sent in chat message body. For long recordings this can be 1–5 MB of base64 string — slow to send and receive.
**Images:** Not compressed before sending — a 4K photo can be 10+ MB base64.
**Fix needed:** Compress images to max 1280px wide before base64 encoding. For voice, limit recording to 2 minutes (already done) but also chunk-encode.

---

## 📋 Next Steps (Ordered by Priority)

### Immediate (this session)
- [ ] **Fix duplicate stop buttons** in voice recording UI
- [ ] **Add quantity fields to Ship to Factory modal** (devices, SD cards, cables, hubs, ext. boxes)
- [ ] **Add quantity fields to Return Ship modal** (factory side)
- [ ] **Update ticket title** after logistics ships with actual quantities

### Short-term (next 1–2 days)
- [ ] **HQ Partial Receipt modal** — confirm SD cards and devices separately
- [ ] **Image compression** before base64 encoding in chat (target: < 200KB)
- [ ] **Ingestion: "Received from Logistics" button** before "Start Processing"
- [ ] **Voice playback on earpiece** (set `audio.setSinkId` or use `<audio>` with `playsInline`)

### Medium-term (before full deployment)
- [ ] **Track items NOT returned** from factory (sent to another location)
- [ ] **Ingestion auto-complete** — when all expected cards processed, auto-move to `ingestion_completed`
- [ ] **Hardware QR scanner** test with real device — verify URL length fits scanner buffer
- [ ] **Admin: edit ticket title** — currently non-editable by anyone; admin should be able to edit after creation

### Long-term / Nice-to-have
- [ ] **Push notifications** — notify logistics on new ticket, factory on accept/reject
- [ ] **Offline mode** — cache recent tickets for reading when server is cold
- [ ] **Export to PDF** — generate a ticket summary PDF for physical records
- [ ] **Multi-factory transfer tracking** — when devices go directly factory-to-factory
- [ ] **Inventory auto-decrement** — deduct from inventory when logistics ships

---

## 🧪 Test Flow (End-to-End)

### Currently Testable

1. Register as Factory Operator → Create ticket
2. Register as Logistics → Accept ticket → Chat → Ship to Factory (carrier info only, no quantity yet)
3. Factory confirms receipt
4. Factory ships return → Logistics confirms HQ received
5. Logistics transfers to Ingestion
6. Ingestion receives (visible in their list) → Logs batch → Mark done
7. Logistics/Admin closes ticket

### Not Yet Testable

- Actual shipped quantities tracking
- Partial HQ receipt
- Ingestion "received from logistics" handoff button

---

## 🗂️ Repository Info

| Repo | URL | Branch |
|------|-----|--------|
| Frontend | `github.com/krnkiran22/Buildai_DLC` | `main` |
| Backend | `github.com/krnkiran22/DLC_Service` | `main` |
| Frontend deploy | `buildai-dlc.vercel.app` | Auto-deploy on push |
| Backend deploy | Railway | Auto-deploy on push |
