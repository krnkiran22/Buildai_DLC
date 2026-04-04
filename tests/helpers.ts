import { Page, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

export const BASE = "https://buildai-dlc.vercel.app";

export async function screenshot(page: Page, name: string) {
  const file = path.join(SCREENSHOT_DIR, `${Date.now()}_${name.replace(/\s+/g, "_")}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸 ${name} → ${file}`);
  return file;
}

export async function login(page: Page, email: string, password: string) {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");

  // Handle session expired overlay if present
  const expired = page.locator("text=Session expired");
  if (await expired.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.locator("button:has-text('Log in again')").click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Wait for login form
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Click sign-in/login/continue button (submit)
  await page.locator('button[type="submit"]').first().click();

  // Wait for any of these post-login indicators
  await Promise.race([
    page.waitForSelector('.app-sidebar', { timeout: 20000 }),
    page.waitForSelector('.mobile-topbar', { timeout: 20000 }),
    page.waitForSelector('[class*="sidebar"]', { timeout: 20000 }),
    page.waitForFunction(() => {
      const body = document.body.innerText;
      return body.includes("Ticket") || body.includes("Home") || body.includes("Dashboard") || body.includes("Inventory");
    }, { timeout: 20000 }),
  ]);
}

export async function logout(page: Page) {
  // Try sidebar logout button
  const logoutBtn = page.locator('button:has-text("Out"), button[title*="logout" i], button[aria-label*="logout" i]').first();
  if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutBtn.click();
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    return;
  }
  // Fallback: clear storage and navigate
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
}

export async function navigateTo(page: Page, section: string) {
  // Try clicking nav link by text
  const nav = page.locator(`nav a, .app-sidebar a, .bottom-tab-bar button, .mobile-topbar button`);
  const link = nav.filter({ hasText: new RegExp(section, "i") }).first();
  if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
    await link.click();
    await page.waitForTimeout(500);
    return;
  }
  // Fallback: look for any clickable with matching text
  await page.locator(`text=${section}`).first().click();
  await page.waitForTimeout(500);
}
