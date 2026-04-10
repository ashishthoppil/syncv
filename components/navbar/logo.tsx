'use client';

import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export const Logo = () => {
  const { resolvedTheme } = useTheme();

  const [logoSrc, setLogoSrc] = useState("/logo.png");

  useEffect(() => {
    setLogoSrc(resolvedTheme === 'dark' ? "/logo-white.png" : "/logo.png");
  }, [resolvedTheme]);

  return (
    <Link href="/" aria-label="Go to homepage">
      <Image alt="SynCV" src={logoSrc} height={100} width={100} />
    </Link>
  );
}
