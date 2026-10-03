import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PROGRESS_KEY, recordStep } from "./progress-store";
import { updateProgress, useProgressStore } from "./use-progress";

describe("progress saved on this device", () => {
  it("treats unreadable saved data as no progress", () => {
    window.localStorage.setItem(PROGRESS_KEY, "{not json");

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
    expect(JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "null").modules).toHaveProperty(
      "reading-maps",
    );
  });
});
