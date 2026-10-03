import type { Module, ModuleSummary } from "./module-types";

/**
 * Made-up demo content for building the learner screens before the real
 * importer exists. It covers the cases the screens must handle: a Module with
 * a Flashcard deck, one without a Quiz, and one that is not on this device.
 */
export const FIXTURE_MODULES: Module[] = [
  {
    id: "problem-solving",
    version: "1",
    subject: "Thinking skills",
    title: "Problem solving",
    summary:
      "Work through a problem in clear steps: understand it, represent it, choose a method, and check the result.",
    lessonCount: 6,
    questionCount: 5,
    hasFlashcards: true,
    readyOffline: true,
    outcomes: [
      "Describe a problem in your own words",
      "Represent what is known and what is asked",
      "Choose and test a method before committing to it",
    ],
    lessons: [
      {
        id: "ps-1",
        title: "What is a problem?",
        subtitle: "A problem is a gap between where you are and where you want to be.",
        minutes: 6,
        sections: [
          {
            heading: "Notice the gap",
            paragraphs: [
              "Every problem has a starting point and a goal. Naming both is the first step, because it tells you what a solution must change.",
              "If you cannot say what the goal is, the problem is not ready to solve yet. Ask questions until it is.",
            ],
          },
        ],
        remember: ["A problem you can describe is a problem you can start."],
      },
      {
        id: "ps-2",
        title: "Representing a problem",
        subtitle: "A useful representation makes the next decision easier.",
        minutes: 8,
        sections: [
          {
            heading: "Start with what is known",
            paragraphs: [
              "Write down the goal, the information you have, and the constraints you must respect. A clear model helps you decide which steps matter before you solve anything.",
            ],
            tryThis: [
              "Describe the problem in one sentence.",
              "Then list two facts you already know.",
            ],
          },
          {
            heading: "Pick a form that fits",
            paragraphs: [
              "Some problems are easier as a sketch, others as a table or a short list. Choose the form that shows the relationships you care about.",
            ],
          },
        ],
        remember: [
          "A model is a way to make a problem easier to reason about, not the answer itself.",
        ],
      },
      {
        id: "ps-3",
        title: "Choosing a method",
        minutes: 7,
        sections: [
          {
            heading: "Compare a few options",
            paragraphs: [
              "Before you commit, list two or three ways you could approach the problem. Think about what each one needs and how long it might take.",
            ],
          },
        ],
      },
      {
        id: "ps-4",
        title: "Testing a plan",
        minutes: 7,
        sections: [
          {
            heading: "Try it on a small case",
            paragraphs: [
              "Run your plan on a smaller or simpler version of the problem first. If it fails there, it will fail on the real one too.",
            ],
            tryThis: ["Pick the smallest example you can think of and work it through."],
          },
        ],
      },
      {
        id: "ps-5",
        title: "Revising steps",
        minutes: 5,
        sections: [
          {
            heading: "Change one thing at a time",
            paragraphs: [
              "When a step does not work, change only that step and try again. Changing many things at once hides which change helped.",
            ],
          },
        ],
      },
      {
        id: "ps-6",
        title: "Putting it together",
        minutes: 6,
        sections: [
          {
            heading: "Check the result against the goal",
            paragraphs: [
              "A solution is finished when it closes the gap you named at the start. Look back at your goal and confirm that it is met.",
            ],
          },
        ],
        remember: ["Finish by checking, not by stopping."],
      },
    ],
    quiz: {
      questions: [
        {
          id: "ps-q1",
          kind: "choice",
          prompt: "What should you do first when you meet a new problem?",
          options: [
            { id: "a", label: "Define the goal and list what is known" },
            { id: "b", label: "Start with the hardest step" },
            { id: "c", label: "Guess an answer and move on" },
          ],
        },
        {
          id: "ps-q2",
          kind: "choice",
          prompt: "What is a representation of a problem for?",
          options: [
            { id: "a", label: "It is the final answer" },
            { id: "b", label: "It makes the problem easier to reason about" },
            { id: "c", label: "It replaces the need for a method" },
          ],
        },
        {
          id: "ps-q3",
          kind: "choice",
          prompt: "Why test a plan on a small case first?",
          options: [
            { id: "a", label: "Small cases are always correct" },
            { id: "b", label: "It finds a failing plan cheaply" },
            { id: "c", label: "It skips the need to check the result" },
          ],
        },
        {
          id: "ps-q4",
          kind: "choice",
          prompt: "Changing many steps at once makes it easy to see which change helped.",
          options: [
            { id: "true", label: "True" },
            { id: "false", label: "False" },
          ],
        },
        {
          id: "ps-q5",
          kind: "text",
          prompt: "In one word: what do you compare the result against at the end?",
        },
      ],
    },
    flashcards: [
      { id: "ps-f1", front: "Problem", back: "A gap between where you are and where you want to be." },
      { id: "ps-f2", front: "Representation", back: "A sketch, table, or list that makes a problem easier to reason about." },
      { id: "ps-f3", front: "Constraint", back: "A rule the solution must respect." },
      { id: "ps-f4", front: "Small case", back: "A simpler version of the problem used to test a plan." },
      { id: "ps-f5", front: "Revising", back: "Changing one step at a time and trying again." },
      { id: "ps-f6", front: "Finished", back: "When the result closes the gap you named at the start." },
    ],
  },
  {
    id: "photosynthesis",
    version: "2",
    subject: "Science",
    title: "How plants make food",
    summary:
      "Follow how a leaf turns light, water, and air into sugar, and why that matters for almost every living thing.",
    lessonCount: 3,
    questionCount: 3,
    hasFlashcards: false,
    readyOffline: true,
    outcomes: [
      "Name what a plant takes in to make food",
      "Explain the role of chlorophyll",
    ],
    lessons: [
      {
        id: "ph-1",
        title: "What a leaf takes in",
        minutes: 6,
        sections: [
          {
            heading: "Light, water, and air",
            paragraphs: [
              "A plant takes in water through its roots and a gas from the air through small openings in its leaves. Light gives it the energy to combine them.",
            ],
          },
        ],
      },
      {
        id: "ph-2",
        title: "The green in the leaf",
        minutes: 6,
        sections: [
          {
            heading: "Capturing light",
            paragraphs: [
              "Leaves are green because of a pigment that absorbs light. That captured energy drives the process of making sugar.",
            ],
          },
        ],
        remember: ["The green pigment is what captures light."],
      },
      {
        id: "ph-3",
        title: "Why it matters",
        minutes: 5,
        sections: [
          {
            heading: "Food and oxygen",
            paragraphs: [
              "The sugar feeds the plant, and the oxygen it releases is what animals breathe. Most food chains start here.",
            ],
          },
        ],
      },
    ],
    quiz: {
      questions: [
        {
          id: "ph-q1",
          kind: "text",
          prompt: "Which gas does a plant take in from the air to make food?",
        },
        {
          id: "ph-q2",
          kind: "choice",
          prompt: "What makes leaves green and captures light?",
          options: [
            { id: "a", label: "Chlorophyll" },
            { id: "b", label: "Glucose" },
            { id: "c", label: "Oxygen" },
          ],
        },
        {
          id: "ph-q3",
          kind: "choice",
          prompt: "Plants release oxygen while making food.",
          options: [
            { id: "true", label: "True" },
            { id: "false", label: "False" },
          ],
        },
      ],
    },
  },
  {
    id: "reading-maps",
    version: "1",
    subject: "Geography",
    title: "Reading maps",
    summary: "Use a map's key, scale, and compass to find your way.",
    lessonCount: 2,
    questionCount: 0,
    hasFlashcards: false,
    readyOffline: true,
    outcomes: ["Use a map key", "Estimate distance with a scale"],
    lessons: [
      {
        id: "rm-1",
        title: "The key and the compass",
        minutes: 5,
        sections: [
          {
            heading: "Symbols have meanings",
            paragraphs: [
              "A map key lists the symbols used on the map. The compass shows which way is north, so you can turn the map to match the ground.",
            ],
          },
        ],
      },
      {
        id: "rm-2",
        title: "Measuring with a scale",
        minutes: 6,
        sections: [
          {
            heading: "From the page to the ground",
            paragraphs: [
              "The scale tells you how a distance on the map compares with a distance on the ground. Measure on the page, then multiply.",
            ],
            tryThis: ["Measure the distance between two places on any map you have."],
          },
        ],
      },
    ],
  },
];

/** Listed in the Library but not stored on this device. */
export const FIXTURE_REMOTE_SUMMARIES: ModuleSummary[] = [
  {
    id: "fractions",
    version: "1",
    subject: "Mathematics",
    title: "Fractions in practice",
    summary: "Compare, add, and simplify fractions using everyday examples.",
    lessonCount: 4,
    questionCount: 6,
    hasFlashcards: false,
    readyOffline: false,
  },
];
