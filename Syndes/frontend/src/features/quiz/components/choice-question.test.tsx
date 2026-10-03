import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Question } from "@/features/modules/module-types";
import { ChoiceQuestion } from "./choice-question";

const question: Extract<Question, { kind: "choice" }> = {
  id: "ph-q2",
  kind: "choice",
  prompt: "What makes leaves green and captures light?",
  options: [
    { id: "a", label: "Chlorophyll" },
    { id: "b", label: "Glucose" },
  ],
};

function Harness({ initial = "" }: { initial?: string }) {
  const [answer, setAnswer] = useState(initial);
  return <ChoiceQuestion question={question} answer={answer} onAnswer={setAnswer} />;
}

describe("answering a choice question", () => {
  it("names the group by its prompt", () => {
    render(<Harness />);

    expect(
      screen.getByRole("radiogroup", { name: "What makes leaves green and captures light?" }),
    ).toBeInTheDocument();
  });

  it("checks an option when its row text is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText("Chlorophyll"));

    expect(screen.getByRole("radio", { name: "Chlorophyll" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Glucose" })).not.toBeChecked();
  });

  it("shows a saved answer as already checked", () => {
    render(<Harness initial="b" />);

    expect(screen.getByRole("radio", { name: "Glucose" })).toBeChecked();
  });
});
