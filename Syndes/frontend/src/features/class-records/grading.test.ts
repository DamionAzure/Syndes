import { describe, expect, it } from "vitest";
import type { GradeRecord } from "./class-record-types";
import { computeGrade, descriptorFor, moduleStatus, percentageScore, transmute } from "./grading";

describe("transmute", () => {
  it.each([
    [100, 100],
    [98.4, 99],
    [98.39, 98],
    [82.39, 88],
    [80.8, 88],
    [61.6, 76],
    [61.59, 75],
    [60, 75],
    [59.99, 74],
    [56, 74],
    [55.99, 73],
    [3.99, 60],
    [0, 60],
  ])("transmutes an initial grade of %s to %s", (initial, expected) => {
    expect(transmute(initial)).toBe(expected);
  });
});

describe("descriptorFor", () => {
  it("uses the DepEd descriptors at their lower bounds", () => {
    expect(descriptorFor(90)).toBe("Outstanding");
    expect(descriptorFor(89)).toBe("Very satisfactory");
    expect(descriptorFor(80)).toBe("Satisfactory");
    expect(descriptorFor(75)).toBe("Fairly satisfactory");
    expect(descriptorFor(74)).toBe("Did not meet expectations");
  });
});

describe("computeGrade", () => {
  const record: GradeRecord = {
    learnerId: "l1",
    classId: "c1",
    quarter: 1,
    writtenWork: { score: 60, highest: 80 },
    performanceTasks: { score: 90, highest: 120 },
    quarterlyAssessment: { score: 40, highest: 50 },
  };

  it("weights each component for the learning area, then transmutes", () => {
    // Science: 75 × .40 + 75 × .40 + 80 × .20 = 76.00 → 85
    expect(computeGrade(record, "science-math")).toEqual({
      status: "final",
      writtenWork: 75,
      performanceTasks: 75,
      quarterlyAssessment: 80,
      initialGrade: 76,
      quarterlyGrade: 85,
      descriptor: "Very satisfactory",
    });
  });

  it("gives no quarterly grade before the quarterly assessment", () => {
    expect(computeGrade({ ...record, quarterlyAssessment: null }, "languages")).toEqual({
      status: "incomplete",
      writtenWork: 75,
      performanceTasks: 75,
    });
  });

  it("treats a component with no possible points as 0, never NaN", () => {
    expect(percentageScore({ score: 0, highest: 0 })).toBe(0);
  });
});

describe("moduleStatus", () => {
  const base = {
    learnerId: "l1",
    moduleId: "m1",
    moduleTitle: "M",
    lessonCount: 3,
    questionCount: 2,
    reportedAt: "2026-09-01T00:00:00Z",
  };

  it("needs the final Lesson and a submitted Quiz to be Completed", () => {
    expect(moduleStatus({ ...base, lessonsReached: 0, result: null })).toBe("not-started");
    expect(moduleStatus({ ...base, lessonsReached: 3, result: null })).toBe("in-progress");
    expect(
      moduleStatus({ ...base, lessonsReached: 3, result: { correct: 1, total: 2, submittedAt: base.reportedAt } }),
    ).toBe("completed");
    expect(moduleStatus({ ...base, questionCount: 0, lessonsReached: 3, result: null })).toBe("completed");
  });
});
