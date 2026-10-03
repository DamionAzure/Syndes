/** ISO weekday: 1 is Monday, 7 is Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SessionKind = "class" | "advisory" | "consultation";

/** One recurring period in the Teacher's weekly schedule. */
export type ScheduleSession = {
  id: string;
  day: Weekday;
  /** 24-hour "HH:MM", local school time. */
  start: string;
  end: string;
  kind: SessionKind;
  /** What is taught or held, e.g. "Science". */
  title: string;
  /** Who attends, e.g. "Grade 6 Sampaguita". */
  group: string;
  room: string;
};
