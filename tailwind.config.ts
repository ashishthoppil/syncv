import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Homepage palette: the app's black and white plus one accent, used
        // surgically — the headline highlight, check marks, eyebrow dots,
        // hover and link accents — never as a large fill.
        //
        // `DEFAULT` is for light backgrounds (~7:1 on white, so it is safe on
        // text); `light` is the same hue for dark ones, where the deep shade
        // drops to ~2.8:1 against near-black and goes muddy.
        brand: {
          DEFAULT: "#6D28D9",
          light: "#A78BFA",
        },
        ink: {
          DEFAULT: "#0A0A0A",
          soft: "#555555",
        },
        hairline: "#E8E8E8",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      screens: {
        xs: "375px",
      },
      animation: {
        marquee: "marquee var(--duration) linear infinite",
        "marquee-vertical": "marquee-vertical var(--duration) linear infinite",
        // Attention ping for the "Create tailored CV" CTA. Same easing curve
        // Tailwind's own animate-ping uses, so it decelerates the same way.
        "cta-ping": "cta-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite",
        // Breathing halo around the first-run tour's spotlight.
        "tour-pulse": "tour-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        // Homepage entrance (hero, on load) and scroll reveals (<Reveal>).
        // `backwards` holds the start frame through any animation-delay, then
        // lets go completely once it ends — no lingering transform, so the
        // element's own hover transitions keep working afterwards.
        "reveal-up": "reveal-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) backwards",
      },
      keyframes: {
        marquee: {
          from: {
            transform: "translateX(0)",
          },
          to: {
            transform: "translateX(calc(-100% - var(--gap)))",
          },
        },
        "marquee-vertical": {
          from: {
            transform: "translateY(0)",
          },
          to: {
            transform: "translateY(calc(-100% - var(--gap)))",
          },
        },
        // Ring radiating out from the button edge. Uses box-shadow spread
        // rather than transform: scale — the CTA is a wide rectangle, and
        // scaling a ring around it stretches the sides far more than the ends.
        // Spread grows uniformly in px, so the ring keeps the button's shape.
        "cta-ping": {
          "0%": { boxShadow: "0 0 0 0 rgba(15, 23, 42, 0.5)" },
          "70%": { boxShadow: "0 0 0 14px rgba(15, 23, 42, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(15, 23, 42, 0)" },
        },
        // Same spread trick as cta-ping, in white — the tour ring sits on top
        // of a darkened page, where a slate halo would be invisible.
        "tour-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(255, 255, 255, 0.55)" },
          "70%": { boxShadow: "0 0 0 10px rgba(255, 255, 255, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255, 255, 255, 0)" },
        },
        "reveal-up": {
          from: { opacity: "0", transform: "translateY(1.5rem)" },
        },
      },
    },
  },
  plugins: [animate],
} satisfies Config;
