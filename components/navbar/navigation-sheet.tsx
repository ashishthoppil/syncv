"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Logo } from "./logo";
import { NavMenu } from "./nav-menu";
import Link from "next/link";
import { useState } from "react";

type NavigationSheetProps = {
  isHome?: boolean;
};

export const NavigationSheet = ({ isHome = false }: NavigationSheetProps) => {
  const [open, setOpen] = useState(false);
  const closeSheet = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <Logo />
        <NavMenu
          isHome={isHome}
          orientation="vertical"
          className="mt-12"
          onLinkClick={closeSheet}
        />

        <div className="mt-8 space-y-4">
          <Button variant="outline" className="w-full sm:hidden" asChild>
            <Link href="/login" onClick={closeSheet}>
              Login
            </Link>
          </Button>
          <Button className="w-full sm:hidden" asChild>
            <Link href="/sign-up" onClick={closeSheet}>
              Register
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
