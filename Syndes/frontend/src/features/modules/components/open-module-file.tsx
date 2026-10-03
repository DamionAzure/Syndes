"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useModuleSource } from "../module-source";
import { routes } from "../routes";

type Notice = { title: string; description: string } | null;

export function OpenModuleFile({ variant = "outline" }: { variant?: "default" | "outline" }) {
  const source = useModuleSource();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice>(null);
  const [opening, setOpening] = useState(false);

  async function openFile() {
    setOpening(true);
    setNotice(null);
    const result = await source.openModuleFile();
    setOpening(false);
    switch (result.status) {
      case "opened":
        router.push(routes.module(result.moduleId));
        return;
      case "cancelled":
        return;
      case "unsupported":
        setNotice({
          title: "Not available yet",
          description: "Opening module files is not available in this build yet.",
        });
        return;
      case "invalid":
        setNotice({ title: "This file could not be opened", description: result.message });
        return;
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <Button variant={variant} onClick={openFile} disabled={opening}>
          {opening ? "Opening module file…" : "Open module file"}
        </Button>
      </div>
      {notice ? (
        <Alert className="max-w-[44rem]">
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.description}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
