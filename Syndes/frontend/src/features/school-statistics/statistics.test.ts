import { describe, expect, it } from "vitest";
import { changeLabel, pointChange, rate, ratesOf } from "./statistics";

describe("ratesOf", () => {
  it("takes passing and failing from assessed Learners, and drops from the start-of-year count", () => {
    expect(ratesOf({ assessed: 50, passing: 45, failing: 5, dropped: 1, enrolledAtStart: 51 })).toEqual({
      passingRate: 90,
      failingRate: 10,
      dropRate: 2,
    });
  });

  it("reports no rate instead of dividing by zero", () => {
    expect(rate(0, 0)).toBeNull();
    expect(ratesOf({ assessed: 0, passing: 0, failing: 0, dropped: 0, enrolledAtStart: 0 }).passingRate).toBeNull();
  });
});

describe("changes between snapshots", () => {
  it("says the direction in words", () => {
    expect(changeLabel(pointChange(90, 89.8))).toBe("up 0.2 points");
    expect(changeLabel(pointChange(85, 86))).toBe("down 1.0 point");
    expect(changeLabel(pointChange(85, 85))).toBe("no change");
    expect(changeLabel(pointChange(null, 85))).toBeNull();
  });
});
