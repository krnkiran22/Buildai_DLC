/**
 * Opens a browser print dialog with a clean QR sticker layout.
 * Works with any printer connected to the computer — the user selects
 * their printer in the native browser print dialog.
 *
 * Sticker is sized for a standard 62mm × 100mm label (Brother QL / Dymo style).
 * User can adjust paper size / margins in their printer settings.
 */

export interface StickerData {
  qrToken: string;
  packageCode: string;
  title?: string | null;
  teamName?: string | null;
  factoryName?: string | null;
  deploymentDate?: string | null;
  devices?: number | null;
  sdCards?: number | null;
  cables?: number | null;
  usbHubs?: number | null;
  direction?: string | null;
  qrImageUrl: string; // full URL to the QR SVG
}

function fmtDate(s?: string | null) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return s; }
}

export function printQrSticker(data: StickerData) {
  const pw = window.open("", "_blank", "width=420,height=600,menubar=no,toolbar=no,location=no");
  if (!pw) {
    alert("Pop-up blocked! Please allow pop-ups for this site, then try again.");
    return;
  }

  const qty: string[] = [];
  if (data.devices)  qty.push(`${data.devices} Devices`);
  if (data.sdCards)  qty.push(`${data.sdCards} SD Cards`);
  if (data.cables)   qty.push(`${data.cables} Cables`);
  if (data.usbHubs)  qty.push(`${data.usbHubs} USB Hubs`);

  const dirLabel = data.direction === "outbound"
    ? "▶ OUTBOUND — To Factory"
    : data.direction === "inbound"
    ? "◀ RETURN — To HQ"
    : data.direction
    ? data.direction.toUpperCase()
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sticker — ${data.packageCode}</title>
<style>
  /* ── Page setup for label printer ── */
  @page {
    size: 62mm 100mm;
    margin: 3mm;
  }

  /* ── Fallback for regular printers (A4): sticker fits in top-left ── */
  @media print {
    html, body { margin: 0; padding: 0; background: #fff; }
    .no-print { display: none !important; }
    .sticker { box-shadow: none !important; border: 1px solid #000 !important; }
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 12px;
    background: #f5f5f5;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
  }

  /* Print button — only visible on screen */
  .no-print {
    margin-bottom: 16px;
    display: flex;
    gap: 8px;
  }
  .no-print button {
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    border-radius: 6px;
    letter-spacing: 0.02em;
  }
  .btn-print  { background: #111; color: #fff; }
  .btn-close  { background: #e5e7eb; color: #111; }

  /* ── Sticker card ── */
  .sticker {
    width: 240px;
    border: 2px solid #111;
    background: #fff;
    padding: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  /* Top: brand */
  .brand {
    background: #111;
    color: #fff;
    text-align: center;
    padding: 5px 8px 4px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }

  /* QR image */
  .qr-wrap {
    display: flex;
    justify-content: center;
    padding: 10px 10px 6px;
  }
  .qr-wrap img {
    width: 140px;
    height: 140px;
    display: block;
    image-rendering: pixelated;
  }

  /* Package code */
  .pkg-code {
    text-align: center;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.04em;
    font-family: 'Courier New', monospace;
    padding: 0 8px 6px;
    color: #111;
  }

  /* Direction badge */
  .direction {
    margin: 0 10px 6px;
    padding: 4px 8px;
    background: #111;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* Info rows */
  .info {
    border-top: 1px solid #e5e5e5;
    padding: 6px 10px;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 2px 0;
    font-size: 10px;
  }
  .info-label {
    color: #888;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 8.5px;
    flex-shrink: 0;
    margin-right: 6px;
  }
  .info-value {
    color: #111;
    font-weight: 700;
    text-align: right;
    word-break: break-word;
  }

  /* Quantities strip */
  .qty-strip {
    border-top: 1px solid #e5e5e5;
    padding: 6px 10px;
    font-size: 9.5px;
    font-weight: 700;
    color: #111;
    text-align: center;
    line-height: 1.5;
  }

  /* Footer */
  .footer {
    border-top: 1px solid #e5e5e5;
    padding: 4px 8px;
    text-align: center;
    font-size: 8px;
    color: #aaa;
    font-family: 'Courier New', monospace;
  }
</style>
</head>
<body>

<!-- Screen-only: print controls -->
<div class="no-print">
  <button class="btn-print" onclick="window.print()">🖨 Print Sticker</button>
  <button class="btn-close" onclick="window.close()">✕ Close</button>
</div>

<!-- The sticker -->
<div class="sticker">
  <div class="brand">BUILD AI — OPERATIONS</div>

  <div class="qr-wrap">
    <img src="${data.qrImageUrl}" alt="QR Code" />
  </div>

  <div class="pkg-code">${data.packageCode}</div>

  ${dirLabel ? `<div class="direction">${dirLabel}</div>` : ""}

  <div class="info">
    ${data.title ? `
    <div class="info-row">
      <span class="info-label">Ticket</span>
      <span class="info-value">${data.title}</span>
    </div>` : ""}
    ${data.teamName ? `
    <div class="info-row">
      <span class="info-label">Team</span>
      <span class="info-value">${data.teamName}</span>
    </div>` : ""}
    ${data.factoryName ? `
    <div class="info-row">
      <span class="info-label">Factory</span>
      <span class="info-value">${data.factoryName}</span>
    </div>` : ""}
    ${data.deploymentDate ? `
    <div class="info-row">
      <span class="info-label">Deploy Date</span>
      <span class="info-value">${fmtDate(data.deploymentDate)}</span>
    </div>` : ""}
  </div>

  ${qty.length > 0 ? `
  <div class="qty-strip">
    ${qty.join(" · ")}
  </div>` : ""}

  <div class="footer">buildai-dlc.vercel.app/qr/${data.qrToken}</div>
</div>

</body>
</html>`;

  pw.document.open();
  pw.document.write(html);
  pw.document.close();
  pw.focus();
  // Auto-trigger print after QR image loads
  pw.onload = () => { setTimeout(() => pw.print(), 300); };
}
