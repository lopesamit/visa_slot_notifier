/**
 * A stand-in for the official scheduling pages, served by `serve.ts` at
 * /dev/ofc-schedule and /dev/schedule, so the extension's reporter can be
 * tried without an account. Its dates are far in the future so they never
 * look like real openings; `npm run dev:cleanup -w api` deletes them.
 */
export const MOCK_DATES = {
  ofc: ["2028-08-07", "2028-08-14", "2028-08-21"],
  consular: ["2028-08-08", "2028-08-15"],
};

/** Site-style post ids, like the GUIDs the real location dropdown uses. */
const MOCK_POSTS = [
  { id: "a1b2-chennai", label: "CHENNAI VAC" },
  { id: "a1b2-hyderabad", label: "HYDERABAD VAC" },
  { id: "a1b2-kolkata", label: "KOLKATA VAC" },
  { id: "a1b2-mumbai", label: "MUMBAI VAC" },
  { id: "a1b2-new-delhi", label: "NEW DELHI VAC" },
];

export const mockDaysResponse = (kind: "ofc" | "consular") =>
  JSON.stringify({
    ScheduleDays: MOCK_DATES[kind].map((date, i) => ({ ID: `${kind}-${i}`, Date: `${date}T00:00:00` })),
  });

/** The OFC page loads days with fetch, the consular page with XHR, like real sites mix both. */
export function mockSchedulerPage(kind: "ofc" | "consular"): string {
  const route = `/dev/custom-actions/?route=/api/v1/schedule-group/get-family-${kind}-schedule-days&cacheString=${Date.now()}`;
  const load =
    kind === "ofc"
      ? `fetch(route, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body })
           .then((r) => r.json()).then(show);`
      : `const xhr = new XMLHttpRequest(); xhr.open("POST", route);
         xhr.setRequestHeader("content-type", "application/x-www-form-urlencoded");
         xhr.onload = () => show(JSON.parse(xhr.responseText)); xhr.send(body);`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Mock ${kind.toUpperCase()} schedule</title>
<style>body{font:15px system-ui;margin:40px;max-width:560px}select,button{font:inherit;padding:4px 8px}li{margin:4px 0}</style></head>
<body>
<h1>Mock ${kind === "ofc" ? "OFC" : "consular"} calendar</h1>
<p>Local test page for the Visa Slot Notifier reporter. Not the real site.</p>
<label>Location <select id="post_select"><option value="">Select a location</option>
${MOCK_POSTS.map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}
</select></label>
<p>Other dropdown that also lists a city: <select id="delivery_select"><option>KOLKATA</option></select></p>
<ul id="days"></ul>
<script>
const route = ${JSON.stringify(route)};
const show = (data) => {
  document.getElementById("days").innerHTML = data.ScheduleDays.map((d) => "<li>" + d.Date.slice(0, 10) + "</li>").join("");
};
document.getElementById("post_select").addEventListener("change", (event) => {
  if (!event.target.value) return;
  const body = "parameters=" + encodeURIComponent(JSON.stringify({ primaryId: "mock", postId: event.target.value }));
  ${load}
});
</script>
</body></html>`;
}
