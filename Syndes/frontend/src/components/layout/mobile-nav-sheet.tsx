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
import { PRIMARY_ROUTES, SECONDARY_ROUTES } from "./nav-routes";
import { SiteNav } from "./site-nav";

/** Below 768px the routes live in a Sheet; focus returns to Menu on close. */
export function MobileNavSheet() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        Menu
      </SheetTrigger>
      <SheetContent side="right" showCloseButton={false} className="gap-6 p-4">
        <SheetHeader className="flex-row items-center justify-between p-0">
          <SheetTitle className="text-section">Menu</SheetTitle>
          <SheetClose render={<Button variant="outline" size="sm" />}>
            Close
          </SheetClose>
        </SheetHeader>
        <SiteNav
          label="Main"
          routes={PRIMARY_ROUTES}
          orientation="vertical"
          onNavigate={close}
        />
        <SiteNav
          label="Your device"
          routes={SECONDARY_ROUTES}
          orientation="vertical"
          onNavigate={close}
        />
      </SheetContent>
    </Sheet>
  );
}
