'use client';

import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useState } from "react";

export const Logo = () => {
  const { resolvedTheme } = useTheme();

  const [logoSrc, setLogoSrc] = useState("/logo.png");

  useEffect(() => {
    setLogoSrc(resolvedTheme === 'dark' ? "/logo-white.png" : "/logo.png");
  }, [resolvedTheme]);

  return (
    <Image alt="SynCV" src={logoSrc} height={100} width={100} />
  );
}
