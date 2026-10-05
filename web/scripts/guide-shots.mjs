// Renders the step-by-step screenshots for /share-a-date into web/public/guide/.
// The popup shots use the extension's real stylesheet, so they match what users see.
// Run: npm run guide:shots -w web   (needs Google Chrome installed)
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const out = join(root, "web/public/guide");
const popupCss = pathToFileURL(join(root, "extension/entrypoints/popup/style.css")).href;
const icon = pathToFileURL(join(root, "extension/public/icon-48.png")).href;
const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const SCENE = `
  html, body { margin: 0; }
  body.scene {
    width: auto;
    display: grid;
    place-items: center;
    min-height: 100vh;
    background: radial-gradient(60% 60% at 70% 20%, rgb(79 224 166 / 0.16), transparent 70%), #0d1310;
    font: 14px/1.45 "Avenir Next", "Segoe UI", sans-serif;
  }
  .popup { width: 360px; overflow: hidden; border-radius: 14px; background: var(--paper); color: var(--ink); box-shadow: 0 30px 70px rgb(0 0 0 / 0.5); }
  .hl { outline: 3px solid #c8f54a; outline-offset: 3px; border-radius: 10px; box-shadow: 0 0 0 8px rgb(200 245 74 / 0.25); }
  .tag { position: absolute; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: #c8f54a; color: #0b1205; font: 700 14px/1 system-ui, sans-serif; box-shadow: 0 4px 12px rgb(0 0 0 / 0.4); }
`;

const page = (body, extraCss = "") => `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="${popupCss}"><style>${SCENE}${extraCss}</style></head>
  <body class="scene">${body}</body></html>`;

const head = (state, on = true) =>
  `<header class="top"><span class="brand">Visa Slot Notifier</span><span class="state ${on ? "on" : ""}">${state}</span></header>`;
const foot = `<footer class="foot">Alerts are free.</footer>`;

const select = (labelText, value, hl = false) =>
  `<label class="field">${labelText}<select class="${hl ? "hl" : ""}"><option>${value}</option></select></label>`;

function calendar(year, month, picked, { hl = false } = {}) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const title = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const cells = Array.from({ length: first.getDay() }, () => "<span></span>");
  for (let d = 1; d <= days; d++) {
    cells.push(`<button type="button" class="${picked.includes(d) ? "on" : ""}">${d}</button>`);
  }
  return `<div class="cal ${hl ? "hl" : ""}">
    <div class="cal-head"><button type="button" class="cal-nav">‹</button><span>${title}</span><button type="button" class="cal-nav">›</button></div>
    <div class="cal-grid">${["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => `<span class="cal-dow">${d}</span>`).join("")}${cells.join("")}</div>
  </div>`;
}

function sharePopup({ picked = [], status = "", hlSelects = false, hlCalendar = false, hlButton = false }) {
  const label = picked.length > 1 ? `Share ${picked.length} dates` : picked.length ? "Share this date" : "Tap the dates you see";
  const pickedText = picked.length
    ? `${picked.map((d) => `${d} Jan`).join(", ")} · <button type="button" class="link">Clear</button>`
    : "No dates picked yet.";
  return `<div class="popup">${head("Connected")}
    <section class="share">
      <h2 class="section-title">Share a date you see</h2>
      <p class="muted small">Tap the open days you see on the official calendar, then share. Everyone watching gets a Telegram alert right away.</p>
      <form>
        <div class="${hlSelects ? "hl" : ""}" style="padding:2px 0">
          ${select("Post", "Mumbai")}${select("Type", "OFC")}${select("Visa class", "H-1B")}
        </div>
        ${calendar(2027, 0, picked, { hl: hlCalendar })}
        <p class="small picked">${pickedText}</p>
        <button class="primary wide ${hlButton ? "hl" : ""}" type="button" ${picked.length ? "" : "disabled"}>${label}</button>
      </form>
      <p class="small muted">Only share dates you can see right now. You won’t be alerted about your own share.</p>
      ${status ? `<p class="status ok hl" style="padding:4px 6px">${status}</p>` : ""}
    </section>${foot}</div>`;
}

const shots = [
  {
    name: "pin",
    size: [720, 330],
    css: `
      .browser { width: 640px; border-radius: 14px; overflow: hidden; background: #202124; color: #e8eaed; font: 13px/1.4 system-ui, sans-serif; box-shadow: 0 30px 70px rgb(0 0 0 / 0.5); }
      .bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #35363a; }
      .url { flex: 1; padding: 6px 12px; border-radius: 999px; background: #202124; color: #9aa0a6; }
      .ico { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; }
      .menu { margin: 0 14px 16px auto; width: 300px; border-radius: 10px; background: #292a2d; padding: 8px 0; box-shadow: 0 10px 30px rgb(0 0 0 / 0.5); }
      .menu h4 { margin: 4px 14px 8px; font-size: 13px; font-weight: 600; }
      .item { display: flex; align-items: center; gap: 10px; padding: 8px 14px; }
      .item img { width: 20px; height: 20px; border-radius: 4px; }
      .item span { flex: 1; }
      .item span.pin { flex: none; }
      .pin { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; color: #8ab4f8; }
      .wrapper { position: relative; padding-top: 12px; }`,
    html: `<div class="browser"><div class="bar"><span class="url">usvisascheduling.com</span>
      <span class="ico hl" style="border-radius:50%"><svg width="18" height="18" viewBox="0 0 24 24" fill="#e8eaed"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg></span></div>
      <div class="wrapper"><div class="menu"><h4>Extensions</h4>
        <div class="item"><img src="${icon}" alt=""><span>Visa Slot Notifier</span><span class="pin hl"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M9 10.8V4h6v6.8l3 3.2H6z"/></svg></span></div>
      </div></div></div>`,
  },
  {
    name: "connect",
    size: [560, 380],
    html: `<div class="popup">${head("Not connected", false)}<main>
      <p>Get a Telegram message when someone shares an open date you want.</p>
      <p class="muted">Press <b>Start</b> in Telegram to connect this browser. We never ask for your visa-site login.</p>
      <div class="row"><button class="primary hl">Connect Telegram</button><button class="link">I pressed Start</button></div></main>${foot}</div>`,
  },
  {
    name: "official",
    size: [620, 470],
    css: `
      .site { width: 520px; border-radius: 14px; overflow: hidden; background: #fff; color: #1f2933; font: 14px/1.45 system-ui, sans-serif; box-shadow: 0 30px 70px rgb(0 0 0 / 0.5); }
      .site-top { padding: 10px 16px; background: #e9eef4; color: #52606d; font-size: 12px; }
      .site-body { padding: 16px; }
      .site h3 { margin: 0 0 4px; font-size: 16px; }
      .site p { margin: 0 0 12px; color: #52606d; font-size: 13px; }
      .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; font-size: 13px; }
      .grid b { color: #7b8794; font-size: 11px; font-weight: 600; }
      .grid span { padding: 7px 0; border-radius: 6px; color: #9aa5b1; background: #f5f7fa; }
      .grid span.open { color: #fff; background: #2f855a; font-weight: 700; }
      .grid span.blank { background: none; }
      .legend { display: flex; gap: 14px; margin-top: 12px; font-size: 12px; color: #52606d; }
      .legend i { display: inline-block; width: 12px; height: 12px; margin-right: 5px; border-radius: 3px; vertical-align: -2px; }`,
    html: (() => {
      const open = [12, 14, 19];
      const cells = Array.from({ length: 5 }, () => `<span class="blank"></span>`).concat(
        Array.from({ length: 31 }, (_, i) => `<span class="${open.includes(i + 1) ? "open hl" : ""}">${i + 1}</span>`),
      );
      return `<div class="site"><div class="site-top">Example only. The official site looks different.</div><div class="site-body">
        <h3>Schedule appointment</h3><p>Location: <b>MUMBAI</b> · OFC (biometrics) · January 2027</p>
        <div class="grid">${["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => `<b>${d}</b>`).join("")}${cells.join("")}</div>
        <div class="legend"><span><i style="background:#2f855a"></i>Open</span><span><i style="background:#f5f7fa;border:1px solid #cbd2d9"></i>Not available</span></div>
      </div></div>`;
    })(),
  },
  { name: "choose", size: [560, 700], html: sharePopup({ hlSelects: true }) },
  { name: "tap", size: [560, 700], html: sharePopup({ picked: [12, 14, 19], hlCalendar: true }) },
  { name: "share", size: [560, 700], html: sharePopup({ picked: [12, 14, 19], hlButton: true }) },
  { name: "done", size: [560, 720], html: sharePopup({ status: "Shared 3 new dates. 27 alerts sent on Telegram." }) },
  {
    name: "right-click",
    size: [720, 380],
    css: `
      .doc { position: relative; width: 620px; height: 300px; border-radius: 14px; background: #fff; color: #1f2933; font: 15px/1.6 system-ui, sans-serif; box-shadow: 0 30px 70px rgb(0 0 0 / 0.5); padding: 22px 26px; box-sizing: border-box; }
      .doc mark { background: #a8c7fa; color: inherit; padding: 1px 0; }
      .ctx { position: absolute; left: 250px; top: 92px; width: 330px; padding: 6px 0; border-radius: 8px; background: #fff; color: #1f1f1f; font: 13px/1.3 system-ui, sans-serif; box-shadow: 0 6px 24px rgb(0 0 0 / 0.3); }
      .ctx div { display: flex; align-items: center; gap: 10px; padding: 7px 14px; }
      .ctx hr { margin: 5px 0; border: 0; border-top: 1px solid #e3e3e3; }
      .ctx img { width: 16px; height: 16px; }
      .ctx .hl { margin: 2px 6px; background: #f1f8e0; }`,
    html: `<div class="doc">
      <p style="margin:0 0 6px;color:#52606d;font-size:13px">Any page that shows a full date (day, month, and year)</p>
      <p style="margin:0">Earliest available date: <mark>14 Jan 2027</mark></p>
      <div class="ctx"><div>Copy</div><div>Search Google for “14 Jan 2027”</div><div>Print…</div><hr>
        <div class="hl"><img src="${icon}" alt="">Share this date with Visa Slot Notifier</div><hr><div>Inspect</div></div>
    </div>`,
  },
];

mkdirSync(out, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "vsn-guide-"));
try {
  for (const shot of shots) {
    const file = join(tmp, `${shot.name}.html`);
    writeFileSync(file, page(shot.html, shot.css));
    execFileSync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      `--window-size=${shot.size.join(",")}`,
      `--screenshot=${join(out, `${shot.name}.png`)}`,
      pathToFileURL(file).href,
    ], { stdio: "ignore" });
    console.log(`guide/${shot.name}.png`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
