import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { accountScopedKey } from "@/lib/account-scope";
import { setActiveAccountId } from "@/lib/active-account";
import { PROGRESS_KEY, recordStep } from "./progress-store";
import { updateProgress, useProgressStore } from "./use-progress";

describe("progress saved on this device", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActiveAccountId("alice");
  });
  afterEach(() => setActiveAccountId(null));

  it("treats unreadable saved data as no progress", () => {
    window.localStorage.setItem(accountScopedKey(PROGRESS_KEY, "alice"), "{not json");

    const { result } = renderHook(() => useProgressStore());

    expect(result.current.modules).toEqual({});
  });

  it("shares a saved change with every reader and survives a reload", () => {
    const { result } = renderHook(() => useProgressStore());
    const moduleRef = { id: "reading-maps", version: "1" };

    act(() => {
      updateProgress((store) =>
        recordStep(store, moduleRef, { kind: "lesson", lesson: 2 }, "2026-10-02T10:00:00.000Z"),
      );
    });

    expect(result.current.modules["reading-maps"]?.step).toEqual({ kind: "lesson", lesson: 2 });
    expect(JSON.parse(window.localStorage.getItem(accountScopedKey(PROGRESS_KEY, "alice")) ?? "null").modules).toHaveProperty(
      "reading-maps",
    );
  });

  it("hides one Account's Progress when another Account signs in and restores it later", () => {
    const { result } = renderHook(() => useProgressStore());
    act(() => updateProgress((store) => recordStep(store, { id: "reading-maps", version: "1" }, { kind: "lesson", lesson: 2 }, "2026-10-02T10:00:00.000Z")));
    act(() => setActiveAccountId("bob"));
    expect(result.current.modules).toEqual({});
    act(() => setActiveAccountId("alice"));
    expect(result.current.modules["reading-maps"]?.step).toEqual({ kind: "lesson", lesson: 2 });
  });
});
