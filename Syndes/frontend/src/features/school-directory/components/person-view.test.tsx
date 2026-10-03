import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleDirectory } from "../use-directory";
import { PersonView } from "./person-view";

let accountId = "account-52";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ account: accountId }),
}));

describe("PersonView", () => {
  beforeEach(() => {
    resetSampleDirectory();
  });

  it("gives a waiting account Teacher access after confirmation", async () => {
    accountId = "account-52";
    const user = userEvent.setup();
    render(<PersonView />);

    expect(screen.getByRole("heading", { level: 1, name: "Jessa Dizon" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Give Teacher access" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Give Teacher access" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Gave Jessa Dizon Teacher access.");
    expect(screen.getByRole("heading", { name: "Classes" })).toBeInTheDocument();
  });

  it("keeps removing an enrolled Learner's account blocked until they leave their section", () => {
    accountId = "learner-01";
    render(<PersonView />);
    expect(screen.getByRole("button", { name: "Remove all access" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove from section" })).toBeEnabled();
  });

  it("does not offer access changes for an Administrator", () => {
    accountId = "admin-01";
    render(<PersonView />);
    expect(screen.queryByRole("button", { name: "Remove all access" })).not.toBeInTheDocument();
    expect(screen.getByText(/changed by the school's system owner/)).toBeInTheDocument();
  });
});
