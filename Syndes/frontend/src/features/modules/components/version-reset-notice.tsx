import { Alert, AlertDescription } from "@/components/ui/alert";

export function VersionResetNotice() {
  return (
    <Alert className="mb-6">
      <AlertDescription className="text-foreground">
        This module was updated, so your saved place was reset.
      </AlertDescription>
    </Alert>
  );
}
