"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";

const VIDEO_ID = "GwSVCSwacgE";

// Autoplay only works muted, so the video starts silent with no YouTube chrome
// (controls, keyboard, related videos) and loops. `enablejsapi` lets the custom
// sound toggle below drive it, since the player's own controls are hidden.
const EMBED_SRC =
  `https://www.youtube-nocookie.com/embed/${VIDEO_ID}` +
  `?autoplay=1&mute=1&controls=0&loop=1&playlist=${VIDEO_ID}` +
  "&rel=0&modestbranding=1&playsinline=1&disablekb=1&iv_load_policy=3&enablejsapi=1";

const DemoVideo = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleSound = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: muted ? "unMute" : "mute",
        args: [],
      }),
      "*"
    );
    setMuted((previous) => !previous);
  };

  return (
    <div id="demo" className="w-full py-12 xs:py-20 px-6">
      <h2 className="text-3xl xs:text-4xl sm:text-5xl font-bold tracking-tight text-center">
        From Resume to Job-Specific Resume in 2 Clicks
      </h2>
      <p className="text-xl sm:text-2xl font-normal tracking-tight text-center mt-3 text-foreground/80">
        Job description in. Tailored resume out.
      </p>
      <div className="w-full max-w-6xl mx-auto mt-10 sm:mt-16">
        <div className="relative rounded-2xl border bg-background p-2 shadow-sm">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
            {/*
              The title bar, share button, logo and centre controls are hover
              chrome, and YouTube has no parameter to turn them off. Blocking
              pointer events means the player never sees a hover, so none of it
              appears. The sound toggle below drives the player over postMessage
              rather than clicks, so nothing is lost by making it inert.
            */}
            <iframe
              ref={iframeRef}
              src={EMBED_SRC}
              title="SynCV product demo"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              // Defers the YouTube player (a few hundred KB of third-party JS)
              // until it is near the viewport, keeping it off the critical path.
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
      </div>
    </div>
  );
};

export default DemoVideo;
