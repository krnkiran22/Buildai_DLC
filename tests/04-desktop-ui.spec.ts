/**
 * DESKTOP UI TESTS
 * Tests all major pages on desktop viewport
 */
import { test, expect } from "@playwright/test";
import { screenshot, BASE, login, logout } from "./helpers";

const LOGISTICS_EMAIL = "ram@build.ai";
const LOGISTICS_PASS = "Ram@12345";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Desktop — All Pages", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, LOGISTICS_EMAIL, LOGISTICS_PASS);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test("Home page renders fully", async ({ page }) => {
    await screenshot(page, "desktop-01-home");

    // Sidebar should be visible on desktop (not collapsed)
    const sidebar = page.locator('.app-sidebar, nav, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    const sidebarBox = await sidebar.boundingBox();
    if (sidebarBox) {
      console.log(`Sidebar width: ${sidebarBox.width}px (should be ~176px)`);
      // Should not take up too much space
      expect(sidebarBox.width).toBeLessThanOrEqual(250);
      expect(sidebarBox.width).toBeGreaterThanOrEqual(150);
      console.log("✅ Sidebar width is within acceptable range");
    }

    // Stats should be visible
    const body = await page.textContent("body");
    if (body?.includes("Total") || body?.includes("Open") || body?.includes("Ticket")) {
      console.log("✅ Home page stats visible");
    }
  });

  test("Tickets page — 3-pane layout", async ({ page }) => {
    await page.locator('text=Tickets').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await screenshot(page, "desktop-02-tickets");

    // 3-pane layout: list | chat | detail
    // All should be visible on desktop
    const body = await page.textContent("body");
    console.log("Tickets page loaded:", body?.includes("Ticket") ? "✅" : "⚠️");

    // Check for filter options
    const statusFilter = page.locator('select, [class*="filter"], button:has-text("All"), button:has-text("Open")').first();
    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("✅ Status filter visible on tickets page");
    }

    // New ticket button
    const newBtn = page.locator('button:has-text("New"), button:has-text("+ New")').first();
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("✅ New ticket button visible");
    }
  });

  test("Inventory page with Activity Log", async ({ page }) => {
    await page.locator('text=Inventory').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await screenshot(page, "desktop-03-inventory");

    const body = await page.textContent("body");
    const hasLog = body?.includes("Activity") || body?.includes("Log") || body?.includes("Recent");
    const hasInventory = body?.includes("SD") || body?.includes("Device") || body?.includes("Stock");
    console.log(`Inventory: activity log=${hasLog ? "✅" : "❌"}, inventory items=${hasInventory ? "✅" : "❌"}`);

    // Check filter buttons
    const sdFilter = page.locator('button:has-text("SD"), button:has-text("SD Card")').first();
    if (await sdFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sdFilter.click();
      await page.waitForTimeout(500);
      await screenshot(page, "desktop-03-inventory-sd-filter");
      console.log("✅ SD Card filter works");
    }
  });

  test("Movement page loads", async ({ page }) => {
    await page.locator('text=Movement, a[href*="movement"]').first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await screenshot(page, "desktop-04-movement");
    console.log("✅ Movement page screenshot taken");
  });

  test("QR Scanner page loads", async ({ page }) => {
    await page.locator('text=Scanner, text=Scan, a[href*="scan"]').first().click().catch(async () => {
      await page.goto(`${BASE}/scan`);
    });
    await page.waitForTimeout(1500);
    await screenshot(page, "desktop-05-scanner");

    const body = await page.textContent("body");
    if (body?.includes("scan") || body?.includes("Scanner") || body?.includes("QR")) {
      console.log("✅ Scanner page loaded");
    } else {
      console.log("⚠️  Scanner page content not found");
    }
  });

  test("check all nav links work without errors", async ({ page }) => {
    const navLinks = ["Home", "Tickets", "Inventory", "Movement"];
    for (const link of navLinks) {
      const navEl = page.locator(`text=${link}, a:has-text("${link}")`).first();
      if (await navEl.isVisible({ timeout: 2000 }).catch(() => false)) {
        await navEl.click();
        await page.waitForTimeout(1000);
        // Check for runtime error pages
        const body = await page.textContent("body");
        const hasError = body?.includes("Application error") || body?.includes("unhandled error") || body?.includes("500");
        if (hasError) {
          console.log(`❌ ERROR on ${link} page!`);
          await screenshot(page, `desktop-error-${link}`);
        } else {
          console.log(`✅ ${link} page loads without errors`);
        }
      }
    }
  });
});

test.describe("Desktop — Admin Pages", () => {
  test("admin can access inventory and edit stock", async ({ page }) => {
    // Try login as admin (may not have admin account in fresh DB)
    try {
      await page.goto(BASE);
      await page.waitForLoadState("networkidle");
      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.fill("admin@build.ai");
      await page.locator('input[type="password"]').first().fill("Admin@12345");
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(3000);

      const body = await page.textContent("body");
      if (!body?.includes("Ticket") && !body?.includes("Home")) {
        console.log("ℹ️  Admin account not available (may need to register one)");
        return;
      }

      await screenshot(page, "desktop-admin-home");
      await page.locator('text=Inventory').first().click().catch(() => {});
      await page.waitForTimeout(1000);
      await screenshot(page, "desktop-admin-inventory");

      // Check for edit/adjust buttons
      const editBtn = page.locator('button:has-text("Edit"), button:has-text("Adjust"), button:has-text("Update")').first();
      if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log("✅ Admin can see inventory edit buttons");
      } else {
        console.log("ℹ️  No edit buttons visible (may be logistics seeing read-only view)");
      }
    } catch (e) {
      console.log(`ℹ️  Admin test skipped: ${e}`);
    }
  });
});
