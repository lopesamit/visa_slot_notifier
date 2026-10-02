import { APPOINTMENT_KINDS, POSTS, VISA_CLASSES, isVisaClassId } from "@visa-slot/shared";
import { lastReport, reporterSettings, type LastReport } from "../../src/reporter-settings";

const label = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((item) => item.id === id)?.label ?? id;

const RESULT_TEXT: Record<LastReport["result"], string> = {
  shared: "new, alerts sent",
  "already-shared": "already known",
  "rate-limited": "skipped, too many reports",
  failed: "could not reach the server",
};

function ago(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(at).toLocaleDateString();
}

function lastReportText(report: LastReport | null): string {
  if (!report) return "Open the scheduling calendar on usvisascheduling.com and the dates it shows are shared.";
  const where = `${label(POSTS, report.post)} ${label(APPOINTMENT_KINDS, report.kind)}`;
  const what = `${report.dates} date${report.dates === 1 ? "" : "s"} for ${where}, ${label(VISA_CLASSES, report.visaClass)}`;
  return `Last shared ${ago(report.at)}: ${what} (${RESULT_TEXT[report.result]}).`;
}

/** Lets the user choose whether and as which visa class calendar dates are shared. */
export async function renderReporter(root: HTMLElement) {
  const [settings, last] = await Promise.all([reporterSettings.getValue(), lastReport.getValue()]);
  root.innerHTML = `
    <form id="reporter-form">
      <label class="toggle"><input type="checkbox" name="enabled" ${settings.enabled ? "checked" : ""} />Share dates I see</label>
      <p class="muted small">When you open the official calendar, the open dates it shows are sent so everyone gets alerted. Never your login, name, or page contents.</p>
      <label class="field">I’m scheduling for
        <select name="visaClass">
          <option value="">Choose visa class</option>
          ${VISA_CLASSES.map(
            (v) => `<option value="${v.id}" ${settings.visaClass === v.id ? "selected" : ""}>${v.label}</option>`,
          ).join("")}
        </select>
      </label>
    </form>
    <p class="small" id="reporter-status"></p>`;

  const form = root.querySelector<HTMLFormElement>("#reporter-form")!;
  const status = root.querySelector<HTMLElement>("#reporter-status")!;
  const showStatus = (enabled: boolean, visaClass: string | null, report: LastReport | null) => {
    if (enabled && !visaClass) {
      status.className = "small warn";
      status.textContent = "Choose your visa class to start sharing.";
    } else {
      status.className = "small muted";
      status.textContent = enabled ? lastReportText(report) : "Sharing is off.";
    }
  };
  showStatus(settings.enabled, settings.visaClass, last);

  form.addEventListener("change", async () => {
    const enabled = form.querySelector<HTMLInputElement>('input[name="enabled"]')!.checked;
    const value = form.querySelector<HTMLSelectElement>('select[name="visaClass"]')!.value;
    const visaClass = isVisaClassId(value) ? value : null;
    await reporterSettings.setValue({ enabled, visaClass });
    showStatus(enabled, visaClass, await lastReport.getValue());
  });

  lastReport.watch(async (report) => {
    const current = await reporterSettings.getValue();
    showStatus(current.enabled, current.visaClass, report);
  });
}
