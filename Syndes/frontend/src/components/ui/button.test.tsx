import { describe, expect, it } from "vitest";
import { buttonVariants } from "./button";

describe("button classes on links", () => {
  it("lets the outline border colour replace the transparent base border", () => {
    const classes = buttonVariants({ variant: "outline" }).split(" ");

    expect(classes).toContain("border-primary");
    expect(classes).not.toContain("border-transparent");
  });

  it("keeps the primary text colour alongside the body text size", () => {
    const classes = buttonVariants().split(" ");

    expect(classes).toContain("text-primary-foreground");
    expect(classes).toContain("text-body");
  });
});
