import { describe, expect, it } from "vitest";
import { NAV_GROUPS, visibleGroups } from "@/components/layout/nav-routes";
import { canAdminister, canTeach, isAdminPath, isTeachPath, parseAuthContext, STUDENT_FLOOR } from "./access";

describe("parseAuthContext", () => {
  it("reads the core's AuthContext", () => {
    expect(parseAuthContext({ role: "teacher", readOnly: false, source: "offlineVerified" })).toEqual({
      role: "teacher",
      readOnly: false,
      source: "offlineVerified",
    });
  });

  it.each([
    null,
    "teacher",
    { role: "Teacher", readOnly: false, source: "offlineVerified" },
    { role: "teacher", readOnly: "false", source: "offlineVerified" },
    { role: "teacher", readOnly: false, source: "trustMe" },
    { role: "superuser", readOnly: false, source: "offlineVerified" },
  ])("falls back to the Student floor for %j", (raw) => {
    expect(parseAuthContext(raw)).toEqual(STUDENT_FLOOR);
  });
});

describe("roles are separate", () => {
  const teacher = { role: "teacher", readOnly: false, source: "offlineVerified" } as const;
  const admin = { role: "admin", readOnly: false, source: "onlineGate" } as const;
  const student = { role: "student", readOnly: false, source: "offlineVerified" } as const;

  it("lets only a verified Teacher teach", () => {
    expect(canTeach(teacher)).toBe(true);
    expect(canTeach(admin)).toBe(false);
    expect(canTeach(student)).toBe(false);
    expect(canTeach({ ...teacher, readOnly: true })).toBe(false);
  });

  it("lets only a verified Administrator administer", () => {
    expect(canAdminister(admin)).toBe(true);
    expect(canAdminister(teacher)).toBe(false);
    expect(canAdminister(STUDENT_FLOOR)).toBe(false);
    expect(canAdminister({ ...admin, readOnly: true })).toBe(false);
  });
});

describe("section paths", () => {
  it("match their section and nothing that only starts the same way", () => {
    expect(isTeachPath("/teach")).toBe(true);
    expect(isTeachPath("/teach/grades")).toBe(true);
    expect(isTeachPath("/teacher")).toBe(false);
    expect(isAdminPath("/admin/")).toBe(true);
    expect(isAdminPath("/admin/people")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
  });
});

describe("navigation", () => {
  const labels = (canTeachValue: boolean, canAdministerValue: boolean) =>
    visibleGroups(NAV_GROUPS, { canTeach: canTeachValue, canAdminister: canAdministerValue }).map(
      (group) => group.label,
    );

  it("shows each role only its own groups", () => {
    expect(labels(false, false)).toEqual(["Learn", "On this device"]);
    expect(labels(true, false)).toEqual(["Learn", "Teach", "On this device"]);
    expect(labels(false, true)).toEqual(["Learn", "Administration", "On this device"]);
  });
});
