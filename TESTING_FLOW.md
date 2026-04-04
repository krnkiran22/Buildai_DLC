# Build AI — Test Flow Guide
**Pre-deployment checklist · Updated April 2026**

---

## Accounts You Need

Open **3 browser tabs** (or 3 phones/devices), each logged in as a different person.

| Who | Email | Password | Role |
|---|---|---|---|
| **Factory person** | Register below | Your choice | Factory Operator |
| **Logistics — Ram** | ram@build.ai | Ram@12345 | Logistics (pre-created) |
| **Ingestion person** | Register below | Your choice | Ingestion Operator |

### How to register (Factory / Ingestion)
1. Open the app → tap **Create account**
2. Enter your name, email, password, and pick your role
3. Tap **Continue →** → enter the 6-digit OTP sent to your email
4. You're in — the app loads your dashboard automatically

> **On mobile:** the login screen slides up from the bottom. Type the OTP in the big box — it accepts only numbers.

---

## Full Test Flow — Do Steps In Order

---

### Step 1 — Factory: Create a Ticket

1. Log in as the Factory person
2. You land on the **Home** screen — tap **Request Devices** (the black card)
   - Or go to **Tickets** → tap **+ New**
3. Fill in the form:
   - Team name: e.g. `Tata Team A`
   - Factory name: e.g. `Pune Factory 1`
   - Deployment date: any future date *(edit the title if you like — it's now editable)*
   - Devices: `10` · SD Cards: `10`
4. Tap **Submit**
5. ✅ Ticket appears in your list with status `OPEN`
6. ✅ You are automatically added as a member of the ticket group

> **On mobile:** tap the ticket row → slides to the Chat pane. Use the bottom tab bar to switch between Tickets / Chat / Info.

---

### Step 2 — Logistics: Claim the Ticket

1. Log in as Ram
2. Go to **Tickets** — the list defaults to **Open** tickets
3. You'll see the new ticket marked **Unassigned** (orange badge)
4. Tap the ticket → tap the **Info** tab (bottom bar) → **Tracker**
5. Tap **Claim** (green card at the top of the tracker)
6. ✅ Ticket now shows `Ram` as the assigned person in the list and tracker
7. ✅ Ram is also automatically added to the group — check the **Members** tab

---

### Step 3 — Chat (Both sides, real-time)

1. As Ram → tap the **Chat** tab
2. Type a message → send
3. Switch to the Factory person's window — the message appears instantly
4. Factory person replies — Ram sees it instantly
5. ✅ Real-time chat works

**Try media in chat:**
- Tap 📎 → send a photo, video, or PDF → it shows as a preview bubble
- Tap 🎤 → hold to record a voice message → send → it plays back with a waveform
- Tap any image → it opens full-screen
- Tap a PDF card → it opens in the browser

---

### Step 4 — Logistics: Accept the Ticket

1. As Ram → **Info** tab → **Tracker**
2. Tap **Accept Request**
3. ✅ Status → `ACCEPTED`

> If you need to reject: tap **Reject** instead. Ticket closes. Flow ends.

---

### Step 5 — Logistics: Ship to Factory

1. As Ram → **Tracker** → tap **Ship to Factory**
2. Optionally pick a courier (DTDC, Porter, etc.) and enter a tracking number
3. Tap **Confirm Ship**
4. ✅ Status → `SHIPPED`

---

### Step 6 — Factory: Mark Received

1. As Factory person → open the ticket → **Info / Tracker**
2. Tap **I've Received the Shipment**
3. ✅ Status → `AT FACTORY`

---

### Step 7 — Factory: Ship Back to HQ

1. As Factory person → **Tracker** → tap **Ship Return to HQ**
2. Optionally enter courier + tracking number → confirm
3. ✅ Status → `RETURN SHIPPED`

---

### Step 8 — Logistics: Confirm HQ Receipt

1. As Ram → **Tracker** → tap **HQ Received Return**
2. ✅ Status → `HQ RECEIVED`

---

### Step 9 — Logistics: Send to Ingestion

1. As Ram → **Tracker** → tap **Send to Ingestion Team**
2. ✅ Status → `INGESTION`

---

### Step 10 — Ingestion: Log Processing Batches

> Ingestion people **only see tickets that have been sent to them** (status = Pending / Processing / Done). Earlier-stage tickets are hidden.

**Concept:** SD cards arrive in multiple packets over multiple days (e.g. 1000 total, sent 100 at a time). Each batch is logged separately. The ticket shows a running total.

**Example:** Ticket has 1000 SD cards. Today they send 100.

1. Log in as Ingestion person → go to **Ingestion** in the sidebar
2. You'll see the ticket in the list marked **Pending** — tap it
3. You see:
   - **Ticket info** (team, factory, total SD cards)
   - **Progress bar** (0/1000 processed)
   - An empty batch list
4. Tap **+ Log New Batch**
5. A form slides in. Either:
   - **Scan the QR code on the packet** using your scanner — it auto-fills the QR field
   - Or type the packet ID manually
6. Enter the counts for this batch:
   - Total in Packet: `100`
   - Good Cards: `90` (the ones that work)
   - Bad / Faulty: `5` (red cards, broken)
   - Missing: auto-calculated → `5` (100 − 90 − 5)
7. Optionally add a label (`Box 1`, `Day 1 packet`) and any notes
8. Tap **Save Batch (Continue Later)**
9. ✅ Batch 1 appears in the list → Progress bar shows `90/1000 (9%)`

**Day 2 — another 100 cards arrive:**
1. Open the same ticket → tap **+ Log New Batch**
2. Scan the new packet's QR code
3. Enter: Total=100, Good=95, Bad=3, Missing=2
4. Tap **Save Batch**
5. ✅ Batch 2 appears → Progress: `185/1000`

**When all cards are processed (total = 1000):**
1. Log the final batch
2. Instead of "Save Batch", tap **Save & Mark Ingestion Done**
3. ✅ Status → `DONE`

> You can also mark done any time without hitting 1000 — just tap "Save & Mark Done" on any batch.

---

### Step 11 — Ingestion: Mark Done (alternative)

If all batches are already saved and you want to mark complete without a new batch:
1. As Ingestion → **Tracker** → tap **Mark Ingestion Done**
2. ✅ Status → `DONE`

---

### Step 12 — Close the Ticket

1. As Ram or Admin → **Tracker** → tap **Close Ticket**
2. Enter a closing note → confirm
3. ✅ Status → `CLOSED`

---

## Extra Features to Test

### Person Filter (Ticket List)
1. Go to **Tickets** → tap **👤 Person** (top right)
2. Tap **Mine** → only your tickets show
3. Tap **Ram** → only Ram's tickets show
4. Tap **All** → everything shows back
5. ✅ Works combined with the status chips (Open, Accepted, etc.)

### Smart Defaults (by Role)
- **Factory person** opens Tickets → list automatically shows **only their own tickets**
- **Logistics / Admin** opens Tickets → list automatically shows **Open** tickets
- ✅ No need to manually set filters

### Inventory Activity Log
1. Go to **Inventory** (Logistics or Admin)
2. Scroll down below the stock table — you'll see the **Recent Activity Log**
3. Tap **📤 Outgoing** → shows only shipments from HQ to factories
4. Tap **📥 Incoming** → shows only returns from factories
5. Tap **💾 SD Cards** → shows only movements that included SD cards
6. Tap any log row → a detail popup opens with:
   - Full route (HQ → Factory)
   - Item counts (devices, SD cards, hubs, cables)
   - All package codes with status
   - Team and factory info
7. ✅ Filters work together (e.g. Incoming + SD Cards)

### QR Code (Mobile Scan)
1. Open any ticket → **Info / Tracker** → find the package QR code
2. Scan with your phone camera
3. ✅ Redirects to `buildai-dlc.vercel.app/qr/[token]` showing package details

### Scanner Station (Hardware Scanner)
1. Open `buildai-dlc.vercel.app/scan` in a browser (or click **Scanner Station** in the sidebar)
2. The screen is dark with a large ready indicator
3. Use the red-light scanner to scan a QR code — it types the token into a hidden input
4. ✅ Package details appear on screen automatically
5. Screen clears after 60 seconds (15 seconds if there was an error)

### Session Expired
1. If your session expires, a full-screen overlay appears (dark red)
2. Tap **Log In Again** — or wait 3 seconds, it dismisses automatically
3. ✅ Login screen appears behind it immediately

---

## What Should Work — Full Checklist

| Feature | Expected |
|---|---|
| Register with OTP | OTP arrives in email, you're logged in after verifying |
| Login / logout | Session saves on refresh (up to 30 days) |
| Mobile login screen | Slides up from bottom, OTP input is large and easy |
| Create ticket | Appears in list immediately, factory person is auto-added to group |
| Editable ticket title | Change the date or name before submitting |
| Logistics claims ticket | Name badge appears in list and tracker |
| Real-time chat | Messages appear instantly in both windows |
| Voice message | Records, uploads, plays with waveform |
| Photo / video / PDF in chat | Uploads, shows preview, opens on tap |
| Ticket status flow | Each button appears only for the correct role and status |
| Ingestion batch logging | QR scan auto-fills, counts recorded per batch, progress bar updates |
| Ingestion role visibility | Ingestion users only see tickets in Pending/Processing/Done state |
| Batch sub-tracking | Each batch shows separately with Good/Bad/Missing counts and timestamp |
| Auto-add creator to group | Members tab shows factory person after ticket creation |
| Invite by email | Members tab → type email → Add → person joins group |
| Person filter | Shows all people, Mine + individual names work |
| Smart role defaults | Factory sees mine, Logistics sees open tickets by default |
| Home quick actions | Unassigned count for logistics, Request Devices for factory |
| Inventory activity log | Filters by direction + item type, tap shows full detail |
| QR code (phone) | Scan → opens frontend `/qr/[token]` page |
| Scanner Station | Hardware scan → details appear on `/scan` page |
| Session expired overlay | Full screen overlay → auto-dismisses after 3s |
| Mobile navigation | Bottom tab bar, back chevron, slide animations |
| Mobile sidebar | Slides in from left, frosted-glass overlay behind it |

---

## Common Issues

**Status button not showing**
→ Check you're logged in with the right role. Each button is role-gated and status-gated.

**Chat not updating live**
→ WebSocket reconnects automatically (up to 6 retries). Check internet connection.

**"No user found" when adding member**
→ That person hasn't registered yet. Register first, then add by email.

**QR code not scanning**
→ The backend is now using `segno` (pure Python). Should work after Railway re-deploys. Check Railway build logs if still failing.

**Session expired too quickly**
→ Sessions last 30 days. If Railway re-deployed, Redis restarts and clears sessions — just log in again.

**Inventory log is empty**
→ Activity log shows data from movement records. If no tickets have been shipped yet, the log will be empty.

**Ingestion team can't see any tickets**
→ Tickets only appear for ingestion once the Logistics person taps "Send to Ingestion Team" (Step 9). Before that the ticket is invisible to ingestion.

**Ingestion batch counts seem wrong**
→ Missing = Total − Good − Bad. The field is auto-calculated and shown in the form. Good + Bad must not exceed Total.

**"Mark Ingestion Done" not showing**
→ This button is in the Tracker (Info tab). It appears when the ticket is in `ingestion_processing` status and the role is `ingestion` or `admin`.

---

*All steps above work end-to-end. Deploy with confidence.*
