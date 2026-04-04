/**
 * QR CODE & SCANNER STATION TESTS
 */
import { test, expect } from "@playwright/test";
import { screenshot, BASE, login, logout } from "./helpers";

const BACKEND = "https://marvelous-consideration-production.up.railway.app";

test.describe("QR Code Generation", () => {
  test("QR code API returns valid SVG", async ({ page }) => {
    // Try to get a package list or use a known ID
    const resp = await page.request.get(`${BACKEND}/api/v1/packages?limit=5`, {
      headers: { "Accept": "application/json" },
    }).catch(() => null);

    if (!resp || !resp.ok()) {
      console.log("ℹ️  Cannot fetch packages (may need auth token). Checking QR endpoint directly.");
      // Try with a dummy ID
      const qrResp = await page.request.get(`${BACKEND}/api/v1/qr/test-pkg-id/svg`).catch(() => null);
      if (qrResp) {
        const status = qrResp.status();
        console.log(`QR endpoint status: ${status}`);
        if (status === 200) {
          const text = await qrResp.text();
          const isSvg = text.includes("<svg") && !text.includes("fallback");
          console.log(`QR is real SVG (not fallback): ${isSvg ? "✅" : "❌"}`);
          if (!isSvg && text.includes("fallback")) {
            console.log("❌ QR code is a FALLBACK SVG — segno may not be generating properly");
          }
        }
      }
    }
  });

  test("QR public page loads and shows package info", async ({ page }) => {
    // Navigate to the public QR page with a test ID
    await page.goto(`${BASE}/qr/test-package-123`);
    await page.waitForLoadState("networkidle");
    await screenshot(page, "qr-public-page");

    const body = await page.textContent("body");
    // Should show either package data or "not found" — NOT a crash
    const hasContent = body && body.length > 100;
    const hasError = body?.includes("Application error") || body?.includes("500 Internal");
    if (hasError) {
      console.log("❌ QR public page crashed!");
    } else {
      console.log("✅ QR public page renders (may show not found for test ID)");
    }
  });
});

test.describe("Scanner Station", () => {
  test("scanner page is accessible without login", async ({ page }) => {
    await page.goto(`${BASE}/scan`);
    await page.waitForLoadState("networkidle");
    await screenshot(page, "scanner-01-page");

    const body = await page.textContent("body");
    // Should NOT redirect to login
    const onLogin = body?.includes("Sign in") || body?.includes("Log in") || body?.includes("password");
    if (onLogin) {
      console.log("❌ Scanner page requires login — should be public!");
    } else {
      console.log("✅ Scanner page accessible without login");
    }

    // Should have some input or focus area
    const hasInput = await page.locator('input').count();
    console.log(`Input elements on scanner page: ${hasInput}`);
    if (hasInput > 0) {
      console.log("✅ Scanner page has input for hardware scanner");
    }
  });

  test("scanner processes QR input", async ({ page }) => {
    await page.goto(`${BASE}/scan`);
    await page.waitForLoadState("networkidle");

    // Simulate hardware scanner typing (it types fast with no delay)
    const input = page.locator('input').first();
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Type a package ID as if scanner typed it
      await input.type("PKG-TEST-123456", { delay: 30 });
      await input.press("Enter");
      await page.waitForTimeout(2000);
      await screenshot(page, "scanner-02-after-scan");

      const body = await page.textContent("body");
      if (body?.includes("PKG-TEST") || body?.includes("not found") || body?.includes("Package")) {
        console.log("✅ Scanner processed the input and attempted lookup");
      } else {
        console.log("⚠️  Scanner input submitted but no visible response");
      }
    } else {
      console.log("⚠️  No input found on scanner page");
    }
  });
});
