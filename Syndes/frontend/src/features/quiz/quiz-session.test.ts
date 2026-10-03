import { describe, expect, it } from "vitest";
import type { Question } from "@/features/modules/module-types";
import { quizNavigation, startingQuestion, unansweredQuestions } from "./quiz-session";

const questions: Question[] = [
  { id: "q1", kind: "choice", prompt: "First", options: [{ id: "a", label: "A" }] },
  { id: "q2", kind: "text", prompt: "Second" },
  { id: "q3", kind: "choice", prompt: "Third", options: [{ id: "a", label: "A" }] },
  { id: "q4", kind: "text", prompt: "Fourth" },
];

describe("unanswered questions before submission", () => {
  it("lists the numbers of questions without an answer, in order", () => {
    expect(unansweredQuestions(questions, { q2: "carbon dioxide", q3: "a" })).toEqual([1, 4]);
  });

  it("treats a text answer of only spaces as unanswered", () => {
    expect(unansweredQuestions(questions, { q1: "a", q2: "   ", q3: "a", q4: "x" })).toEqual([2]);
  });
});

describe("moving between questions", () => {
  it("offers Next but no Previous on the first question", () => {
    expect(quizNavigation(1, 4)).toEqual({ previous: null, next: 2, isLast: false });
  });

  it("offers Previous and Next in the middle", () => {
    expect(quizNavigation(3, 4)).toEqual({ previous: 2, next: 4, isLast: false });
  });

  it("offers Submit instead of Next on the last question", () => {
    expect(quizNavigation(4, 4)).toEqual({ previous: 3, next: null, isLast: true });
  });
});

describe("where a quiz opens", () => {
  it("resumes at the saved question", () => {
    expect(startingQuestion({ kind: "quiz", question: 3 }, 4)).toBe(3);
  });

  it("starts at question 1 when the saved place is elsewhere", () => {
    expect(startingQuestion({ kind: "lesson", lesson: 6 }, 4)).toBe(1);
    expect(startingQuestion(undefined, 4)).toBe(1);
  });

  it("stays inside the quiz when the saved question no longer exists", () => {
    expect(startingQuestion({ kind: "quiz", question: 9 }, 4)).toBe(4);
  });
});
