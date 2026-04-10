"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent } from "react";
import { toast } from "react-toastify";

const footerLinks = [
  {
    title: "Features",
    href: "#features",
  },
  {
    title: "Pricing",
    href: "#pricing",
  },
  {
    title: "FAQ",
    href: "#faq",
  },
  {
    title: "Scan",
    href: "/scan",
  },
  {
    title: "Testimonials",
    href: "#testimonials",
  },
  {
    title: "Privacy",
    href: "mailto:support@aligncv.com?subject=Privacy%20Policy%20Request",
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
        <div className="py-12 flex flex-col sm:flex-row items-start justify-between gap-x-8 gap-y-10 px-6 xl:px-0">
          <div>
            {/* Logo */}
            <Image alt="SynCV Logo" src='/logo-white.png' height={100} width={100} />

            <ul className="mt-6 flex items-center gap-4 flex-wrap">
              {footerLinks.map(({ title, href }) => (
                <li key={title}>
                  <Link
                    href={href}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Subscribe Newsletter */}
          <div className="max-w-xs w-full">
            <h6 className="font-semibold">Stay up to date</h6>
            <form className="mt-6 flex items-center gap-2" onSubmit={handleSubscribe}>
              <Input type="email" placeholder="Enter your email" />
              <Button type="submit">Subscribe</Button>
            </form>
          </div>
        </div>
        <Separator />
        <div className="py-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-x-2 gap-y-5 px-6 xl:px-0">
          {/* Copyright */}
          <span className="text-muted-foreground text-center sm:text-start">
            &copy; {new Date().getFullYear()}{" "}
            <Link href="/" target="_blank">
              SynCV
            </Link>
            . All rights reserved.
          </span>

          <div className="flex items-center gap-5 text-muted-foreground">
            <Link href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer">
              <LinkedinIcon className="h-5 w-5" />
            </Link>
            <Link href="https://x.com" target="_blank" rel="noopener noreferrer">
              <TwitterIcon className="h-5 w-5" />
            </Link>
            <Link href="https://www.instagram.com" target="_blank" rel="noopener noreferrer">
              <InstagramIcon className="h-5 w-5" />
            </Link>
            <Link href="https://www.facebook.com" target="_blank" rel="noopener noreferrer">
              <FacebookIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
