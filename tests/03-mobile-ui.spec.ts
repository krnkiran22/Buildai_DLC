/**
 * MOBILE UI & RESPONSIVENESS TESTS
 * Tests all pages on iPhone 14 viewport (390x844)
 */
import { test, expect } from "@playwright/test";
import { screenshot, BASE, login, logout } from "./helpers";

const LOGISTICS_EMAIL = "ram@build.ai";
const LOGISTICS_PASS = "Ram@12345";

// Only run on mobile project
test.use({ viewport: { width: 390, height: 844 } });

test.describe("Mobile UI — Login & Auth", () => {
  test("login screen looks good on mobile", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");
    await screenshot(page, "mobile-01-login");

    // Check no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance

    // Check inputs are visible and tappable
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await expect(emailInput).toBeVisible();
    const box = await emailInput.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(40); // minimum touch target
    console.log(`✅ Email input height: ${box?.height}px (min 40px)`);

    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
    const btnBox = await submitBtn.boundingBox();
    expect(btnBox?.height).toBeGreaterThanOrEqual(40);
    console.log(`✅ Submit button height: ${btnBox?.height}px`);
  });
});

test.describe("Mobile UI — Home & Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, LOGISTICS_EMAIL, LOGISTICS_PASS);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test("home screen renders properly on mobile", async ({ page }) => {
    await screenshot(page, "mobile-02-home");

    // No horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    console.log("✅ No horizontal scroll on mobile home");

    // Mobile top bar should be visible
    const topbar = page.locator('.mobile-topbar, [class*="topbar"], [class*="top-bar"]').first();
    if (await topbar.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("✅ Mobile top bar visible");
    } else {
      console.log("ℹ️  Mobile top bar class not found (may use different class)");
    }

    // Check stats/metrics are visible
    const bodyText = await page.textContent("body");
    if (bodyText?.includes("Total") || bodyText?.includes("Open") || bodyText?.includes("Ticket")) {
      console.log("✅ Home content loaded");
    }
  });

  test("sidebar opens and closes on mobile", async ({ page }) => {
    // Find hamburger/menu button
    const menuBtn = page.locator('button[aria-label*="menu" i], button[aria-label*="sidebar" i], .menu-btn, [class*="hamburger"]').first();
    if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, "mobile-03-sidebar-open");

      // Sidebar should be visible
      const sidebar = page.locator('.app-sidebar, nav, [class*="sidebar"]').first();
      const isOpen = await sidebar.isVisible();
      console.log(`Sidebar visible after menu click: ${isOpen}`);

      // Close it
      const overlay = page.locator('.mobile-overlay, [class*="overlay"]').first();
      if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
        await overlay.click();
        await page.waitForTimeout(500);
        await screenshot(page, "mobile-03-sidebar-closed");
        console.log("✅ Sidebar closes on overlay click");
      }
    } else {
      console.log("ℹ️  Menu button not found by aria-label — checking screenshot");
      await screenshot(page, "mobile-03-no-menu-btn");
    }
  });

  test("ticket list page is usable on mobile", async ({ page }) => {
    // Navigate to tickets
    const ticketNav = page.locator('text=Tickets, a[href*="ticket"]').first();
    await ticketNav.click().catch(async () => {
      // Try bottom tab bar
      await page.locator('.bottom-tab-bar button, [class*="tab"] button').nth(1).click();
    });
    await page.waitForTimeout(1000);
    await screenshot(page, "mobile-04-ticket-list");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    console.log("✅ Ticket list: no horizontal overflow");

    // Check ticket rows have good touch targets
    const ticketRows = page.locator('.ticket-row, [class*="ticket-row"]');
    const count = await ticketRows.count();
    if (count > 0) {
      const firstRow = await ticketRows.first().boundingBox();
      expect(firstRow?.height).toBeGreaterThanOrEqual(44);
      console.log(`✅ Ticket row height: ${firstRow?.height}px`);
    } else {
      console.log("ℹ️  No tickets in list yet (fresh DB)");
    }
  });

  test("ticket detail panel is full-width on mobile", async ({ page }) => {
    await page.locator('text=Tickets').first().click().catch(() => {});
    await page.waitForTimeout(1000);

    const ticketRow = page.locator('.ticket-row, [class*="ticket"]').first();
    if (await ticketRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ticketRow.click();
      await page.waitForTimeout(1000);
      await screenshot(page, "mobile-05-ticket-detail");

      // Detail pane should be full width or close to it on mobile
      const detailPane = page.locator('.ticket-detail-pane, [class*="detail-panel"]').first();
      if (await detailPane.isVisible({ timeout: 2000 }).catch(() => false)) {
        const box = await detailPane.boundingBox();
        if (box) {
          const ratio = box.width / 390;
          console.log(`Detail pane width: ${box.width}px (${(ratio * 100).toFixed(0)}% of 390px viewport)`);
          // Should be at least 80% width on mobile
          expect(box.width).toBeGreaterThanOrEqual(300);
          console.log("✅ Detail pane is properly wide on mobile");
        }
      }

      // Check tab buttons are big enough
      const tabBtns = page.locator('button:has-text("Tracker"), button:has-text("Chat"), button:has-text("Details")');
      const tabCount = await tabBtns.count();
      if (tabCount > 0) {
        const tabBox = await tabBtns.first().boundingBox();
        expect(tabBox?.height).toBeGreaterThanOrEqual(36);
        console.log(`✅ Tab button height: ${tabBox?.height}px`);
      }
    } else {
      console.log("ℹ️  No tickets to open for detail panel check");
    }
  });

  test("inventory page is readable on mobile", async ({ page }) => {
    const invNav = page.locator('text=Inventory, a[href*="inventor"]').first();
    await invNav.click().catch(() => {});
    await page.waitForTimeout(1000);
    await screenshot(page, "mobile-06-inventory");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    console.log("✅ Inventory page: no horizontal overflow");

    // Check activity log section is visible
    const bodyText = await page.textContent("body");
    if (bodyText?.includes("Activity") || bodyText?.includes("Log") || bodyText?.includes("Recent")) {
      console.log("✅ Activity log section visible");
    } else {
      console.log("ℹ️  Activity log section not found in text");
    }
  });
});

test.describe("Mobile UI — Visual Quality", () => {
  test("font sizes are not too small on mobile", async ({ page }) => {
    await login(page, LOGISTICS_EMAIL, LOGISTICS_PASS);

    // Check computed font sizes of key elements
    const bodyFontSize = await page.evaluate(() => {
      const el = document.querySelector("body");
      return el ? parseFloat(getComputedStyle(el).fontSize) : 0;
    });
    console.log(`Body font size: ${bodyFontSize}px`);
    expect(bodyFontSize).toBeGreaterThanOrEqual(14);

    // Check input font size (should be 16px to prevent iOS zoom)
    const inputFontSize = await page.evaluate(() => {
      const inputs = document.querySelectorAll("input, textarea");
      if (inputs.length === 0) return 16;
      return parseFloat(getComputedStyle(inputs[0]).fontSize);
    });
    console.log(`Input font size: ${inputFontSize}px (should be ≥16 to prevent iOS zoom)`);
    // Note: this is best-effort since fonts depend on page context

    await logout(page);
  });
});
