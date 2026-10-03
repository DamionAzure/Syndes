import { partKey } from "./draft-store";
import type { DraftPart } from "./draft-types";

/** Teacher authoring routes. Draft ids travel in search params (ADR-0001). */
export const authoringRoutes = {
  drafts: () => "/teach/drafts",
  editor: (draftId: string, part?: DraftPart) => {
    const query = new URLSearchParams({ draft: draftId });
    if (part) query.set("part", partKey(part));
    return `/teach/editor?${query.toString()}`;
  },
};
