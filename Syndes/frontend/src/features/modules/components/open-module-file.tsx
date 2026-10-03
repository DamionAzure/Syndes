"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  async function openFile(file: File) {
    setOpening(true);
    setNotice(null);
    const result = await source.openModuleFile(file);
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
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label="Choose a Module file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void openFile(file);
            event.target.value = "";
          }}
        />
        <Button variant={variant} onClick={() => inputRef.current?.click()} disabled={opening}>
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
