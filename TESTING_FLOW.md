# Build AI — Operations Platform · Testing Guide

> **Version:** v1.5.1 · Updated: 2026-04-01  
> **App URL:** https://buildai-dlc.vercel.app  
> **Backend:** Railway (auto-wakes on first request, takes ~30–60 s if cold)

---

## BEFORE YOU START

### Accounts you need

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **Admin** | your admin email | your password | Full access to everything |
| **Logistics** | ram@build.ai | Ram@12345 | Already created |
| **Factory Operator** | register fresh | any | Create during Test 1 |
| **Ingestion** | register fresh | any | Create during Test 1 |

### Setup tip
Open **4 browser windows** side by side (or 4 incognito tabs):
- Window 1 → Admin
- Window 2 → Logistics (ram@build.ai)
- Window 3 → Factory Operator (new account)
- Window 4 → Ingestion (new account)

This lets you see all 4 views at the same time and verify real-time updates.

---

## MODULE 1 — REGISTRATION & LOGIN

---

### 1.1 Register as Factory Operator

**Who does this:** New user

1. Open `https://buildai-dlc.vercel.app` in a browser
2. Click **"Create Account"** or **"Register"**
3. Fill in:
   - Full Name: `Test Factory Person`
   - Email: `factory@test.com` (use a real email you can access)
   - Password: `Test@12345`
   - Role: **Factory Operator**
4. Click **Send OTP**
5. Check your email → enter the 6-digit OTP
6. ✅ **Expected:** You land on the Factory Operator dashboard

---

### 1.2 Register as Ingestion

**Who does this:** New user

1. Open a **new incognito window**
2. Go to `https://buildai-dlc.vercel.app`
3. Register with:
   - Full Name: `Test Ingestion Person`
   - Email: `ingestion@test.com`
   - Password: `Test@12345`
   - Role: **Ingestion**
4. Complete OTP verification
5. ✅ **Expected:** You land on the Ingestion dashboard — it shows **no tickets** (correct, ingestion only sees tickets at their stage)

---

### 1.3 Login as Logistics

**Who does this:** Logistics person

1. Open another browser window
2. Go to `https://buildai-dlc.vercel.app`
3. Enter:
   - Email: `ram@build.ai`
   - Password: `Ram@12345`
4. ✅ **Expected:** You land on the Logistics dashboard with ticket list

---

### 1.4 Wrong password shows correct error

1. Go to the login page
2. Enter a valid email with a **wrong password**
3. ✅ **Expected:** See `"Incorrect password"` — NOT `"Session expired"`

---

### 1.5 Unknown email shows correct error

1. Go to the login page
2. Enter an email that was never registered (e.g. `nobody@fake.com`)
3. ✅ **Expected:** See `"Account not found"` or `"Invalid credentials"` — NOT `"Session expired"`

---

### 1.6 Expired session auto-logout

1. Log in as any user
2. Open **DevTools** → **Application** → **Local Storage** → find the session key
3. Change the `expiresAt` value to `"2020-01-01T00:00:00Z"`
4. Refresh the page
5. ✅ **Expected:** App redirects to login with a `"Session expired"` message

---

## MODULE 2 — DASHBOARD & NAVIGATION

---

### 2.1 Sidebar items are correct per role

Log in as each role and check the sidebar:

| Role | Should see in sidebar |
|------|-----------------------|
| Factory Operator | Dashboard, Tickets |
| Logistics | Dashboard, Tickets, Inventory |
| Ingestion | Dashboard, Tickets |
| Admin | Dashboard, Tickets, Inventory, Admin |

✅ **Expected:** Each role sees only their sections

---

### 2.2 App version shown in sidebar

1. Log in as any user
2. Look at the **very bottom of the sidebar**
3. ✅ **Expected:** See something like `v1.5.1 · 2026-04-01`

---

### 2.3 Server cold-start banner

1. If the backend hasn't been used recently (Railway free tier sleeps after inactivity)
2. Open the app for the first time
3. ✅ **Expected:** A `"Waking up server..."` banner appears at the top
4. ✅ **Expected:** Banner disappears within 30–60 seconds and the app loads normally

---

## MODULE 3 — CREATE A TICKET (Factory Operator)

---

### 3.1 Create a new ticket

**Who does this:** Factory Operator (Window 3)

1. Log in as **Factory Operator**
2. Click **"New Request"** or **"+ New Ticket"**
3. Fill in the form:
   - **Team Name:** `Alpha Team`
   - **Factory Name:** `Bangalore Factory`
   - **Deployment Date:** pick any date (e.g. 3 weeks from today)
   - **Devices Requested:** `5`
   - **SD Cards Requested:** `10`
4. Look at the **Ticket Title** field
5. ✅ **Expected:** Title is **auto-generated** and locked (you CANNOT type in it). It should say something like `Alpha Team · Bangalore Factory — 5 devices, 10 SD cards (15/04/2026)`
6. Click **Submit**
7. ✅ **Expected:** Modal closes and the new ticket appears in your list

---

### 3.2 Ticket auto-appears for Logistics (no refresh needed)

**Who does this:** Logistics (Window 2)

1. After Factory creates the ticket, watch the **Logistics window**
2. Wait up to **30 seconds** (do NOT refresh)
3. ✅ **Expected:** The new ticket appears automatically in the Logistics ticket list

---

### 3.3 Ticket auto-appears for Admin (no refresh needed)

**Who does this:** Admin (Window 1)

1. Same as above — wait up to 30 seconds
2. ✅ **Expected:** Ticket appears in Admin's list

---

### 3.4 Ingestion does NOT see the ticket yet

**Who does this:** Ingestion (Window 4)

1. Look at the Ingestion dashboard right now
2. ✅ **Expected:** The new ticket does **NOT** appear — Ingestion only sees tickets once they reach the ingestion stage

---

## MODULE 4 — LOGISTICS: CLAIM & ACCEPT/REJECT

---

### 4.1 Claim the ticket (self-assign)

**Who does this:** Logistics (Window 2)

1. Click on the new ticket
2. Look for a **"Claim Ticket"** or **"Assign to Me"** button
3. Click it
4. ✅ **Expected:** Your name `Ram` appears as the assigned person on the ticket

---

### 4.2 Accept the ticket

**Who does this:** Logistics (Window 2)

1. With the ticket open, click **"Accept Request"**
2. ✅ **Expected:**
   - Status changes to **Accepted**
   - Timeline shows `"Ticket accepted"` event
   - Factory Operator (Window 3) sees the updated status

---

### 4.3 Reject a ticket (optional separate test)

**Who does this:** Logistics

1. As Factory, create a **second test ticket**
2. As Logistics, open it → click **"Reject Request"**
3. ✅ **Expected:** Status changes to **Rejected** — Factory sees this too

---

## MODULE 5 — CHAT

---

### 5.1 Send a text message (real-time)

**Who does this:** Logistics (Window 2) ↔ Factory (Window 3)

1. As **Logistics**, open the accepted ticket → click the **Chat** tab
2. Type `Hello! Your request has been accepted.` → press **Send**
3. ✅ **Expected (Logistics):** Message bubble appears on the **right side** (your message, dark background)
4. Switch to **Factory Operator** window (Window 3) — open the same ticket
5. ✅ **Expected (Factory):** Message appears on the **left side** within 2–3 seconds — **no refresh needed** (real-time WebSocket)

---

### 5.2 Reply to a message

1. In chat, **long-press or hover** on a message and click **Reply**
2. Type a reply and send
3. ✅ **Expected:** The reply shows a small quote of the original message above it

---

### 5.3 Send an image

1. In chat, click the **📎 attachment** or **photo icon**
2. Select an image from your computer (any JPG, PNG)
3. ✅ **Expected:** Image preview shown before sending
4. Click Send
5. ✅ **Expected:** Image appears as a thumbnail in chat
6. ✅ **Expected:** Sends fast — images are automatically compressed to under 200KB

---

### 5.4 Send a voice message

1. Click the **🎤 microphone** button in the chat bar
2. Speak something: `"This is a test voice message"`
3. Click the **red ■ Stop button** (in the recording bar at the top)
4. ✅ **Expected:** Voice message bubble appears with a ▶ Play button
5. Click Play — ✅ **Expected:** You hear the audio playing through the speaker (not earpiece on mobile)

---

### 5.5 Cancel a voice recording

1. Click the microphone to start recording
2. Click the **grey ✕ Cancel button** (in the main chat bar — NOT the red stop button)
3. ✅ **Expected:** Recording is discarded — nothing sent, no bubble appears

---

### 5.6 Send a PDF file

1. Click the attachment icon
2. Select a PDF file
3. ✅ **Expected:** PDF appears in chat as a file attachment
4. Click on it → ✅ **Expected:** PDF opens/downloads

---

### 5.7 Invite another user to the ticket group

**Who does this:** Admin or Logistics (only they can invite)

1. As **Admin** or **Logistics**, open a ticket → go to **Members** or **Participants** section
2. Type the email of another registered user (e.g. `ingestion@test.com`)
3. Click **Add** or **Invite**
4. ✅ **Expected:** User is **instantly added** (no accept/reject flow)
5. Log in as the invited user in a new window
6. ✅ **Expected:** They can see **only that ticket's chat** — not any other tickets

---

### 5.8 Remove a member from the ticket

**Who does this:** Admin or Logistics

1. Open the ticket → Members section
2. Click **Remove** next to a member
3. ✅ **Expected:** User removed from the group — they can no longer see the ticket

---

## MODULE 6 — LOGISTICS: SHIP TO FACTORY

---

### 6.1 Generate QR label and ship

**Who does this:** Logistics (Window 2)

1. Open an **Accepted** ticket
2. Go to **Packages** section → click **"Create Package"** or **"Generate QR Label"**
3. ✅ **Expected:** A package is created with a QR code

---

### 6.2 Print the QR sticker

**Who does this:** Logistics

1. In the Packages section, find the package card
2. Click the **🖨 Print** button (black button)
3. ✅ **Expected:** A new window opens showing the sticker preview with:
   - Large QR code
   - Package code (monospace)
   - Team name, Factory name, Deploy date
   - Quantities
4. Click **🖨 Print Sticker** in the preview window
5. ✅ **Expected:** Your printer's dialog opens — select your connected printer and print

---

### 6.3 Ship to Factory with actual quantities

**Who does this:** Logistics (Window 2)

1. On the **Accepted** ticket, click **"Ship to Factory"**
2. ✅ **Expected:** A popup appears asking for:
   - **Carrier** (DTDC, Porter, Manual, etc.)
   - **Tracking number** (optional)
   - **Devices:** enter `4` (even though 5 were requested)
   - **SD Cards:** enter `8` (even though 10 were requested)
   - **Cables:** enter `4`
   - **USB Hubs:** enter `1`
   - **Extension Boxes:** enter `0`
3. Click **Confirm / Ship**
4. ✅ **Expected:**
   - Ticket status → **Outbound Shipped**
   - Ticket **title updates** to reflect the actual quantities shipped (4 devices, 8 SD cards)
   - Timeline shows shipment event

---

## MODULE 7 — FACTORY: CONFIRM RECEIPT

---

### 7.1 Factory marks shipment as received

**Who does this:** Factory Operator (Window 3)

1. Open the ticket (status: **Outbound Shipped**)
2. Click **"Mark as Received"** or **"I've Received the Shipment"**
3. ✅ **Expected:**
   - Status → **Factory Received**
   - Timeline updated
   - Logistics (Window 2) sees the updated status

---

## MODULE 8 — FACTORY: SHIP ITEMS BACK TO HQ

---

### 8.1 Ship return with partial quantities

**Who does this:** Factory Operator (Window 3)

1. On the **Factory Received** ticket, click **"Ship Return to HQ"**
2. ✅ **Expected:** A popup appears asking for:
   - **Carrier** and **tracking number**
   - **Devices being returned:** enter `3` (2 devices sent to a nearby factory)
   - **SD Cards being returned:** enter `8`
   - **Cables being returned:** enter `4`
   - **USB Hubs being returned:** enter `1`
   - **Note for items NOT returned:** type `"2 devices sent to Mysore Factory"`
3. Click **Confirm / Ship**
4. ✅ **Expected:** Status → **Return Shipped** — timeline shows what was returned

---

## MODULE 9 — LOGISTICS: CONFIRM RECEIPT AT HQ

---

### 9.1 Confirm partial HQ receipt

**Who does this:** Logistics (Window 2)

1. On the **Return Shipped** ticket, click **"Confirm HQ Receipt"**
2. ✅ **Expected:** A popup appears with individual fields:
   - **SD Cards received:** `8`
   - **Devices received:** `3`
   - **Cables received:** `4`
   - **USB Hubs received:** `1`
   - **Note** (optional): `"All items received in good condition"`
3. Click **Confirm**
4. ✅ **Expected:** Status → **HQ Received** — timeline records the received quantities

> **Tip:** You can enter partial quantities if some items haven't arrived yet (e.g. enter 0 for devices if they're arriving tomorrow — you can confirm separately later).

---

## MODULE 10 — LOGISTICS: TRANSFER TO INGESTION

---

### 10.1 Transfer ticket to Ingestion team

**Who does this:** Logistics (Window 2)

1. On the **HQ Received** ticket, click **"Transfer to Ingestion"** or **"Send to Ingestion Team"**
2. ✅ **Expected:** Status → **Transferred to Ingestion**

---

### 10.2 Ingestion team now sees the ticket

**Who does this:** Ingestion (Window 4)

1. Look at the **Ingestion window** — wait up to 30 seconds
2. ✅ **Expected:** The ticket now appears in the Ingestion dashboard
3. ✅ **Expected:** Any earlier tickets (in shipping/HQ stages) are still **not visible** to Ingestion

---

## MODULE 11 — INGESTION: PROCESS SD CARDS

---

### 11.1 Confirm physical receipt

**Who does this:** Ingestion (Window 4)

1. Open the transferred ticket
2. ✅ **Expected:** See a warning banner: *"Confirm you have physically received the SD card packets from Logistics before starting."*
3. Click **"✅ Confirm Receipt & Start Processing"**
4. ✅ **Expected:** Status → **Ingestion Processing**

---

### 11.2 Log first batch

**Who does this:** Ingestion (Window 4)

1. On the processing ticket, find the **"+ Log New Batch"** form
2. Fill in:
   - **QR Code:** scan the packet QR with your hardware scanner, or type/leave blank
   - **Package Label:** `PKG-BATCH-001`
   - **Total SD Cards in this packet:** `5`
   - **Good SD Cards:** `4`
   - **Bad SD Cards:** `1`
   - **Missing SD Cards:** ✅ **auto-calculated** as `0` (5 total − 4 good − 1 bad)
   - **Notes:** `"1 SD card has a cracked casing"`
3. Click **"Save Batch (Continue Later)"**
4. ✅ **Expected:**
   - **Batch 1** appears in the Processing Batches list
   - Progress bar updates (4+1 = 5 processed out of 8 expected SD cards)

---

### 11.3 Log second batch

**Who does this:** Ingestion (Window 4)

1. Fill in the batch form again:
   - **Total:** `3`
   - **Good:** `3`
   - **Bad:** `0`
   - **Missing:** auto-shows `0`
2. Click **"Save & Mark Ingestion Done"**
3. ✅ **Expected:**
   - **Batch 2** appears in the list
   - Status → **Ingestion Completed** (total processed 5+3=8 ≥ 8 expected)
   - Progress bar shows 100%

> **Note:** If total good+bad across all batches reaches the expected SD card count, the ticket **auto-completes** even if you click "Save Batch" instead of "Mark Done".

---

### 11.4 QR scan during ingestion

**Who does this:** Ingestion (with hardware scanner)

1. In the batch form, click on the **QR Code** field
2. Point the hardware red-light scanner at any package QR code
3. ✅ **Expected:** The QR code value is typed into the field automatically
4. Other fields fill in automatically based on the package data

---

## MODULE 12 — CLOSE THE TICKET

---

### 12.1 Close ticket (Admin or Logistics)

**Who does this:** Admin (Window 1) or Logistics (Window 2)

1. Open the **Ingestion Completed** ticket
2. Click **"Close Ticket"**
3. Enter a reason (e.g. `"Ingestion complete, all SD cards processed"`)
4. Confirm
5. ✅ **Expected:**
   - Status → **Closed**
   - Ticket moves to closed state — no further actions possible
   - All team members can still **view** the ticket and read the chat

---

## MODULE 13 — QR CODE & SCANNER

---

### 13.1 View QR code for a package

1. Open any ticket that has packages
2. Go to **Packages** section
3. ✅ **Expected:** A scannable QR code image is shown (not a broken/placeholder image)

---

### 13.2 Scan with mobile phone

1. Take your mobile phone
2. Open the camera app (or any QR scanner app)
3. Point it at the QR code on screen
4. ✅ **Expected:** Phone browser opens `https://buildai-dlc.vercel.app/qr/[token]` — shows full package details

---

### 13.3 Print QR sticker from QR page

1. After scanning with your phone, the QR details page opens on mobile
2. Tap the **🖨 Print Label** button at the top right
3. ✅ **Expected:** Print dialog opens — select your printer and print the sticker

---

### 13.4 Hardware scanner (red-light scanner)

1. Open the app on a desktop computer
2. Navigate to the **Scan** page (in the sidebar or `…/scan`)
3. ✅ **Expected:** A green "Ready to Scan" screen with an input field
4. Point the hardware scanner at any package QR code label
5. ✅ **Expected:**
   - The scanner types the QR value into the input field
   - Package details appear on screen within 1–2 seconds
6. After the result appears, click **🖨 Print Label** to reprint the sticker

---

### 13.5 Manual token lookup on scanner page

1. On the **Scan** page, type a token or package code manually into the input box
2. Press **Enter** or click **Search**
3. ✅ **Expected:** Package details appear — same as scanning

---

## MODULE 14 — ADMIN FEATURES

---

### 14.1 Edit ticket title (Admin only)

**Who does this:** Admin (Window 1)

1. Open any ticket
2. Look at the **very top** of the ticket detail — the title is displayed prominently
3. ✅ **Expected:** Admin sees an **"✎ Edit"** button next to the title — other roles do NOT see this button
4. Click **✎ Edit** → change the title → click **Save**
5. ✅ **Expected:** Title updates immediately for all viewers

---

### 14.2 Inventory page — view stock

**Who does this:** Admin or Logistics

1. Click **Inventory** in the sidebar
2. ✅ **Expected:** See a list of items (SD Cards, Devices, Cables, USB Hubs, Extension Boxes) with quantities

---

### 14.3 Inventory page — edit stock quantity

**Who does this:** Admin

1. Click on any inventory item
2. Change the quantity
3. Click Save
4. ✅ **Expected:** Quantity updates and saves

---

### 14.4 Inventory activity log

**Who does this:** Admin

1. On the Inventory page, scroll down to **"Recent Activities"** or **"Activity Log"**
2. ✅ **Expected:** See a log of incoming/outgoing events
3. Use the **filter buttons** to filter by:
   - Item type: SD Cards, Devices, Chargers/Hubs, Cables
   - Direction: Incoming, Outgoing
4. Click on any log entry
5. ✅ **Expected:** A popup shows the full details of that transaction

---

## MODULE 15 — PRINT STICKER (All Pages)

The **🖨 Print** / **🖨 Print Label** button appears in 3 places:

---

### 15.1 Print from Ticket Detail → Packages

1. Open any ticket with packages
2. Find the package card in the **Packages** section
3. Click the black **🖨 Print** button
4. ✅ **Expected:** A sticker preview window opens with:
   - Large scannable QR code
   - Package code in monospace font
   - Direction label (OUTBOUND or RETURN)
   - Team name, Factory name, Deploy date
   - Quantities (devices, SD cards, cables, hubs)
5. Click **🖨 Print Sticker** in the preview
6. ✅ **Expected:** Your browser's print dialog opens — select your printer

---

### 15.2 Print from the public QR page (mobile)

1. Scan a QR code with your phone → QR details page opens
2. Tap **🖨 Print Label** (top right of the page)
3. ✅ **Expected:** Print dialog opens on the phone/computer

---

### 15.3 Print from the Scanner Station

1. On the **Scan** page, scan a QR code (hardware or manual)
2. After the package details appear, click **🖨 Print Label**
3. ✅ **Expected:** Sticker preview opens → print

---

## MODULE 16 — MOBILE RESPONSIVENESS

---

### 16.1 Check all pages on mobile

Use a real phone **or** browser DevTools (F12 → device toolbar):

| Page | What to verify |
|------|----------------|
| Login / Register | Form fields fit, buttons are tappable |
| Dashboard | Cards are readable, no overflow |
| Ticket List | Tickets listed cleanly, tappable |
| Ticket Detail + Chat | Chat input at bottom, messages scroll, images visible |
| QR Detail Page | Fits on mobile screen, Print button visible |
| Inventory | Table/cards readable |
| Scanner Page | Big "Ready to Scan" visible, input field accessible |

✅ **Expected for all:** No horizontal scrolling, no cut-off text, all buttons reachable with thumb

---

## FULL END-TO-END FLOW — QUICK REFERENCE

This is the **complete journey** of one ticket. Follow in order:

```
Step 1:  Factory creates ticket
           → Title auto-generated (locked)
           → Appears for Logistics/Admin within 30s

Step 2:  Logistics claims the ticket
           → Assigned to Ram

Step 3:  Logistics accepts (or rejects)
           → Chat opens for discussion

Step 4:  Both sides chat (text / images / voice / PDF)
           → Real-time, no refresh needed

Step 5:  Logistics generates QR label for the package
           → Prints sticker with QR code

Step 6:  Logistics ships to Factory
           → Enters actual quantities (may differ from requested)
           → Ticket title updates to reflect actual numbers

Step 7:  Factory confirms receipt
           → Status: Factory Received

Step 8:  Factory ships items back to HQ
           → Enters quantities returned + notes on items NOT returned

Step 9:  Logistics confirms HQ receipt (can be partial)
           → Enters exactly what arrived today

Step 10: Logistics transfers to Ingestion
           → Ticket now visible to Ingestion team

Step 11: Ingestion confirms physical receipt
           → Clicks "✅ Confirm Receipt & Start Processing"

Step 12: Ingestion logs SD card batches
           → Scan QR or enter package label
           → Good / Bad / Missing counts
           → Auto-calculates missing, tracks progress

Step 13: Ingestion marks done (or auto-completes)
           → When total processed ≥ requested SD cards

Step 14: Logistics or Admin closes the ticket
           → Done ✅
```

---

## TROUBLESHOOTING

| Problem | What to do |
|---------|------------|
| **"Session expired" on login page** | Clear browser localStorage and try again |
| **Ticket not showing for Logistics** | Wait 30 seconds (auto-polls) or refresh once |
| **Images taking long to send** | Auto-compression is active — should be fast. If slow, check internet connection |
| **QR code shows broken image** | Backend `segno` library may be down — check Railway logs |
| **Pop-up blocked when printing** | Click "Allow pop-ups" for this site in your browser settings |
| **Print sticker has no QR image** | Allow pop-ups AND check that the backend is running (QR SVG is served from Railway) |
| **"403 Forbidden" error** | You are logged in as the wrong role for this action — check the role in the top right |
| **"Waking up server..." banner** | Railway free tier — wait 30–60 seconds |
| **Voice audio plays through earpiece (mobile)** | Fixed — now uses `playsInline` to force speaker |
| **Two microphone buttons visible** | Fixed — only one mic button should show |
| **New ticket doesn't appear (Factory page)** | This was a bug — now fixed. Refresh once if it still happens |

---

## ROLE PERMISSION SUMMARY

| Action | Factory | Logistics | Ingestion | Admin |
|--------|---------|-----------|-----------|-------|
| Create ticket | ✅ | ❌ | ❌ | ✅ |
| View tickets | Own only | All | Ingestion stage only | All |
| Accept / Reject | ❌ | ✅ | ❌ | ✅ |
| Claim ticket | ❌ | ✅ | ❌ | ✅ |
| Ship to Factory | ❌ | ✅ | ❌ | ✅ |
| Mark Received (Factory) | ✅ | ❌ | ❌ | ✅ |
| Return Ship to HQ | ✅ | ❌ | ❌ | ✅ |
| HQ Receipt confirmation | ❌ | ✅ | ❌ | ✅ |
| Transfer to Ingestion | ❌ | ✅ | ❌ | ✅ |
| Start Ingestion | ❌ | ❌ | ✅ | ✅ |
| Log batch | ❌ | ❌ | ✅ | ✅ |
| Close ticket | ❌ | ✅ | ❌ | ✅ |
| Edit ticket title | ❌ | ❌ | ❌ | ✅ |
| Invite members | ❌ | ✅ | ❌ | ✅ |
| Remove members | ❌ | ✅ | ❌ | ✅ |
| View inventory | ❌ | ✅ | ❌ | ✅ |
| Edit inventory | ❌ | ❌ | ❌ | ✅ |

---

*Build AI Operations Platform · v1.5.1 · 2026-04-01*
