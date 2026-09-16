import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type NavMenuProps = ComponentPropsWithoutRef<typeof NavigationMenu> & {
  isHome?: boolean;
  onLinkClick?: () => void;
};

export const NavMenu = ({
  isHome = false,
  onLinkClick,
  orientation,
  ...props
}: NavMenuProps) => {
  const isVertical = orientation === "vertical";
  const itemClassName = isVertical
    ? "w-full border-b border-slate-100 last:border-b-0"
    : "transition-transform duration-200 ease-out hover:scale-105";
  // Vertical is the mobile sheet. There, each link becomes a full-width row with
  // real vertical padding — a ~44px target you can hit with a thumb instead of
  // a bare line of 14px text. The horizontal desktop menu is unchanged.
  const linkClassName = isVertical
    ? "block w-full py-3.5 text-base font-medium"
    : "text-sm font-medium";

  return (
    <NavigationMenu orientation={orientation} {...props}>
      <NavigationMenuList className="gap-6 space-x-0 data-[orientation=vertical]:w-full data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[orientation=vertical]:gap-0">
        {isHome && (
          <>
            <NavigationMenuItem className={itemClassName}>
              <NavigationMenuLink asChild>
                <Link
                  className={linkClassName}
                  href="#features"
                  onClick={onLinkClick}
                >
                  Features
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className={itemClassName}>
              <NavigationMenuLink asChild>
                <Link
                  className={linkClassName}
                  href="#pricing"
                  onClick={onLinkClick}
                >
                  Pricing
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className={itemClassName}>
              <NavigationMenuLink asChild>
                <Link
                  className={linkClassName}
                  href="#faq"
                  onClick={onLinkClick}
                >
                  FAQ
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className={itemClassName}>
              <NavigationMenuLink asChild>
                <Link
                  className={linkClassName}
                  href="/scan"
                  onClick={onLinkClick}
                >
                  Scan
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            {/* <NavigationMenuItem className={itemClassName}>
              <NavigationMenuLink asChild>
                <Link
                  className={linkClassName}
                  href="#testimonials"
                  onClick={onLinkClick}
                >
                  Testimonials
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem> */}
          </>
        )}
      </NavigationMenuList>
    </NavigationMenu>
  );
};
