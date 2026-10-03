/**
 * A point-in-time count of the school, taken when a grading period's grades
 * are final. Rates are always derived from these counts, never stored, so a
 * figure on screen can be traced back to what was counted.
 */
export type StatisticsSnapshot = {
  id: string;
  /** When the counts were taken. */
  capturedAt: string;
  /** e.g. "2026–2027" */
  schoolYear: string;
  /** e.g. "Quarter 1" */
  period: string;
  /** Learners in a Section when the year began. The base for the drop rate. */
  enrolledAtStart: number;
  /** Learners in a Section when the counts were taken. */
  enrolled: number;
  /** Learners with a final quarterly grade in every learning area. */
  assessed: number;
  /** Assessed Learners whose general average is 75 or higher. */
  passing: number;
  /** Assessed Learners whose general average is below 75. */
  failing: number;
  /** Learners recorded as dropped so far this school year. */
  dropped: number;
  sections: SectionStatistics[];
};

export type SectionStatistics = {
  sectionId: string;
  label: string;
  enrolled: number;
  assessed: number;
  passing: number;
  failing: number;
  dropped: number;
};
