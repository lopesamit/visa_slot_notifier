import {
  APPOINTMENT_KINDS,
  BOT_USERNAME,
  DONATIONS_ENABLED,
  KOFI_URL,
  POSTS,
  VISA_CLASSES,
} from "@visa-slot/shared";
import { browser } from "#imports";
import {
  ApiError,
  disconnectTelegram,
  fetchSubscription,
  saveFilters,
  type Filters,
} from "../../src/api";
import { getIdentity } from "../../src/identity";
import { renderShare, renderShareHint } from "./share";
import "./style.css";

const app = document.getElementById("app")!;
const shareRoot = document.getElementById("share")!;
const stateLabel = document.getElementById("state")!;
if (DONATIONS_ENABLED) {
  const kofi = document.getElementById("kofi")!;
  kofi.setAttribute("href", KOFI_URL);
  kofi.hidden = false;
}

const POLL_MS = 2000;
const POLL_LIMIT_MS = 2 * 60 * 1000;
const SAVE_DELAY_MS = 400;

let linkKey = "";
let pollTimer: number | undefined;

const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : "Something went wrong. Try again.";

function setState(text: string, on = false) {
  stateLabel.textContent = text;
  stateLabel.classList.toggle("on", on);
}

function showError(error: unknown) {
  setState("");
  shareRoot.innerHTML = "";
  app.innerHTML = `<p class="error"></p><button class="primary" id="retry">Try again</button>`;
  app.querySelector(".error")!.textContent = errorMessage(error);
  app.querySelector("#retry")!.addEventListener("click", load);
}

async function load() {
  window.clearTimeout(pollTimer);
  try {
    linkKey = (await getIdentity()).linkKey;
    const subscription = await fetchSubscription(linkKey);
    if (subscription.connected) showSettings(subscription);
    else showConnect();
  } catch (error) {
    showError(error);
  }
}

function showConnect(waiting = false) {
  setState("Not connected");
  renderShareHint(shareRoot);
  app.innerHTML = `
    <p>Get a Telegram message when someone shares an open date you want.</p>
    <p class="muted">Press <b>Start</b> in Telegram to connect this browser. We never ask for your visa-site login.</p>
    <div class="row">
      <button class="primary" id="connect">Connect Telegram</button>
      <button class="link" id="check">I pressed Start</button>
    </div>
    <p class="status muted" id="status">${waiting ? "Waiting for you to press Start in Telegram…" : ""}</p>`;

  app.querySelector("#connect")!.addEventListener("click", async () => {
    await browser.tabs.create({ url: `https://t.me/${BOT_USERNAME}?start=${linkKey}` });
    pollUntilConnected(Date.now());
  });
  app.querySelector("#check")!.addEventListener("click", load);
  if (waiting) pollUntilConnected(Date.now());
}

function pollUntilConnected(startedAt: number) {
  const status = app.querySelector("#status");
  if (status) status.textContent = "Waiting for you to press Start in Telegram…";
  window.clearTimeout(pollTimer);
  pollTimer = window.setTimeout(async () => {
    try {
      const subscription = await fetchSubscription(linkKey);
      if (subscription.connected) {
        showSettings(subscription);
        return;
      }
    } catch {
      // Keep waiting; a failed poll is retried on the next tick.
    }
    if (Date.now() - startedAt < POLL_LIMIT_MS) pollUntilConnected(startedAt);
    else if (status) status.textContent = "Still not connected. Press Start in Telegram, then tap “I pressed Start”.";
  }, POLL_MS);
}

const chipGroup = (
  name: keyof Pick<Filters, "posts" | "visaClasses" | "kinds">,
  legend: string,
  options: readonly { id: string; label: string }[],
  selected: string[],
) => `
  <fieldset>
    <legend>${legend}</legend>
    <div class="chips">
      ${options
        .map(
          (o) =>
            `<label><input type="checkbox" name="${name}" value="${o.id}" ${
              selected.includes(o.id) ? "checked" : ""
            } />${o.label}</label>`,
        )
        .join("")}
    </div>
  </fieldset>`;

function readForm(form: HTMLFormElement): Filters {
  const checked = (name: string) =>
    [...form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map((i) => i.value);
  const date = (name: string) => form.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value || null;
  return {
    posts: checked("posts") as Filters["posts"],
    visaClasses: checked("visaClasses") as Filters["visaClasses"],
    kinds: checked("kinds") as Filters["kinds"],
    dateFrom: date("dateFrom"),
    dateTo: date("dateTo"),
    paused: !form.querySelector<HTMLInputElement>('input[name="alertsOn"]')!.checked,
  };
}

function summary(filters: Filters): { text: string; tone: "muted" | "warn" } {
  if (!filters.posts.length || !filters.visaClasses.length || !filters.kinds.length) {
    return { text: "Pick at least one post, one visa class, and one type to get alerts.", tone: "warn" };
  }
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    return { text: "The start date is after the end date.", tone: "warn" };
  }
  return filters.paused
    ? { text: "Alerts are paused.", tone: "warn" }
    : { text: "Alerts are on. Matches go to your Telegram chat.", tone: "muted" };
}

function showSettings(filters: Filters) {
  window.clearTimeout(pollTimer);
  void renderShare(shareRoot, linkKey);
  setState(filters.paused ? "Paused" : "Connected", !filters.paused);
  app.innerHTML = `
    <form id="filters">
      ${chipGroup("posts", "Posts", POSTS, filters.posts)}
      ${chipGroup("visaClasses", "Visa classes", VISA_CLASSES, filters.visaClasses)}
      ${chipGroup("kinds", "Appointment type", APPOINTMENT_KINDS, filters.kinds)}
      <fieldset>
        <legend>Dates <span class="muted">(optional)</span></legend>
        <div class="dates">
          <label>From<input type="date" name="dateFrom" value="${filters.dateFrom ?? ""}" /></label>
          <label>Until<input type="date" name="dateTo" value="${filters.dateTo ?? ""}" /></label>
        </div>
      </fieldset>
      <label class="toggle"><input type="checkbox" name="alertsOn" ${filters.paused ? "" : "checked"} />Send me alerts</label>
    </form>
    <p class="status" id="status"></p>
    <button class="link" id="disconnect">Disconnect Telegram</button>`;

  const form = app.querySelector<HTMLFormElement>("#filters")!;
  const status = app.querySelector<HTMLElement>("#status")!;
  const showSummary = (current: Filters, suffix = "") => {
    const { text, tone } = summary(current);
    status.className = `status ${tone}`;
    status.textContent = suffix ? `${suffix} ${text}` : text;
  };
  showSummary(filters);

  let saveTimer: number | undefined;
  form.addEventListener("change", () => {
    const current = readForm(form);
    showSummary(current, "Saving…");
    window.clearTimeout(saveTimer);
    if (current.dateFrom && current.dateTo && current.dateFrom > current.dateTo) return;
    saveTimer = window.setTimeout(async () => {
      try {
        const saved = await saveFilters(linkKey, current);
        if (!saved.connected) {
          showConnect();
          return;
        }
        setState(saved.paused ? "Paused" : "Connected", !saved.paused);
        showSummary(saved, "Saved.");
      } catch (error) {
        status.className = "status error";
        status.textContent = errorMessage(error);
      }
    }, SAVE_DELAY_MS);
  });

  app.querySelector("#disconnect")!.addEventListener("click", async () => {
    try {
      await disconnectTelegram(linkKey);
      showConnect();
    } catch (error) {
      status.className = "status error";
      status.textContent = errorMessage(error);
    }
  });
}

load();
