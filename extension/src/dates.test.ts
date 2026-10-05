import { describe, expect, it } from "vitest";
import { parseDates } from "./dates";

describe("parseDates", () => {
  it.each([
    ["2027-01-12", ["2027-01-12"]],
    ["12/01/2027", ["2027-01-12"]],
    ["12.01.2027", ["2027-01-12"]],
    ["01/31/2027", ["2027-01-31"]],
    ["12 Jan 2027", ["2027-01-12"]],
    ["Tue 12 January, 2027", ["2027-01-12"]],
    ["12th Sept 2027", ["2027-09-12"]],
    ["12-Jan-2027", ["2027-01-12"]],
    ["January 12, 2027", ["2027-01-12"]],
    ["Tuesday, Jan. 12th 2027", ["2027-01-12"]],
  ])("reads %s", (text, dates) => {
    expect(parseDates(text)).toEqual(dates);
  });

  it("reads several dates in order and drops repeats", () => {
    expect(parseDates("Open: 14 Jan 2027, 2027-01-05 and 14/01/2027")).toEqual(["2027-01-14", "2027-01-05"]);
  });

  it.each(["14", "January 2027", "31 Feb 2027", "Mon 15", "13/13/2027", "12 Foo 2027"])(
    "finds no date in %s",
    (text) => {
      expect(parseDates(text)).toEqual([]);
    },
  );
});
