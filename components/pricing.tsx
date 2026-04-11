"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CircleCheck, CircleHelp, CircleX } from "lucide-react";
import Link from "next/link";

const tooltipContent = {
  scans: "Each scan gives role-specific feedback to improve your resume quickly.",
  generation: "Generate targeted resume and cover letter drafts from each job description.",
};

const plans = [
  {
    name: "Speed",
    price: 699,
    description:
      "Built for fast job applications with essential optimization tools.",
    features: [
      { title: "12 resume scans every week", tooltip: tooltipContent.scans },
      { title: "Resume generation", tooltip: tooltipContent.generation },
      { title: "One click analysis and optimization" },
      { title: "No job tracker" },
      { title: "No cover letter generation" },
    ],
    buttonText: "Choose Speed Plan",
    href: "/sign-up?plan=speed",
  },
  {
    name: "Pro",
    price: 749,
    isRecommended: true,
    description:
      "Best value for serious applicants who need faster and fuller workflow support.",
    features: [
      { title: "50 resume scans every week", tooltip: tooltipContent.scans },
      { title: "Instant resume generation", tooltip: tooltipContent.generation },
      { title: "Cover letter generation", tooltip: tooltipContent.generation },
      { title: "Job tracking" },
      { title: "One click analysis and optimization" },
      { title: "Free upgrade to top plan which will be introduced soon" },
    ],
    buttonText: "Choose Pro Plan",
    href: "/sign-up?plan=pro",
    isPopular: true,
  },
];

const Pricing = () => {
  return (
    <div
      id="pricing"
      className="flex flex-col items-center justify-center py-12 xs:py-20 px-6"
    >
      <h1 className="text-3xl xs:text-4xl md:text-5xl font-bold text-center tracking-tight">
        Pricing
      </h1>
      {/* <Tabs
        value={selectedBillingPeriod}
        onValueChange={setSelectedBillingPeriod}
        className="mt-8"
      >
        <TabsList className="h-11 px-1.5 rounded-full bg-primary/5">
          <TabsTrigger value="monthly" className="py-1.5 rounded-full">
            Monthly
          </TabsTrigger>
          <TabsTrigger value="yearly" className="py-1.5 rounded-full">
            Yearly (Save {YEARLY_DISCOUNT}%)
          </TabsTrigger>
        </TabsList>
      </Tabs> */}
      <div className="mt-12 max-w-screen-lg mx-auto grid grid-cols-1 lg:grid-cols-2 items-center gap-8">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn("relative border rounded-xl p-6 bg-background/50", {
              "border-[2px] border-primary bg-background py-10": plan.isPopular,
            })}
          >
            {plan.isPopular && (
              <Badge className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2">
                Most Popular
              </Badge>
            )}
            <h3 className="text-lg font-medium">{plan.name}</h3>
            <p className="mt-2 text-4xl font-bold">
              ₹{plan.price}
              <span className="ml-1.5 text-sm text-muted-foreground font-normal">
                /month
              </span>
            </p>
            <p className="mt-4 font-medium text-muted-foreground">
              {plan.description}
            </p>

            <Button
              variant={plan.isPopular ? "default" : "outline"}
              size="lg"
              className="w-full mt-6 text-base"
              asChild
            >
              <Link href={plan.href}>{plan.buttonText}</Link>
            </Button>
            <Separator className="my-8" />
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li key={feature.title} className="flex items-start gap-1.5">
                  {feature.title === "No job tracker" || feature.title === "No cover letter generation" ? 
                  <CircleX className="h-4 w-4 mt-1 text-red-600" /> :
                  <CircleCheck className="h-4 w-4 mt-1 text-green-600" />}
                  {feature.title}
                  {feature.tooltip && (
                    <Tooltip>
                      <TooltipTrigger className="cursor-help">
                        <CircleHelp className="h-4 w-4 mt-1 text-gray-500" />
                      </TooltipTrigger>
                      <TooltipContent>{feature.tooltip}</TooltipContent>
                    </Tooltip>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Pricing;
