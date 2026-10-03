import type { Quarter } from "./class-record-types";

/** Teacher class-record routes. Ids travel in search params (ADR-0001). */
export const classRecordRoutes = {
  learners: () => "/teach/learners",
  learner: (learnerId: string) => `/teach/learner?${new URLSearchParams({ learner: learnerId }).toString()}`,
  scores: () => "/teach/scores",
  grades: (classId?: string, quarter?: Quarter) => {
    const query = new URLSearchParams();
    if (classId) query.set("class", classId);
    if (quarter) query.set("quarter", String(quarter));
    const search = query.toString();
    return search ? `/teach/grades?${search}` : "/teach/grades";
  },
};
