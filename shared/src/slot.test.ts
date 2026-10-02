import { describe, expect, it } from "vitest";
import { isIsoDate, parseSlot, slotKey } from "./slot";

describe("slotKey", () => {
  it("is identical for reports of the same opening from different users", () => {
    const fromUserA = parseSlot({
      post: "hyderabad",
      visaClass: "h1b",
      kind: "consular",
      date: "2027-01-05",
    });
    const fromUserB = parseSlot({
      post: "hyderabad",
      visaClass: "h1b",
      kind: "consular",
      date: "2027-01-05",
    });
    expect(fromUserA).not.toBeNull();
    expect(slotKey(fromUserA!)).toBe(slotKey(fromUserB!));
  });

  it("differs when any part of the slot differs", () => {
    const base = { post: "mumbai", visaClass: "b1b2", kind: "ofc", date: "2027-02-10" };
    const key = slotKey(parseSlot(base)!);
    expect(slotKey(parseSlot({ ...base, kind: "consular" })!)).not.toBe(key);
    expect(slotKey(parseSlot({ ...base, date: "2027-02-11" })!)).not.toBe(key);
  });
});

describe("parseSlot", () => {
  it("rejects unknown posts, visa classes, and kinds", () => {
    const ok = { post: "chennai", visaClass: "f1f2", kind: "ofc", date: "2027-03-01" };
    expect(parseSlot({ ...ok, post: "london" })).toBeNull();
    expect(parseSlot({ ...ok, visaClass: "o1" })).toBeNull();
    expect(parseSlot({ ...ok, kind: "biometrics" })).toBeNull();
  });
});

describe("isIsoDate", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2027-02-28")).toBe(true);
    expect(isIsoDate("2027-02-30")).toBe(false);
    expect(isIsoDate("05/01/2027")).toBe(false);
  });
});
