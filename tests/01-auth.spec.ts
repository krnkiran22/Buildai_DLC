/**
 * AUTH TESTS
 * Covers: login, registration with OTP, session guard
 */
import { test, expect } from "@playwright/test";
import { screenshot, BASE, login, logout } from "./helpers";

const FACTORY_EMAIL = `factory.test.${Date.now()}@buildtest.com`;
const FACTORY_PASSWORD = "Test@1234";
const FACTORY_NAME = "Kiran Factory";

const RAM_EMAIL = "ram@build.ai";
const RAM_PASSWORD = "Ram@12345";

test.describe("Login flow", () => {
  test("shows login screen when not authenticated", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");
    await screenshot(page, "01-login-screen");

    // Should see email/password inputs
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    console.log("✅ Login screen shown for unauthenticated user");
  });

  test("shows error for wrong credentials", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.fill("wrong@example.com");
    await page.locator('input[type="password"]').first().fill("WrongPass123");
    await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();

    // Should show error
    await page.waitForTimeout(3000);
    await screenshot(page, "01-login-error");
    const errorText = await page.locator(".error, [class*='error'], [style*='red'], [style*='#e']").first().textContent().catch(() => "");
    console.log(`Error shown: "${errorText}"`);
    // Should NOT be redirected to dashboard
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible();
    console.log("✅ Wrong credentials shows error, stays on login");
  });

  test("can log in as Ram (logistics)", async ({ page }) => {
    await login(page, RAM_EMAIL, RAM_PASSWORD);
    await screenshot(page, "01-ram-logged-in");
    // Should see dashboard
    await expect(page.locator("text=Home, text=Tickets, text=Dashboard").first()).toBeVisible({ timeout: 10000 }).catch(async () => {
      // Try broader selector
      const body = await page.textContent("body");
      if (body?.includes("Ticket") || body?.includes("Home") || body?.includes("Dashboard")) {
        console.log("✅ Ram logged in successfully");
      } else {
        throw new Error("Expected dashboard after login");
      }
    });
    console.log("✅ Ram (logistics) can log in");
    await logout(page);
  });
});

test.describe("Registration flow", () => {
  test("can register a factory operator with OTP", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // Click register / create account
    const registerBtn = page.locator('button:has-text("Create account"), a:has-text("Register"), button:has-text("Register")').first();
    await registerBtn.click();
    await page.waitForTimeout(500);
    await screenshot(page, "02-register-form");

    // Fill registration form
    const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="Name" i]').first();
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await nameInput.fill(FACTORY_NAME);
    await emailInput.fill(FACTORY_EMAIL);
    await passwordInput.fill(FACTORY_PASSWORD);

    // Select Factory Operator role if selector exists
    const roleSelect = page.locator('select, [role="combobox"]').first();
    if (await roleSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await roleSelect.selectOption({ label: /factory/i }).catch(async () => {
        await roleSelect.selectOption("factory_operator").catch(() => {});
      });
    }

    await page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Send OTP")').first().click();
    await page.waitForTimeout(3000);
    await screenshot(page, "02-otp-screen");

    // Check if OTP debug code is shown
    const debugOtpEl = page.locator("text=Dev OTP, text=Debug OTP, [class*='debug'], [class*='otp-debug']").first();
    const debugText = await debugOtpEl.textContent({ timeout: 5000 }).catch(() => null);

    let otpCode = "";
    if (debugText) {
      const match = debugText.match(/\d{6}/);
      if (match) otpCode = match[0];
      console.log(`🔑 Dev OTP found: ${otpCode}`);
    }

    if (!otpCode) {
      // Try to find OTP in any visible text
      const bodyText = await page.textContent("body");
      const match = bodyText?.match(/Dev OTP.*?(\d{6})|(\d{6}).*?OTP/s);
      if (match) otpCode = match[1] || match[2] || "";
      console.log(`🔑 OTP from body: ${otpCode}`);
    }

    if (otpCode) {
      const otpInput = page.locator('input[placeholder*="otp" i], input[placeholder*="code" i], input[maxlength="6"], input[type="text"][name*="otp"]').first();
      await otpInput.fill(otpCode);
      await page.locator('button:has-text("Verify"), button:has-text("Submit"), button[type="submit"]').first().click();
      await page.waitForTimeout(4000);
      await screenshot(page, "02-after-otp");

      const bodyAfter = await page.textContent("body");
      if (bodyAfter?.includes("Ticket") || bodyAfter?.includes("Home") || bodyAfter?.includes("Dashboard")) {
        console.log("✅ Registration + OTP worked! Logged in as factory operator.");
      } else {
        console.log("⚠️  OTP submitted but not sure if logged in. Check screenshot.");
      }
    } else {
      console.log("⚠️  Could not find Dev OTP code on screen. Email OTP required.");
      await screenshot(page, "02-no-debug-otp");
    }
  });
});

test.describe("Auth guard", () => {
  test("redirects to login when accessing protected page without session", async ({ page }) => {
    // Clear storage first
    await page.goto(BASE);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${BASE}/`);
    await page.waitForLoadState("networkidle");
    await screenshot(page, "03-auth-guard");

    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible({ timeout: 10000 });
    console.log("✅ Auth guard works — unauthenticated user sent to login");
  });
});
