import { describe, expect, it } from "vitest";
import { NAV_GROUPS, visibleGroups } from "@/components/layout/nav-routes";
import { canTeach, isTeachPath, parseAuthContext, STUDENT_FLOOR } from "./access";

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

describe("canTeach", () => {
  it("allows a verified Teacher or Admin", () => {
    expect(canTeach({ role: "teacher", readOnly: false, source: "offlineVerified" })).toBe(true);
    expect(canTeach({ role: "admin", readOnly: false, source: "onlineGate" })).toBe(true);
  });

  it("refuses Students, the floor, and a read-only Teacher", () => {
    expect(canTeach({ role: "student", readOnly: false, source: "offlineVerified" })).toBe(false);
    expect(canTeach(STUDENT_FLOOR)).toBe(false);
    expect(canTeach({ role: "teacher", readOnly: true, source: "onlineGate" })).toBe(false);
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
