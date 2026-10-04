"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SiteNav } from "./site-nav";

/** Below 1024px the routes live in a Sheet; focus returns to Menu on close. */
export function MobileNavSheet() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>Menu</SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="gap-6 bg-surface-muted p-4 pt-[calc(1rem+var(--safe-top))]"
      >
        <SheetHeader className="flex-row items-center justify-between p-0">
          <SheetTitle className="text-section font-semibold">Menu</SheetTitle>
          <SheetClose render={<Button variant="outline" size="sm" />}>Close</SheetClose>
        </SheetHeader>
        <SiteNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
