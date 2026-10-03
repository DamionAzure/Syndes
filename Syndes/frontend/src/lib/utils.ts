import { createCn } from "cn/config";

/**
 * Class merging that knows the folio type scale. Without this, a size class
 * such as `text-body` is mistaken for a color and silently drops `text-primary`.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["meta", "body", "section", "page", "title"] }],
    },
  },
});