import {
  APPOINTMENT_KINDS,
  MAX_DAYS_AHEAD,
  POSTS,
  VISA_CLASSES,
  isAppointmentKind,
  isPostId,
  isVisaClassId,
  type AppointmentKind,
  type PostId,
  type VisaClassId,
} from "@visa-slot/shared";
import { storage } from "#imports";
import { ApiError, shareDates } from "../../src/api";
import { isoDay, localToday } from "../../src/dates";
import { PENDING_SHARE_MS, pendingShare } from "../../src/pending-share";

type ShareChoice = { post: PostId | null; kind: AppointmentKind | null; visaClass: VisaClassId | null };

/** The last post, type, and visa class shared, so the next share only needs dates. */
const shareChoice = storage.defineItem<ShareChoice>("local:shareChoice", {
  fallback: { post: null, kind: null, visaClass: null },
});

/** Matches the server's per-share limit. */
const MAX_DATES = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const monthTitle = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const shortDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLabel = (iso: string) => shortDay.format(new Date(`${iso}T00:00:00Z`));

const select = (name: string, prompt: string, options: readonly { id: string; label: string }[], selected: string | null) => `
  <label class="field">${prompt}
    <select name="${name}" required>
      <option value="">Choose</option>
      ${options.map((o) => `<option value="${o.id}" ${selected === o.id ? "selected" : ""}>${o.label}</option>`).join("")}
    </select>
  </label>`;

function resultText(shared: number, newSlots: number, alerted: number): string {
  if (newSlots === 0) {
    return shared === 1 ? "Someone already shared this date. Thanks for checking." : "Someone already shared these dates. Thanks for checking.";
  }
  const known = shared - newSlots;
  const parts = [`Shared ${newSlots} new date${newSlots === 1 ? "" : "s"}`];
  if (known) parts.push(`${known} already shared`);
  const who = alerted === 0 ? "Nobody is watching them yet." : `${alerted} alert${alerted === 1 ? "" : "s"} sent on Telegram.`;
  return `${parts.join(", ")}. ${who}`;
}

export function renderShareHint(root: HTMLElement) {
  root.innerHTML = `
    <h2 class="section-title">Share a date you see</h2>
    <p class="muted small">Connect Telegram first. When you see open dates on the official site, tap them here. Everyone watching gets one message and books it themselves.</p>`;
}

/** The user picks dates they saw themselves; nothing reads the scheduling site. */
export async function renderShare(root: HTMLElement, linkKey: string) {
  const [choice, pending] = await Promise.all([shareChoice.getValue(), pendingShare.getValue()]);
  await pendingShare.setValue(null);

  const today = localToday();
  const latest = localToday(new Date(Date.now() + MAX_DAYS_AHEAD * DAY_MS));
  const fresh = pending && Date.now() - pending.at < PENDING_SHARE_MS ? pending : null;
  const fromMenu = fresh?.dates.filter((d) => d >= today && d <= latest).slice(0, MAX_DATES) ?? [];
  const selected = new Set(fromMenu);
  const start = new Date(`${fromMenu[0] ?? today}T00:00:00`);
  let viewYear = start.getFullYear();
  let viewMonth = start.getMonth();

  root.innerHTML = `
    <h2 class="section-title">Share a date you see</h2>
    <p class="muted small">Tap the open days you see on the official calendar, then share. Everyone watching gets one Telegram message and books it themselves.</p>
    <form id="share-form">
      ${select("post", "Post", POSTS, choice.post)}
      ${select("kind", "Type", APPOINTMENT_KINDS, choice.kind)}
      ${select("visaClass", "Visa class", VISA_CLASSES, choice.visaClass)}
      <div class="cal" id="cal"></div>
      <p class="small picked" id="picked"></p>
      <button class="primary wide" type="submit" id="share-button"></button>
    </form>
    <p class="small muted">Only share dates you can see right now. You won’t be alerted about your own share. Tip: highlight a date on any page and right-click to share it.</p>
    <p class="status" id="share-status"></p>`;

  const form = root.querySelector<HTMLFormElement>("#share-form")!;
  const cal = root.querySelector<HTMLElement>("#cal")!;
  const picked = root.querySelector<HTMLElement>("#picked")!;
  const button = root.querySelector<HTMLButtonElement>("#share-button")!;
  const status = root.querySelector<HTMLElement>("#share-status")!;
  const value = (name: string) => form.querySelector<HTMLSelectElement>(`[name="${name}"]`)!.value;
  const show = (text: string, tone: "muted" | "warn" | "error" | "ok") => {
    status.className = `status ${tone}`;
    status.textContent = text;
  };

  const renderSelection = () => {
    const dates = [...selected].sort();
    picked.innerHTML = dates.length
      ? `${dates.map(dayLabel).join(", ")} · <button type="button" class="link" id="clear">Clear</button>`
      : "No dates picked yet.";
    picked.querySelector("#clear")?.addEventListener("click", () => {
      selected.clear();
      renderCalendar();
    });
    button.textContent =
      dates.length > 1 ? `Share ${dates.length} dates` : dates.length ? "Share this date" : "Tap the dates you see";
    button.disabled = dates.length === 0;
  };

  const renderCalendar = () => {
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstIso = isoDay(viewYear, viewMonth + 1, 1);
    const lastIso = isoDay(viewYear, viewMonth + 1, daysInMonth);
    const cells = Array.from({ length: first.getDay() }, () => `<span></span>`);
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoDay(viewYear, viewMonth + 1, day);
      const off = iso < today || iso > latest;
      const classes = [selected.has(iso) && "on", iso === today && "today"].filter(Boolean).join(" ");
      cells.push(
        `<button type="button" data-date="${iso}" class="${classes}" ${off ? "disabled" : ""} aria-pressed="${selected.has(iso)}">${day}</button>`,
      );
    }
    cal.innerHTML = `
      <div class="cal-head">
        <button type="button" class="cal-nav" data-step="-1" ${firstIso <= today ? "disabled" : ""} aria-label="Previous month">‹</button>
        <span>${monthTitle.format(first)}</span>
        <button type="button" class="cal-nav" data-step="1" ${lastIso >= latest ? "disabled" : ""} aria-label="Next month">›</button>
      </div>
      <div class="cal-grid">${WEEKDAYS.map((d) => `<span class="cal-dow">${d}</span>`).join("")}${cells.join("")}</div>`;
    renderSelection();
  };

  cal.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!target || target.disabled) return;
    if (target.dataset.step) {
      const next = new Date(viewYear, viewMonth + Number(target.dataset.step), 1);
      viewYear = next.getFullYear();
      viewMonth = next.getMonth();
    } else if (target.dataset.date) {
      const iso = target.dataset.date;
      if (selected.has(iso)) selected.delete(iso);
      else if (selected.size >= MAX_DATES) {
        show(`You can share up to ${MAX_DATES} dates at once.`, "warn");
        return;
      } else selected.add(iso);
    }
    renderCalendar();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const post = value("post");
    const kind = value("kind");
    const visaClass = value("visaClass");
    const dates = [...selected].sort();
    if (!isPostId(post) || !isAppointmentKind(kind) || !isVisaClassId(visaClass) || !dates.length) {
      show("Choose the post, type, visa class, and at least one date.", "warn");
      return;
    }

    await shareChoice.setValue({ post, kind, visaClass });
    button.disabled = true;
    show("Sharing…", "muted");
    try {
      const { newSlots, alerted } = await shareDates(linkKey, { post, kind, visaClass, dates });
      show(resultText(dates.length, newSlots, alerted), "ok");
      selected.clear();
      renderCalendar();
    } catch (error) {
      show(error instanceof ApiError ? error.message : "Could not share. Try again.", "error");
      button.disabled = false;
    }
  });

  renderCalendar();
  if (fresh && !fresh.dates.length) {
    show("No full date (day, month, and year) in the text you highlighted. Tap the dates below instead.", "warn");
  } else if (fresh && !fromMenu.length) {
    const dates = fresh.dates.slice(0, 3).map(dayLabel).join(", ");
    show(`${dates} ${fresh.dates.length === 1 ? "is" : "are"} in the past or more than two years ahead, so ${fresh.dates.length === 1 ? "it" : "they"} can’t be shared.`, "warn");
  } else if (fromMenu.length) {
    show(`Picked ${fromMenu.length} date${fromMenu.length === 1 ? "" : "s"} from your highlight. Check them, then share.`, "muted");
  }
}
