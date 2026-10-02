import { describe, expect, it } from "vitest";
import {
  datesToReport,
  extractDates,
  isCalendarRequest,
  kindFromRequest,
  postFromLabel,
  postIdFromRequestBody,
} from "./scheduler";

const OFC_ROUTE =
  "https://www.usvisascheduling.com/en-US/custom-actions/?route=/api/v1/schedule-group/get-family-ofc-schedule-days&cacheString=1";

describe("calendar requests", () => {
  it("recognizes the days routes only", () => {
    expect(isCalendarRequest(OFC_ROUTE)).toBe(true);
    expect(isCalendarRequest(OFC_ROUTE.replace("schedule-days", "schedule-entries"))).toBe(false);
  });

  it("reads the kind from the route, then the page path", () => {
    expect(kindFromRequest(OFC_ROUTE, "/en-US/schedule/")).toBe("ofc");
    expect(kindFromRequest("/x?route=get-family-consular-schedule-days", "/")).toBe("consular");
    expect(kindFromRequest("/x/schedule-days", "/en-US/ofc-schedule/")).toBe("ofc");
    expect(kindFromRequest("/x/schedule-days", "/en-US/schedule/")).toBe("consular");
    expect(kindFromRequest("/x/schedule-days", "/en-US/home")).toBeNull();
  });

  it("finds the postId in form-encoded and JSON bodies", () => {
    const params = JSON.stringify({ primaryId: "a", postId: "post-123" });
    expect(postIdFromRequestBody(`parameters=${encodeURIComponent(params)}`)).toBe("post-123");
    expect(postIdFromRequestBody(params)).toBe("post-123");
    expect(postIdFromRequestBody("parameters=%E0%A4%A")).toBeNull();
    expect(postIdFromRequestBody("")).toBeNull();
  });
});

describe("postFromLabel", () => {
  it("maps site labels to posts", () => {
    expect(postFromLabel("MUMBAI VAC")).toBe("mumbai");
    expect(postFromLabel("NEW DELHI VAC")).toBe("new-delhi");
    expect(postFromLabel("Hyderabad")).toBe("hyderabad");
    expect(postFromLabel("  chennai  ")).toBe("chennai");
    expect(postFromLabel("Kolkata Consulate")).toBe("kolkata");
    expect(postFromLabel("Select a location")).toBeNull();
    expect(postFromLabel(null)).toBeNull();
  });
});

describe("extractDates", () => {
  it("collects Date fields and drops the time", () => {
    const response = {
      ScheduleDays: [
        { ID: "1", Date: "2027-03-09T00:00:00" },
        { ID: "2", Date: "2027-03-02T00:00:00" },
        { ID: "3", Date: "2027-03-02T00:00:00" },
        { ID: "4", Date: "not a date" },
      ],
    };
    expect(extractDates(response)).toEqual(["2027-03-02", "2027-03-09"]);
  });

  it("returns nothing for empty or unrelated responses", () => {
    expect(extractDates({ ScheduleDays: [] })).toEqual([]);
    expect(extractDates(null)).toEqual([]);
    expect(extractDates({ Updated: "2027-03-02" })).toEqual([]);
  });
});

describe("datesToReport", () => {
  const now = new Date("2026-10-02T12:00:00Z");

  it("keeps the ten earliest dates inside the accepted window", () => {
    const dates = ["2026-09-30", "2026-10-01", "2028-12-01", "2026-11-05", "2026-11-05"];
    expect(datesToReport(dates, now)).toEqual(["2026-10-01", "2026-11-05"]);

    const many = Array.from({ length: 15 }, (_, i) => `2027-01-${String(i + 10).padStart(2, "0")}`);
    expect(datesToReport([...many].reverse(), now)).toEqual(many.slice(0, 10));
  });
});
