"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { InstagramIcon, LinkedinIcon, YoutubeIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent } from "react";
import { toast } from "react-toastify";

/**
 * The footer is the site's internal-link backbone: it renders on every
 * marketing page, which is what keeps the landing pages, guides and role pages
 * reachable from anywhere instead of orphaned behind the homepage.
 *
 * Links are grouped and use descriptive anchor text — the page's actual
 * subject, not "learn more".
 */
const linkGroups = [
  {
    title: "Product",
    links: [
      { title: "Resume tailoring", href: "/resume-tailor" },
      { title: "ATS resume checker", href: "/ats-resume-checker" },
      { title: "Job description analyzer", href: "/job-description-analyzer" },
      { title: "Cover letter generator", href: "/ai-cover-letter-generator" },
      { title: "Job application tracker", href: "/job-application-tracker" },
    ],
  },
  {
    title: "Learn",
    links: [
      { title: "Resume tailoring guides", href: "/resources" },
      {
        title: "Tailor a resume to a job description",
        href: "/resources/how-to-tailor-your-resume-to-a-job-description",
      },
      { title: "Optimise a resume for ATS", href: "/resources/how-to-optimize-a-resume-for-ats" },
      { title: "Resume advice by role", href: "/resume-for" },
    ],
  },
  {
    title: "Company",
    links: [
      { title: "About SynCV", href: "/about" },
      { title: "Contact", href: "/contact" },
      { title: "Privacy policy", href: "/privacy" },
      { title: "Terms of service", href: "/terms" },
      { title: "Refund policy", href: "/refund-policy" },
    ],
  },
];

/** Official accounts only — these are the same URLs as Organization.sameAs. */
const socials = [
  {
    label: "SynCV on LinkedIn",
    href: "https://www.linkedin.com/company/syncv-app",
    Icon: LinkedinIcon,
  },
  {
    label: "SynCV on Instagram",
    href: "https://www.instagram.com/syncv.app/",
    Icon: InstagramIcon,
  },
  {
    label: "SynCV on YouTube",
    href: "https://www.youtube.com/@syncv.app5",
    Icon: YoutubeIcon,
  },
];

const Footer = () => {
  const handleSubscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast.info("We’ll be starting our newsletters soon. Stay tuned!");
  };

  return (
    <footer className="dark:border-t mt-40 dark bg-background text-foreground">
      <div className="max-w-screen-xl mx-auto">
        <div className="grid gap-x-8 gap-y-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-5 xl:px-0">
          <div className="lg:col-span-2">
            {/* 2000 × 462 source: declaring the real ratio reserves the right box before the image loads. */}
            <Image alt="SynCV" src="/logo-white.png" height={23} width={100} />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Your resume should change for every job. Your experience shouldn&apos;t.
            </p>

            <div className="mt-6 max-w-xs">
              <h2 className="text-sm font-semibold">Stay up to date</h2>
              <form className="mt-3 flex items-center gap-2" onSubmit={handleSubscribe}>
                <label htmlFor="footer-email" className="sr-only">
                  Email address
                </label>
                <Input
                  id="footer-email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                />
                <Button type="submit">Subscribe</Button>
              </form>
            </div>
          </div>

          {linkGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-sm font-semibold">{group.title}</h2>
              <ul className="mt-4 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <Separator />

        <div className="py-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-x-2 gap-y-5 px-6 xl:px-0">
          <span className="text-muted-foreground text-center text-sm sm:text-start">
            &copy; {new Date().getFullYear()} <Link href="/">SynCV</Link>. All rights
            reserved.
          </span>

          <div className="flex items-center gap-5 text-muted-foreground">
            {socials.map(({ label, href, Icon }) => (
              <Link
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="hover:text-foreground"
              >
                <Icon className="h-5 w-5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
