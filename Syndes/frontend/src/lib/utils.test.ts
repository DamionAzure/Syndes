import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("merging folio classes", () => {
  it("keeps a folio text size alongside a text colour", () => {
    expect(cn("text-primary-foreground", "text-body")).toBe("text-primary-foreground text-body");
  });

  it("still lets a later text size replace an earlier one", () => {
    expect(cn("text-meta", "text-body")).toBe("text-body");
  });
});
