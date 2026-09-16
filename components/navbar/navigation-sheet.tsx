"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LogOutIcon, Menu } from "lucide-react";
import { Logo } from "./logo";
import { NavMenu } from "./nav-menu";
import Link from "next/link";
import { useState } from "react";

type NavigationSheetProps = {
  isHome?: boolean;
  authenticated?: boolean;
  scansRemainingLabel?: string;
  onSignOut?: () => void;
};

export const NavigationSheet = ({
  isHome = false,
  authenticated = false,
  scansRemainingLabel = "",
  onSignOut,
}: NavigationSheetProps) => {
  const [open, setOpen] = useState(false);
  const closeSheet = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <Logo />
        <NavMenu
          isHome={isHome}
          orientation="vertical"
          className="mt-8"
          onLinkClick={closeSheet}
        />

        {/* mt-auto pins the account actions to the bottom of the sheet, where a
            thumb naturally rests, instead of leaving them floating mid-panel.
            Signed-in visitors previously got only Login/Register here — the
            Dashboard and Logout buttons in the bar are hidden below `md`, so on
            a phone there was no way out of a marketing page at all. */}
        <div className="mt-auto space-y-3 pt-8">
          {authenticated ? (
            <>
              {scansRemainingLabel ? (
                <p className="pb-1 text-center text-xs font-semibold text-slate-600">
                  {scansRemainingLabel}
                </p>
              ) : null}
              <Button size="lg" className="w-full" asChild>
                <Link href="/scan" onClick={closeSheet}>
                  Dashboard
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => {
                  closeSheet();
                  onSignOut?.();
                }}
              >
                <LogOutIcon className="h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="lg" className="w-full" asChild>
                <Link href="/login" onClick={closeSheet}>
                  Login
                </Link>
              </Button>
              <Button size="lg" className="w-full" asChild>
                <Link href="/sign-up" onClick={closeSheet}>
                  Register
                </Link>
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
