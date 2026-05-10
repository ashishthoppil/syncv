'use client';

import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { NavMenu } from "./nav-menu";
import { NavigationSheet } from "./navigation-sheet";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogInIcon, LogOutIcon, User2Icon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "react-toastify";

const Navbar = ({ isHome = false }) => {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false)
  const [scansRemaining, setScansRemaining] = useState<number | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        console.error('Error fetching session:', error.message)
        setAuthenticated(false)
        setScansRemaining(null)
        return
      }

      setAuthenticated(Boolean(session))

      if (!session?.user?.id) {
        setScansRemaining(null)
        return
      }

      try {
        const response = await fetch(`/api/subscription/status?userId=${session.user.id}`)
        const json = await response.json()
        const remaining = Number(json?.data?.scansRemainingThisWeek || 0)
        setScansRemaining(response.ok ? remaining : 0)
      } catch (scanError) {
        console.error('Error fetching scan balance:', scanError)
        setScansRemaining(null)
      }
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
    setScansRemaining(null);
    toast.info('You have been logged out');
    setTimeout(() => {
      router.push('/');
    }, 2000)
  }

  const scansRemainingLabel =
    scansRemaining === null
      ? ""
      : `${scansRemaining} scan${scansRemaining === 1 ? "" : "s"} left`;
  
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
                className="gap-1 border border-2 shadow-sm transition-transform duration-200 ease-out hover:scale-105 font-semibold"
              >
                <LogInIcon className="h-4 w-4" /> Login
              </Button>
              <Button
                size="sm"
                onClick={() => router.push('/sign-up')}
                className="gap-1 border border-2 shadow-sm transition-transform duration-200 ease-out hover:scale-105 font-semibold"
              >
                <User2Icon className="h-4 w-4" /> Register
              </Button>
            </div>
          )}
          {authenticated ? 
          <>
            {scansRemainingLabel ? (
              <span className="hidden sm:inline-flex whitespace-nowrap rounded-md border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                {scansRemainingLabel}
              </span>
            ) : null}
            <Button variant='link' onClick={() => router.push('/scan')} className="hidden sm:inline-flex transition-transform duration-200 ease-out hover:scale-105">
              Dashboard
            </Button>
            <Button className="hidden md:flex" onClick={() => signOut()}><LogOutIcon /> Logout</Button>
          </> : <></>}
          {/* Mobile Menu */}
          <div className="md:hidden">
            <NavigationSheet isHome={isHome} />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
