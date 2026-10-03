import { cn } from "@/lib/utils";

/** Availability in words; the square marker only reinforces the text. */
export function Availability({
  readyOffline,
  className,
}: {
  readyOffline: boolean;
  className?: string;
}) {
  return (
    <p className={cn("flex items-center gap-2 text-meta", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "size-2",
          readyOffline ? "bg-success" : "border border-muted-foreground",
        )}
      />
      {readyOffline ? "Ready offline" : "Not on this device"}
    </p>
  );
}
