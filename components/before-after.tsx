import Image from "next/image";

const BeforeAfter = () => {
  return (
    <div id="before-after" className="w-full py-12 xs:py-20 px-6">
      <h2 className="text-3xl xs:text-4xl sm:text-5xl font-bold tracking-tight text-center">
        See the Difference: Before and After
      </h2>
      <p className="text-xl sm:text-2xl font-normal tracking-tight text-center mt-3 text-foreground/80">
        Same experience. Different resume — here is what changes when you tailor for the role.
      </p>
      <div className="w-full max-w-6xl mx-auto mt-10 sm:mt-16">
        <div className="rounded-2xl border bg-background p-2 shadow-sm">
          <Image
            src="/before-after.png"
            alt="A generic resume side by side with the same resume tailored by SynCV for a Frontend Developer role, with relevant keywords and achievements highlighted."
            width={1536}
            height={1024}
            sizes="(max-width: 1152px) 100vw, 1152px"
            className="h-auto w-full rounded-xl"
          />
        </div>
      </div>
    </div>
  );
};

export default BeforeAfter;
