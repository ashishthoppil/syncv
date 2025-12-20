'use client';

import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { NavMenu } from "./nav-menu";
import { NavigationSheet } from "./navigation-sheet";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuth } from "@/lib/utils";
import { LogInIcon, LogOutIcon, User2Icon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "react-toastify";

const Navbar = ({ isHome = false }) => {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const result = await isAuth()
      setAuthenticated(result)
    }
    checkAuth()
  }, [])

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Something went wrong while logging out.');
      return;
    }
    setAuthenticated(false);
    toast.info('Logging out…');
    setTimeout(() => {
      router.push('/');
    }, 2000)
  }
  
  return (
    <nav className={`fixed z-10 top-6 inset-x-4 h-14 xs:h-16 backdrop-blur-sm max-w-screen-xl mx-auto rounded-full ${isHome ? 'bg-background/50 border border-slate-200 shadow-sm' : ''}`}>
      <div className="h-full flex items-center justify-between mx-auto px-4">
        <Logo />

        {/* Desktop Menu */}
        <NavMenu isHome={isHome} className="hidden md:block" />

        <div className="flex items-center gap-3">
          {!authenticated && (
            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/login')}
                className="gap-1"
              >
                <LogInIcon className="h-4 w-4" /> Login
              </Button>
              <Button
                size="sm"
                onClick={() => router.push('/sign-up')}
                className="gap-1"
              >
                <User2Icon className="h-4 w-4" /> Register
              </Button>
            </div>
          )}
          {authenticated ? 
          <>
            <Button variant='link' onClick={() => router.push('/scan')} className="hidden sm:inline-flex">
              Dashboard
            </Button>
            <Button className="hidden md:flex" onClick={() => signOut()}><LogOutIcon /> Logout</Button>
          </> : <></>}
          {/* Mobile Menu */}
          <div className="md:hidden">
            <NavigationSheet />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
