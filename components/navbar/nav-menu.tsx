import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import type React from "react";

type NavMenuProps = React.ComponentPropsWithoutRef<typeof NavigationMenu> & {
  isHome?: boolean;
  onLinkClick?: () => void;
};

export const NavMenu = ({
  isHome = false,
  onLinkClick,
  ...props
}: NavMenuProps) => {
  const itemClassName = "transition-transform duration-200 ease-out hover:scale-105";

  return (
    <NavigationMenu {...props}>
      <NavigationMenuList className="gap-6 space-x-0 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-start">
        {isHome && (
          <>
            <NavigationMenuItem className={itemClassName}>
              <NavigationMenuLink asChild>
                <Link className="text-sm font-medium " href="#features" onClick={onLinkClick}>Features</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className={itemClassName}>
              <NavigationMenuLink asChild>
                <Link className="text-sm font-medium" href="#pricing" onClick={onLinkClick}>Pricing</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className={itemClassName}>
              <NavigationMenuLink asChild>
                <Link className="text-sm font-medium " href="#faq" onClick={onLinkClick}>FAQ</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className={itemClassName}>
              <NavigationMenuLink asChild>
                <Link className="text-sm font-medium " href="/scan" onClick={onLinkClick}>Scan</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className={itemClassName}>
              <NavigationMenuLink asChild>
                <Link className="text-sm font-medium " href="#testimonials" onClick={onLinkClick}>Testimonials</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </>
        )}
      </NavigationMenuList>
    </NavigationMenu>
  );
};
