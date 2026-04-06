# Build AI — Complete Testing Guide
**Version:** v1.5.1 | **Updated:** 2026-04-01

This document walks through **every feature** in the application, step by step.  
Follow each section in order. Each step tells you exactly what to do and what you should see.

---

## ACCOUNTS TO USE

| Person | Email | Password | Role |
|--------|-------|----------|------|
| Admin | your admin email | your password | admin |
| Logistics 1 | ram@build.ai | Ram@12345 | logistics |
| Factory Person | register a new account | any | factory_operator |
| Ingestion Person | register a new account | any | ingestion |

> **Tip:** Use different browsers or incognito windows to be logged in as multiple people at the same time.

---

## PART 1 — REGISTRATION & LOGIN

### Test 1.1 — Register a new Factory Operator account

1. Open the app URL in a browser.
2. Click **"Sign Up"** or **"Register"**.
3. Enter your name, email, and choose role **"Factory Operator"**.
4. Enter a password.
5. An OTP will be sent to your email — enter it.
6. **Expected:** You land on the Factory Operator dashboard.

### Test 1.2 — Register a new Ingestion account

1. Open the app in a new incognito window.
2. Register with a different email, choose role **"Ingestion"**.
3. **Expected:** You land on the Ingestion dashboard (which shows no tickets yet — that is correct).

### Test 1.3 — Wrong password shows proper error

1. Go to login page.
2. Enter a valid email but wrong password.
3. **Expected:** See "Incorrect password" error. **NOT** "Session expired".

### Test 1.4 — Non-existent account shows proper error

1. Go to login page.
2. Enter an email that was never registered.
3. **Expected:** See "Account not found" or similar error. **NOT** "Session expired".

### Test 1.5 — Expired session redirects to login

1. Log in successfully.
2. Open browser DevTools → Application → Local Storage.
3. Find the session entry and change `expiresAt` to a past timestamp (e.g. `"2020-01-01T00:00:00Z"`).
4. Refresh the page.
5. **Expected:** You are redirected to the login page and see "Session expired" message.

---

## PART 2 — TICKET CREATION (Factory Operator)

### Test 2.1 — Create a new ticket

1. Log in as **Factory Operator**.
2. Click **"New Request"** or **"+ New Ticket"** button.
3. Fill in:
   - Team Name: `Test Team Alpha`
   - Factory Name: `Factory Bangalore`
   - Deployment Date: pick any future date
   - Devices Requested: `5`
   - SD Cards Requested: `10`
4. **Expected:** The ticket title is **auto-generated** (you cannot type in the title field). It should look like: `"Test Team Alpha · Factory Bangalore — 5 devices, 10 SD cards (DD/MM/YYYY)"`.
5. Click **Submit**.
6. **Expected:** Modal closes and the new ticket appears in your ticket list.

### Test 2.2 — Ticket appears for Logistics within 30 seconds

1. After creating the ticket (Test 2.1), switch to the **Logistics** browser window (logged in as ram@build.ai).
2. Wait up to 30 seconds **without refreshing**.
3. **Expected:** The new ticket appears automatically in the Logistics ticket list.

### Test 2.3 — Ticket appears for Admin within 30 seconds

1. Switch to the **Admin** window.
2. Wait up to 30 seconds.
3. **Expected:** Same ticket appears.

### Test 2.4 — Ingestion does NOT see the ticket yet

1. Switch to the **Ingestion** window.
2. **Expected:** The new ticket does NOT appear. The ingestion person only sees tickets that are in the ingestion stage.

---

## PART 3 — LOGISTICS: ACCEPT OR REJECT TICKET

### Test 3.1 — Claim the ticket (self-assign)

1. As **Logistics** (ram@build.ai), click on the new ticket.
2. Click **"Claim Ticket"** or **"Assign to Me"**.
3. **Expected:** Your name appears as the assigned logistics person on the ticket.

### Test 3.2 — Accept the ticket

1. As **Logistics**, open the ticket.
2. Click **"Accept"**.
3. **Expected:** Ticket status changes to `Accepted`. A timeline event is added.

### Test 3.3 — Reject a ticket (separate test)

1. As **Factory Operator**, create another ticket.
2. As **Logistics**, open it and click **"Reject"**.
3. **Expected:** Status changes to `Rejected`. Factory person should see the updated status.

---

## PART 4 — CHAT (WhatsApp-style)

### Test 4.1 — Send a text message

1. As **Logistics**, open the accepted ticket.
2. Type a message in the chat box and press Send.
3. **Expected:** Message appears in a bubble on the right side (your message).
4. Switch to **Factory Operator** window — **Expected:** Message appears on the left side without refreshing (real-time via WebSocket).

### Test 4.2 — Send an image

1. In the chat, click the **📎 paperclip** or **image** icon.
2. Select an image file from your computer.
3. **Expected:** Image preview shows before sending. Click Send.
4. **Expected:** Image appears as a thumbnail in the chat bubble.
5. **Expected:** Image sends quickly (compressed to under 200KB automatically).

### Test 4.3 — Send a voice message

1. Click the **🎤 microphone** button.
2. Speak for a few seconds.
3. Click **Stop** (red button in the recording bar).
4. **Expected:** A voice message bubble appears with a play button.
5. The other person should be able to click Play and hear the audio.

### Test 4.4 — Cancel a voice recording

1. Click the microphone to start recording.
2. Click the **✕ grey cancel button** (NOT the red stop button).
3. **Expected:** Recording is discarded. No message is sent.

### Test 4.5 — Send a PDF

1. Click the attachment icon.
2. Select a PDF file.
3. **Expected:** PDF appears in chat as a file with a link/preview.
4. Click on it — **Expected:** PDF opens or downloads.

### Test 4.6 — Invite a member to the ticket group (Admin/Logistics only)

1. As **Logistics** or **Admin**, open a ticket.
2. Find the **"Members"** or **"Invite"** section.
3. Enter the email of another registered user.
4. **Expected:** User is instantly added to the ticket group (no accept/reject).
5. Log in as the invited user — **Expected:** They can now see that specific ticket's chat, but NOT other tickets.

### Test 4.7 — Remove a member from the ticket group (Admin/Logistics only)

1. As **Admin** or **Logistics**, open the ticket.
2. Find the member list and click Remove next to a user.
3. **Expected:** User is removed from the ticket group and can no longer see it.

---

## PART 5 — LOGISTICS: SHIP TO FACTORY

### Test 5.1 — Click "Ship to Factory"

1. As **Logistics**, on an `Accepted` ticket, click **"Ship to Factory"**.
2. **Expected:** A popup appears asking for:
   - Carrier name (e.g. DTDC, Porter, Manual)
   - Tracking number (optional)
   - Actual quantities: Devices, SD Cards, Cables, USB Hubs, Extension Boxes
3. Fill in the quantities (they may differ from what was requested — e.g., requested 10, sending 8).
4. Click **Confirm / Ship**.
5. **Expected:**
   - Ticket status changes to `Outbound Shipped`.
   - The ticket **title updates** to reflect the actual quantities shipped.
   - A timeline event is added.

---

## PART 6 — FACTORY: CONFIRM RECEIPT

### Test 6.1 — Factory marks shipment as "Received"

1. As **Factory Operator**, open the ticket (status: `Outbound Shipped`).
2. Click **"Mark as Received"**.
3. **Expected:** Status changes to `Factory Received`. Timeline updated.

---

## PART 7 — FACTORY: SHIP ITEMS BACK TO HQ

### Test 7.1 — Factory ships items back

1. As **Factory Operator**, on a `Factory Received` ticket, click **"Ship Return to HQ"**.
2. **Expected:** A popup appears asking:
   - Carrier name and tracking number
   - Quantities being returned: Devices, SD Cards, Cables, USB Hubs, Extension Boxes
   - A note field for "Items NOT returned / sent elsewhere" (e.g., 2 devices sent to nearby factory)
3. Fill in quantities and add a note if items were not returned.
4. Click **Confirm / Ship**.
5. **Expected:** Ticket status changes to `Return Shipped`. Timeline updated.

---

## PART 8 — LOGISTICS: CONFIRM RECEIPT AT HQ (Partial allowed)

### Test 8.1 — Logistics confirms items received at HQ

1. As **Logistics**, on a `Return Shipped` ticket, click **"Confirm HQ Receipt"**.
2. **Expected:** A popup appears with fields for:
   - SD Cards received
   - Devices received
   - Cables received
   - USB Hubs received
   - Extension Boxes received
   - Optional note
3. You can enter **partial quantities** (e.g., only SD cards arrived today, devices arriving tomorrow).
4. Click **Confirm**.
5. **Expected:** Status changes to `HQ Received`. Timeline shows what was received.

---

## PART 9 — LOGISTICS: TRANSFER TO INGESTION

### Test 9.1 — Transfer ticket to Ingestion team

1. As **Logistics**, on an `HQ Received` ticket, click **"Transfer to Ingestion"**.
2. **Expected:** Status changes to `Transferred to Ingestion`.

### Test 9.2 — Ingestion team now sees the ticket

1. Switch to **Ingestion** window.
2. **Expected:** The ticket now appears in the Ingestion dashboard.
3. **Expected:** Tickets in shipping/HQ stages are still NOT visible to Ingestion.

---

## PART 10 — INGESTION: CONFIRM PHYSICAL RECEIPT & START PROCESSING

### Test 10.1 — Ingestion confirms they received the packet

1. As **Ingestion**, open the transferred ticket.
2. See the warning banner: *"Confirm you have physically received the SD card packets from Logistics before starting."*
3. Click **"✅ Confirm Receipt & Start Processing"**.
4. **Expected:** Status changes to `Ingestion Processing`.

---

## PART 11 — INGESTION: LOG PROCESSING BATCHES

### Test 11.1 — Log first batch

1. As **Ingestion**, on an `Ingestion Processing` ticket, find the **"+ Log New Batch"** form.
2. Fill in:
   - QR Code: scan or type the code from the packet label (or leave blank)
   - Package Label: e.g., `PKG-001`
   - Total SD Cards in Packet: `100`
   - Good SD Cards: `85`
   - Bad SD Cards: `10`
   - **Expected:** Missing SD Cards auto-calculates as `5`.
   - Notes: optional
3. Click **"Save Batch (Continue Later)"**.
4. **Expected:** Batch appears in the "Processing Batches" list (Batch 1). Progress bar updates.

### Test 11.2 — Log second batch

1. Add another batch with 100 total, 90 good, 8 bad → 2 missing.
2. Click **"Save Batch (Continue Later)"**.
3. **Expected:** Batch 2 appears. Progress bar shows cumulative progress.

### Test 11.3 — Mark Ingestion Done

1. On the last batch, instead of "Save Batch", click **"Save & Mark Ingestion Done"**.
2. **Expected:** Status changes to `Ingestion Completed`. 
3. If total processed (good + bad across all batches) equals the originally requested SD card count, completion is triggered automatically.

---

## PART 12 — CLOSE THE TICKET

### Test 12.1 — Close ticket (Admin or Logistics)

1. As **Admin** or **Logistics**, on an `Ingestion Completed` ticket, click **"Close Ticket"**.
2. **Expected:** Status changes to `Closed`. Ticket can still be viewed but no further actions.

---

## PART 13 — ADMIN FEATURES

### Test 13.1 — Admin can edit ticket title

1. Log in as **Admin**.
2. Open any ticket.
3. See the **ticket title** displayed at the very top (read-only for all other roles).
4. Click the **"✎ Edit"** button next to the title.
5. Change the title text and click Save.
6. **Expected:** Title updates immediately.

### Test 13.2 — Inventory page

1. As **Admin**, navigate to **Inventory**.
2. **Expected:** See a list of inventory items (devices, SD cards, cables, hubs, extension boxes) with quantities.
3. Click on an item to edit quantities.
4. **Expected:** Quantity updates and saves.

### Test 13.3 — Activity log on Inventory page

1. As **Admin**, on the Inventory page, scroll down to **"Recent Activities Log"**.
2. **Expected:** See a log of incoming/outgoing inventory events.
3. Use the filter buttons to filter by item type (SD Cards, Devices, etc.) or direction (Incoming, Outgoing).
4. Click on a log entry — **Expected:** A popup shows full details.

---

## PART 14 — QR CODE SCANNING

### Test 14.1 — View QR code for a ticket

1. Open any ticket with packages.
2. Find the QR code displayed (or click "Generate QR").
3. **Expected:** A scannable QR code image appears (not a broken/fallback SVG).

### Test 14.2 — Scan with mobile phone

1. Use your phone camera or QR scanner app.
2. Scan the QR code on screen.
3. **Expected:** Phone opens a browser link to the frontend app showing the ticket/package details.

### Test 14.3 — Scan with hardware scanner (red-light scanner)

1. Click on the **Scan** page or look for a QR input field.
2. Point the hardware scanner at the QR code.
3. **Expected:** The scanner "types" the code into the input field automatically, and the corresponding ticket/package details appear on screen.

---

## PART 15 — MOBILE RESPONSIVENESS

### Test 15.1 — Check all pages on mobile

1. Open the app on a mobile phone or use browser DevTools mobile simulation (F12 → Toggle Device Toolbar).
2. Navigate through each page:
   - Login / Register
   - Dashboard (home)
   - Ticket List
   - Ticket Detail + Chat
   - Inventory
   - Ingestion workspace
3. **Expected for each page:** All content is visible, no text is cut off, buttons are tappable, and the layout is clean.

---

## PART 16 — SERVER WAKE-UP (KEEP-ALIVE)

### Test 16.1 — Cold start banner

1. If the backend has been idle (Railway free tier), the app may show a **"Waking up server..."** banner when you first open it.
2. **Expected:** Banner disappears within 30–60 seconds once the server responds.
3. **Expected:** The app then loads normally.

---

## PART 17 — SIDEBAR & NAVIGATION

### Test 17.1 — Sidebar shows correct menu items per role

| Role | Should see |
|------|------------|
| Factory Operator | Dashboard, Tickets |
| Logistics | Dashboard, Tickets, Inventory |
| Ingestion | Dashboard, Tickets (ingestion stage only) |
| Admin | Dashboard, Tickets, Inventory, Admin panel |

### Test 17.2 — App version in sidebar

1. Look at the bottom of the sidebar.
2. **Expected:** See version like `v1.5.1 · 2026-04-01`.

---

## FULL END-TO-END FLOW SUMMARY

This is the complete lifecycle of one ticket from start to finish:

```
Factory creates ticket
       ↓
Logistics sees it (auto-poll within 30s)
       ↓
Logistics claims + accepts
       ↓
Chat between both (real-time)
       ↓
Logistics ships devices → enters quantities → title updates
       ↓
Factory marks as received
       ↓
Factory ships back → enters quantities + notes about items not returned
       ↓
Logistics confirms HQ receipt (can be partial)
       ↓
Logistics transfers to Ingestion
       ↓
Ingestion sees ticket for the first time
       ↓
Ingestion confirms physical receipt
       ↓
Ingestion logs batches (QR scan + good/bad/missing counts)
       ↓
Ingestion marks done (or auto-completes when 100% processed)
       ↓
Admin or Logistics closes the ticket
```

---

## KNOWN LIMITATIONS / THINGS TO VERIFY

| Issue | Status | What to check |
|-------|--------|---------------|
| Chat messages real-time | ✅ Fixed | Send a message, check it appears on other screen without refresh |
| Admin title edit | ✅ Fixed | Admin can now edit title from detail panel |
| Image upload speed | ✅ Fixed | Images auto-compressed to <200KB |
| Voice recording cancel button | ✅ Fixed | Grey ✕ cancels, red ■ sends |
| Ingestion only sees their stage | ✅ Working | Ingestion cannot see open/shipping/HQ tickets |
| Factory only sees their tickets | ✅ Working | Factory only sees tickets they created or were invited to |
| New ticket visibility for Logistics | ✅ Fixed | 30s auto-poll shows new tickets |
| Session expired handling | ✅ Working | Expired JWT → logout → login page |
| Backend keep-alive | ✅ Working | Ping every 4 min from client |

---

## TROUBLESHOOTING

**"Session expired" on login** → This was a bug, now fixed. If still happening, clear localStorage and try again.

**Ticket not appearing for Logistics** → Wait 30 seconds. It auto-refreshes. If still not showing, refresh the page once.

**Image/video not sending** → Check file size. Images are auto-compressed. Videos should be under 10MB.

**QR code shows a broken image** → The QR library may be generating fallback SVG. Check that the `segno` library is installed on the backend.

**"403 Forbidden" errors** → Check you are logged in with the correct role. Certain actions are role-restricted.

**Backend "Waking up..."** → Railway free tier puts the server to sleep after inactivity. Wait 30–60 seconds for it to wake up.

---

*Last updated: 2026-04-01 | Build AI Operations Platform v1.5.1*
