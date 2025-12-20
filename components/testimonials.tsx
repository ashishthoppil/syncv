import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Marquee from "@/components/ui/marquee";
import Link from "next/link";
import React, { ComponentProps } from "react";

const testimonials = [
  {
    id: 1,
    name: "Aarav Mehta",
    designation: "Frontend Developer",
    company: "Spotify",
    testimonial: "Helped me land interviews faster than ever before.",
    avatar: "https://randomuser.me/api/portraits/men/1.jpg",
  },
  {
    id: 2,
    name: "Sophia Lindberg",
    designation: "Business Analyst",
    company: "Klarna",
    testimonial: "A must-have tool if you're serious about getting hired.",
    avatar: "https://randomuser.me/api/portraits/women/6.jpg",
  },
  {
    id: 3,
    name: "Kunal Verma",
    designation: "UI/UX Designer",
    company: "Designable",
    testimonial: "The resume feedback was precise and actionable.",
    avatar: "https://randomuser.me/api/portraits/men/3.jpg",
  },
  {
    id: 4,
    name: "Emily Davis",
    designation: "Digital Marketer",
    company: "HubSpot",
    testimonial: "Clean interface and instant resume scoring — love it!",
    avatar: "https://randomuser.me/api/portraits/women/4.jpg",
  },
  {
    id: 5,
    name: "Daniel Costa",
    designation: "Software Engineer",
    company: "Zerocode Labs",
    testimonial: "Best resume tool I’ve used during my job search.",
    avatar: "https://randomuser.me/api/portraits/men/5.jpg",
  },
  {
    id: 6,
    name: "Megha Joshi",
    designation: "Product Manager",
    company: "Revolut",
    testimonial: "Super helpful in tailoring my resume to job posts.",
    avatar: "https://randomuser.me/api/portraits/women/2.jpg",
  },
  {
    id: 7,
    name: "James Carter",
    designation: "DevOps Engineer",
    company: "Cloudsmith.io",
    testimonial: "I optimized my resume and landed three interviews in a week.",
    avatar: "https://randomuser.me/api/portraits/men/7.jpg",
  },
  {
    id: 8,
    name: "Priya Nair",
    designation: "Data Scientist",
    company: "Fractal Analytics",
    testimonial: "ATS score insights were accurate and easy to act on.",
    avatar: "https://randomuser.me/api/portraits/women/8.jpg",
  },
  {
    id: 9,
    name: "Lucas Müller",
    designation: "Cloud Architect",
    company: "Siemens",
    testimonial: "Perfect tool for European job applications.",
    avatar: "https://randomuser.me/api/portraits/men/9.jpg",
  },
  // {
  //   id: 10,
  //   name: "Alina Popescu",
  //   designation: "QA Engineer",
  //   company: "Nordbyte",
  //   testimonial: "Quick, smart, and spot-on suggestions every time.",
  //   avatar: "https://randomuser.me/api/portraits/women/10.jpg",
  // },
  // {
  //   id: 11,
  //   name: "Jason Wright",
  //   designation: "Full Stack Developer",
  //   company: "Craftly Labs",
  //   testimonial: "The matching system helped me stand out for top roles.",
  //   avatar: "https://randomuser.me/api/portraits/men/11.jpg",
  // },
  // {
  //   id: 12,
  //   name: "Sneha Roy",
  //   designation: "HR Manager",
  //   company: "Turing",
  //   testimonial: "Impressed by how precise the resume suggestions were.",
  //   avatar: "https://randomuser.me/api/portraits/women/12.jpg",
  // },
  // {
  //   id: 13,
  //   name: "Olivier Lefevre",
  //   designation: "Technical Project Manager",
  //   company: "NeoGrid Systems",
  //   testimonial: "Made resume tailoring for each job post super efficient.",
  //   avatar: "https://randomuser.me/api/portraits/men/13.jpg",
  // },
  // {
  //   id: 14,
  //   name: "Lara Schmidt",
  //   designation: "Marketing Lead",
  //   company: "Zalando",
  //   testimonial: "The resume and cover letter generator is a time-saver.",
  //   avatar: "https://randomuser.me/api/portraits/women/14.jpg",
  // },
  // {
  //   id: 15,
  //   name: "Victor Novak",
  //   designation: "AI Researcher",
  //   company: "CognitivAI",
  //   testimonial: "Great tool for tech roles — even nailed niche keywords.",
  //   avatar: "https://randomuser.me/api/portraits/men/15.jpg",
  // },
  // {
  //   id: 16,
  //   name: "Isabelle Moreau",
  //   designation: "Content Strategist",
  //   company: "Storylane",
  //   testimonial: "Helped me refine my tone and presentation instantly.",
  //   avatar: "https://randomuser.me/api/portraits/women/16.jpg",
  // },
];

const Testimonials = () => (
  <div id="testimonials" className="flex justify-center items-center py-20">
    <div className="h-full w-full">
      <h2 className="mb-12 text-4xl md:text-5xl font-bold text-center tracking-tight px-6">
        Testimonials
      </h2>
      <div className="relative">
        <div className="z-10 absolute left-0 inset-y-0 w-[15%] bg-gradient-to-r from-background to-transparent" />
        <div className="z-10 absolute right-0 inset-y-0 w-[15%] bg-gradient-to-l from-background to-transparent" />
        <Marquee pauseOnHover className="[--duration:20s]">
          <TestimonialList />
        </Marquee>
        <Marquee pauseOnHover reverse className="mt-0 [--duration:20s]">
          <TestimonialList />
        </Marquee>
      </div>
    </div>
  </div>
);

const TestimonialList = () =>
  testimonials.map((testimonial) => (
    <div
      key={testimonial.id}
      className="min-w-96 max-w-sm bg-accent rounded-xl p-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar>
            <AvatarFallback className="text-xl font-medium bg-primary text-primary-foreground">
              {testimonial.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{testimonial.name}</p>
            <p className="text-sm text-gray-500">{testimonial.designation}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" asChild>
          <Link href="#" target="_blank">
            <TwitterLogo className="w-4 h-4" />
          </Link>
        </Button>
      </div>
      <p className="mt-5 text-[17px]">{testimonial.testimonial}</p>
    </div>
  ));

const TwitterLogo = (props: ComponentProps<"svg">) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>X</title>
    <path
      fill="currentColor"
      d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
    />
  </svg>
);

export default Testimonials;
