"use client";

import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";

const PLAYBACK_ID = "01kt501LGvRGXgMQpXhGKDtCdZGjYs95iIt7RnyBfGOO00";
const PLAYER_ORIGIN = "https://player.mux.com";

// Autoplay only works muted, so the demo plays silent and loops. Mux Player
// keeps its control bar hidden while it plays untouched, and the iframe below
// takes no pointer events, so it never sees the hover that would show it.
const EMBED_SRC =
  `${PLAYER_ORIGIN}/${PLAYBACK_ID}` +
  "?autoplay=muted&muted=true&loop=true" +
  "&disable-cookies=true&metadata-video-title=SynCV+product+demo";

const DemoVideo = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);

  // The iframe speaks the Player.js protocol, which is how the sound toggle
  // reaches a player it cannot be clicked through to.
  const toggleSound = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        context: "player.js",
        version: "0.0.1",
        method: muted ? "unmute" : "mute",
      }),
      PLAYER_ORIGIN
    );
    setMuted((previous) => !previous);
  };

  return (
    <div id="demo" className="w-full px-6 py-16 sm:py-24">
      <SectionHeading
        eyebrow="See it in action"
        title={
          // Kept whole: the browser would otherwise happily break the line at
          // the hyphen and leave "Job-" dangling.
          <>
            From Resume to <span className="whitespace-nowrap">Job-Specific</span> Resume in 2 Clicks
          </>
        }
        description="Job description in. Tailored resume out."
      />
      <Reveal delay={100} className="relative isolate mx-auto mt-12 w-full max-w-6xl sm:mt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-8 -inset-y-10 -z-10 bg-[radial-gradient(closest-side,theme(colors.neutral.100),transparent)] sm:-inset-x-24"
        />
        <div className="relative rounded-[1.25rem] border border-hairline bg-white/80 p-2 shadow-2xl shadow-neutral-900/10 ring-1 ring-neutral-900/5">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
            {/*
              Blocking pointer events keeps the player's own chrome away: with
              no hover and no clicks, the control bar never comes up. The sound
              toggle below drives the player over postMessage instead, so
              nothing is lost by making it inert.
            */}
            <iframe
              ref={iframeRef}
              src={EMBED_SRC}
              title="SynCV product demo"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              // Defers the player until it is near the viewport, keeping that
              // third-party JS off the critical path.
              loading="lazy"
              className="pointer-events-none absolute inset-0 h-full w-full border-0"
            />
          </div>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={muted ? "Unmute demo video" : "Mute demo video"}
            className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/70 text-background backdrop-blur transition-colors hover:bg-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {muted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
        </div>
      </Reveal>
    </div>
  );
};

export default DemoVideo;
