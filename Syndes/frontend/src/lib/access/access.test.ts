import { describe, expect, it } from "vitest";
import { NAV_GROUPS, visibleGroups } from "@/components/layout/nav-routes";
import { canAdminister, canLearn, canTeach, isAdminPath, isTeachPath, parseAuthContext, STUDENT_FLOOR } from "./access";

describe("parseAuthContext", () => {
  it("uses the core's verified Account identity and active flag for access", () => {
    const active = parseAuthContext({ accountId: "account-1", active: true, role: "teacher", approved: false, readOnly: false, source: "onlineGate" });
    expect(active.accountId).toBe("account-1");
    expect(canTeach(active)).toBe(true);
    expect(canLearn(active)).toBe(false);
    expect(canTeach({ ...active, active: false })).toBe(false);
  });
  it("reads the core's AuthContext", () => {
    expect(
      parseAuthContext({ accountId: "teacher-1", active: true, role: "teacher", approved: true, readOnly: false, source: "offlineVerified" }),
    ).toEqual({
      accountId: "teacher-1",
      active: true,
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
  const account = { accountId: "account-1", active: true } as const;
  it("allows a verified Teacher or Admin", () => {
    expect(canTeach({ ...account, role: "teacher", approved: true, readOnly: false, source: "offlineVerified" })).toBe(false);
    expect(canTeach({ ...account, role: "admin", approved: false, readOnly: false, source: "onlineGate" })).toBe(true);
  });

  it("refuses Students, the floor, and a read-only Teacher", () => {
    expect(canTeach({ ...account, role: "student", approved: true, readOnly: false, source: "offlineVerified" })).toBe(false);
    expect(canTeach(STUDENT_FLOOR)).toBe(false);
    expect(canTeach({ ...account, role: "teacher", approved: true, readOnly: true, source: "onlineGate" })).toBe(false);
  });
});

describe("canLearn", () => {
  const account = { accountId: "account-1", active: true } as const;
  it("allows an approved Account that is not read-only", () => {
    expect(canLearn({ ...account, role: "student", approved: true, readOnly: false, source: "offlineVerified" })).toBe(true);
    expect(canLearn({ ...account, role: "teacher", approved: true, readOnly: false, source: "offlineVerified" })).toBe(true);
  });

  it("refuses an unapproved Account and the floor", () => {
    expect(canLearn({ ...account, role: "student", approved: false, readOnly: false, source: "offlineVerified" })).toBe(false);
    expect(canLearn(STUDENT_FLOOR)).toBe(false);
  });
});

describe("canAdminister", () => {
  const account = { accountId: "account-1", active: true } as const;
  it("requires an Administrator with current online authority", () => {
    expect(canAdminister({ ...account, role: "admin", approved: false, readOnly: false, source: "onlineGate" })).toBe(true);
    expect(canAdminister({ ...account, role: "admin", approved: true, readOnly: false, source: "offlineVerified" })).toBe(false);
    expect(canAdminister({ ...account, role: "teacher", approved: true, readOnly: false, source: "onlineGate" })).toBe(false);
    expect(canAdminister(STUDENT_FLOOR)).toBe(false);
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
