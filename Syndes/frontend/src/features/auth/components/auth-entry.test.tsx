import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AuthEntry } from "./auth-entry";

vi.mock("@/lib/supabase", () => ({ supabase: { auth: { signInWithOAuth: vi.fn() } } }));

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe("Account entry", () => {
  it("offers separate Student and Teacher journeys without promising Teacher permission", () => {
    render(<AuthEntry audience="teacher" />);

    expect(screen.getByRole("heading", { name: /teach with syndes/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /student sign in/i })).toHaveAttribute("href", "/auth/student");
    expect(screen.getByText(/administrator assigns teacher permission/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });
});
