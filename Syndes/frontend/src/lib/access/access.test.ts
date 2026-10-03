import { describe, expect, it } from "vitest";
import { NAV_GROUPS, visibleGroups } from "@/components/layout/nav-routes";
import { canLearn, canTeach, isTeachPath, parseAuthContext, STUDENT_FLOOR } from "./access";

describe("parseAuthContext", () => {
  it("reads the core's AuthContext", () => {
    expect(
      parseAuthContext({ role: "teacher", approved: true, readOnly: false, source: "offlineVerified" }),
    ).toEqual({
      role: "teacher",
      approved: true,
      readOnly: false,
      source: "offlineVerified",
    });
  });

  it("fails approval closed when the flag is absent or non-boolean", () => {
    expect(parseAuthContext({ role: "teacher", readOnly: false, source: "offlineVerified" }).approved).toBe(
      false,
    );
    expect(
      parseAuthContext({ role: "teacher", approved: "yes", readOnly: false, source: "offlineVerified" })
        .approved,
    ).toBe(false);
  });

  it.each([
    null,
    "teacher",
    { role: "Teacher", approved: true, readOnly: false, source: "offlineVerified" },
    { role: "teacher", approved: true, readOnly: "false", source: "offlineVerified" },
    { role: "teacher", approved: true, readOnly: false, source: "trustMe" },
    { role: "superuser", approved: true, readOnly: false, source: "offlineVerified" },
  ])("falls back to the Student floor for %j", (raw: unknown) => {
    expect(parseAuthContext(raw)).toEqual(STUDENT_FLOOR);
  });
});

describe("canTeach", () => {
  it("allows a verified Teacher or Admin", () => {
    expect(canTeach({ role: "teacher", approved: true, readOnly: false, source: "offlineVerified" })).toBe(true);
    expect(canTeach({ role: "admin", approved: true, readOnly: false, source: "onlineGate" })).toBe(true);
  });

  it("refuses Students, the floor, and a read-only Teacher", () => {
    expect(canTeach({ role: "student", approved: true, readOnly: false, source: "offlineVerified" })).toBe(false);
    expect(canTeach(STUDENT_FLOOR)).toBe(false);
    expect(canTeach({ role: "teacher", approved: true, readOnly: true, source: "onlineGate" })).toBe(false);
  });
});

describe("canLearn", () => {
  it("allows an approved Account that is not read-only", () => {
    expect(canLearn({ role: "student", approved: true, readOnly: false, source: "offlineVerified" })).toBe(true);
    expect(canLearn({ role: "teacher", approved: true, readOnly: false, source: "offlineVerified" })).toBe(true);
  });

  it("refuses an unapproved Account and the floor", () => {
    expect(canLearn({ role: "student", approved: false, readOnly: false, source: "offlineVerified" })).toBe(false);
    expect(canLearn(STUDENT_FLOOR)).toBe(false);
  });
});

describe("isTeachPath", () => {
  it("matches the Teach section and nothing that only starts the same way", () => {
    expect(isTeachPath("/teach")).toBe(true);
    expect(isTeachPath("/teach/")).toBe(true);
    expect(isTeachPath("/teach/grades")).toBe(true);
    expect(isTeachPath("/teacher")).toBe(false);
    expect(isTeachPath("/modules")).toBe(false);
  });
});

describe("navigation", () => {
  it("lists the Teach group only for teachers", () => {
    expect(visibleGroups(NAV_GROUPS, false).map((group) => group.label)).toEqual(["Learn", "On this device"]);
    expect(visibleGroups(NAV_GROUPS, true).map((group) => group.label)).toEqual(["Learn", "Teach", "On this device"]);
  });
});
