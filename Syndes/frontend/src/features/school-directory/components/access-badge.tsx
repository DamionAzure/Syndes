import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ACCESS_LABEL } from "../directory";
import type { AccessState } from "../directory-types";

const VARIANT: Record<AccessState, "default" | "secondary" | "outline" | "destructive"> = {
  learner: "secondary",
  teacher: "default",
  admin: "default",
  waiting: "outline",
  unenrolled: "outline",
  removed: "destructive",
};

/** Access in words first; the fill only reinforces it. */
export function AccessBadge({ state, className }: { state: AccessState; className?: string }) {
  return (
    <Badge variant={VARIANT[state]} className={cn(state === "waiting" && "border-primary text-primary", className)}>
      {ACCESS_LABEL[state]}
    </Badge>
  );
}
