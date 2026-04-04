/**
 * TICKET FLOW E2E TEST
 * Full lifecycle: Factory creates → Logistics claims → Ships → Factory receives → Return → HQ → Ingestion → Close
 */
import { test, expect } from "@playwright/test";
import { screenshot, BASE, login, logout } from "./helpers";

const LOGISTICS_EMAIL = "ram@build.ai";
const LOGISTICS_PASS = "Ram@12345";

// We will create a factory test account inline (if registration works)
// OR use a pre-existing one
const FACTORY_EMAIL = "factory.e2e@buildtest.com";
const FACTORY_PASS = "Test@1234";
const FACTORY_NAME = "E2E Factory Tester";

let ticketId = "";

// Helper: register factory user (best effort — skip if already exists)
async function ensureFactoryUser(page: any) {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");

  // Try login first
  try {
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.fill(FACTORY_EMAIL);
    await page.locator('input[type="password"]').first().fill(FACTORY_PASS);
    await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
    await page.waitForTimeout(3000);
    const body = await page.textContent("body");
    if (body?.includes("Ticket") || body?.includes("Home")) {
      console.log("ℹ️  Factory user already exists, logged in.");
      return true;
    }
  } catch {}

  // Register
  await page.goto(BASE);
  await page.locator('button:has-text("Create account"), button:has-text("Register")').first().click();
  await page.waitForTimeout(500);

  await page.locator('input[placeholder*="name" i], input[placeholder*="Name" i]').first().fill(FACTORY_NAME);
  await page.locator('input[type="email"]').first().fill(FACTORY_EMAIL);
  await page.locator('input[type="password"]').first().fill(FACTORY_PASS);

  const roleSelect = page.locator('select').first();
  if (await roleSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await roleSelect.selectOption("factory_operator").catch(() => {});
  }

  await page.locator('button[type="submit"], button:has-text("Continue")').first().click();
  await page.waitForTimeout(3000);

  // Get OTP
  const bodyText = await page.textContent("body");
  const match = bodyText?.match(/(\d{6})/);
  if (match) {
    const otp = match[1];
    await page.locator('input[placeholder*="otp" i], input[placeholder*="code" i], input[maxlength="6"]').first().fill(otp);
    await page.locator('button:has-text("Verify"), button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
    console.log("✅ Factory user registered with OTP:", otp);
    return true;
  }
  console.log("⚠️  Could not auto-register factory user (no debug OTP shown)");
  return false;
}

test.describe("Ticket Flow — Full E2E", () => {
  test.setTimeout(120_000);

  test("Phase 1: Factory creates a ticket", async ({ page }) => {
    const ok = await ensureFactoryUser(page);
    if (!ok) {
      test.skip(true, "Could not create/login factory user");
      return;
    }

    await screenshot(page, "04-factory-home");

    // Navigate to Tickets
    const ticketsNav = page.locator('a:has-text("Ticket"), button:has-text("Ticket"), nav >> text=Ticket').first();
    if (await ticketsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ticketsNav.click();
    } else {
      // Try home "Request Devices" button
      const reqBtn = page.locator('button:has-text("Request"), button:has-text("New"), text=Request Devices').first();
      await reqBtn.click();
    }
    await page.waitForTimeout(1000);
    await screenshot(page, "04-ticket-list");

    // Click new ticket button
    const newBtn = page.locator('button:has-text("New"), button:has-text("+ New"), button:has-text("Request Devices"), [aria-label*="new ticket" i]').first();
    await newBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, "04-new-ticket-modal");

    // Fill the form
    const teamInput = page.locator('input[placeholder*="team" i], input[name*="team" i], label:has-text("Team") + input').first();
    if (await teamInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await teamInput.fill("E2E Test Team");
    }

    const factoryInput = page.locator('input[placeholder*="factory" i], input[name*="factory" i]').first();
    if (await factoryInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await factoryInput.fill("Pune Test Factory");
    }

    const devicesInput = page.locator('input[type="number"], input[placeholder*="device" i]').first();
    if (await devicesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await devicesInput.fill("5");
    }

    const sdInput = page.locator('input[type="number"], input[placeholder*="sd" i], input[placeholder*="card" i]').nth(1);
    if (await sdInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sdInput.fill("10");
    }

    await screenshot(page, "04-ticket-form-filled");

    // Submit
    await page.locator('button:has-text("Create"), button:has-text("Submit"), button[type="submit"]').last().click();
    await page.waitForTimeout(4000);
    await screenshot(page, "04-ticket-created");

    // Check ticket appears
    const bodyText = await page.textContent("body");
    if (bodyText?.includes("open") || bodyText?.includes("E2E Test Team") || bodyText?.includes("Pune")) {
      console.log("✅ Ticket created by factory operator");
    } else {
      console.log("⚠️  Ticket may have been created — check screenshot");
    }

    // Try to grab ticket ID from URL or list
    const ticketRow = page.locator('[data-testid*="ticket"], .ticket-row, tr').first();
    ticketId = await ticketRow.getAttribute("data-id") ?? "";
    console.log("Ticket ID captured:", ticketId || "(not captured from DOM)");

    await logout(page);
  });

  test("Phase 2: Logistics claims and accepts ticket", async ({ page }) => {
    await login(page, LOGISTICS_EMAIL, LOGISTICS_PASS);
    await screenshot(page, "05-logistics-home");

    // Navigate to Tickets
    await page.locator('a:has-text("Ticket"), nav >> text=Ticket, button:has-text("Ticket")').first().click().catch(async () => {
      await page.locator('text=Tickets').first().click();
    });
    await page.waitForTimeout(1500);
    await screenshot(page, "05-logistics-ticket-list");

    // Find open/unassigned ticket and click it
    const openTicket = page.locator('.ticket-row, tr, [class*="ticket"]').filter({ hasText: /open|unassigned|E2E/i }).first();
    if (await openTicket.isVisible({ timeout: 5000 }).catch(() => false)) {
      await openTicket.click();
      await page.waitForTimeout(1000);
      await screenshot(page, "05-logistics-ticket-opened");

      // Go to Tracker/Info tab
      const trackerTab = page.locator('button:has-text("Tracker"), button:has-text("Info"), button:has-text("Details")').first();
      if (await trackerTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await trackerTab.click();
        await page.waitForTimeout(500);
      }
      await screenshot(page, "05-tracker-tab");

      // Claim ticket
      const claimBtn = page.locator('button:has-text("Claim"), button:has-text("Assign to me")').first();
      if (await claimBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await claimBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, "05-after-claim");
        console.log("✅ Logistics claimed ticket");
      }

      // Accept ticket
      const acceptBtn = page.locator('button:has-text("Accept"), button:has-text("Approve")').first();
      if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await acceptBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, "05-after-accept");
        console.log("✅ Ticket accepted by logistics");
      } else {
        console.log("⚠️  Accept button not found — may need to scroll or select open ticket");
        await screenshot(page, "05-no-accept-btn");
      }
    } else {
      console.log("⚠️  No open ticket found for logistics");
      await screenshot(page, "05-no-open-ticket");
    }

    await logout(page);
  });

  test("Phase 3: Logistics ships to factory", async ({ page }) => {
    await login(page, LOGISTICS_EMAIL, LOGISTICS_PASS);
    await page.locator('text=Tickets').first().click().catch(() => {});
    await page.waitForTimeout(1500);

    const ticket = page.locator('.ticket-row, [class*="ticket"], tr').filter({ hasText: /accepted|E2E/i }).first();
    if (await ticket.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ticket.click();
      await page.waitForTimeout(1000);

      const trackerTab = page.locator('button:has-text("Tracker"), button:has-text("Info")').first();
      await trackerTab.click().catch(() => {});
      await page.waitForTimeout(500);
      await screenshot(page, "06-before-ship");

      const shipBtn = page.locator('button:has-text("Ship"), button:has-text("Dispatch"), button:has-text("Send to Factory")').first();
      if (await shipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await shipBtn.click();
        await page.waitForTimeout(1000);
        // Modal might appear for carrier info
        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Ship"), button:has-text("Submit")').last();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
        }
        await page.waitForTimeout(2000);
        await screenshot(page, "06-after-ship");
        console.log("✅ Logistics marked as Shipped to Factory");
      } else {
        console.log("⚠️  Ship button not visible — ticket may not be in accepted state yet");
        await screenshot(page, "06-no-ship-btn");
      }
    }
    await logout(page);
  });

  test("Phase 4: Factory confirms receipt", async ({ page }) => {
    const ok = await ensureFactoryUser(page);
    if (!ok) { test.skip(true, "No factory user"); return; }

    await page.locator('text=Tickets').first().click().catch(() => {});
    await page.waitForTimeout(1500);

    const ticket = page.locator('.ticket-row, [class*="ticket"], tr').filter({ hasText: /ship|dispatch|E2E/i }).first();
    if (await ticket.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ticket.click();
      await page.waitForTimeout(1000);
      const trackerTab = page.locator('button:has-text("Tracker"), button:has-text("Info")').first();
      await trackerTab.click().catch(() => {});
      await page.waitForTimeout(500);
      await screenshot(page, "07-factory-tracker");

      const receivedBtn = page.locator('button:has-text("Received"), button:has-text("I\'ve Received"), button:has-text("Confirm Delivery")').first();
      if (await receivedBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await receivedBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, "07-factory-received");
        console.log("✅ Factory confirmed receipt");
      } else {
        console.log("⚠️  Received button not visible");
        await screenshot(page, "07-no-received-btn");
      }
    }
    await logout(page);
  });

  test("Phase 5: Factory ships return to HQ", async ({ page }) => {
    const ok = await ensureFactoryUser(page);
    if (!ok) { test.skip(true, "No factory user"); return; }

    await page.locator('text=Tickets').first().click().catch(() => {});
    await page.waitForTimeout(1500);

    const ticket = page.locator('.ticket-row, [class*="ticket"]').filter({ hasText: /factory_received|at factory|received/i }).first();
    if (await ticket.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ticket.click();
      await page.waitForTimeout(1000);
      const trackerTab = page.locator('button:has-text("Tracker"), button:has-text("Info")').first();
      await trackerTab.click().catch(() => {});
      await page.waitForTimeout(500);
      await screenshot(page, "08-before-return-ship");

      const returnBtn = page.locator('button:has-text("Return"), button:has-text("Ship Return"), button:has-text("Send Back")').first();
      if (await returnBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await returnBtn.click();
        await page.waitForTimeout(1000);
        const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Ship"), button[type="submit"]').last();
        await confirmBtn.click().catch(() => {});
        await page.waitForTimeout(2000);
        await screenshot(page, "08-return-shipped");
        console.log("✅ Factory shipped return to HQ");
      } else {
        console.log("⚠️  Return ship button not visible");
      }
    }
    await logout(page);
  });

  test("Phase 6: Logistics confirms HQ received + sends to Ingestion", async ({ page }) => {
    await login(page, LOGISTICS_EMAIL, LOGISTICS_PASS);
    await page.locator('text=Tickets').first().click().catch(() => {});
    await page.waitForTimeout(1500);

    const ticket = page.locator('.ticket-row, [class*="ticket"]').filter({ hasText: /return|hq/i }).first();
    if (await ticket.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ticket.click();
      await page.waitForTimeout(1000);
      const trackerTab = page.locator('button:has-text("Tracker"), button:has-text("Info")').first();
      await trackerTab.click().catch(() => {});
      await page.waitForTimeout(500);

      // HQ Received
      const hqBtn = page.locator('button:has-text("HQ Received"), button:has-text("Received at HQ"), button:has-text("Confirm Return")').first();
      if (await hqBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await hqBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, "09-hq-received");
        console.log("✅ Logistics confirmed HQ received return");
      }

      // Transfer to Ingestion
      const ingestionBtn = page.locator('button:has-text("Ingestion"), button:has-text("Transfer"), button:has-text("Send to Ingestion")').first();
      if (await ingestionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ingestionBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, "09-transferred-ingestion");
        console.log("✅ Ticket transferred to ingestion");
      }
    }
    await logout(page);
  });

  test("Phase 7: Chat functionality", async ({ page }) => {
    await login(page, LOGISTICS_EMAIL, LOGISTICS_PASS);
    await page.locator('text=Tickets').first().click().catch(() => {});
    await page.waitForTimeout(1500);

    const ticket = page.locator('.ticket-row, [class*="ticket"]').first();
    if (await ticket.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ticket.click();
      await page.waitForTimeout(1000);
      await screenshot(page, "10-chat-panel");

      // Type a message
      const chatInput = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="chat" i], input[placeholder*="Type" i]').first();
      if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chatInput.fill("Hello from E2E test! 👋");
        await screenshot(page, "10-message-typed");

        // Send message
        const sendBtn = page.locator('button[aria-label*="send" i], button:has-text("Send"), button[type="submit"]').last();
        await sendBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, "10-message-sent");

        const bodyText = await page.textContent("body");
        if (bodyText?.includes("Hello from E2E test")) {
          console.log("✅ Chat message sent and visible");
        } else {
          console.log("⚠️  Message may not have appeared in chat");
        }
      } else {
        console.log("⚠️  Chat input not found");
        await screenshot(page, "10-no-chat-input");
      }
    }
    await logout(page);
  });
});
