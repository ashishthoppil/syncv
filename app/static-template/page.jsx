import { Geist } from "next/font/google";

const geistSans = Geist({
  subsets: ["latin"],
});

const sampleResume = {
  header: {
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+1 (555) 555-5555",
  },
  summary: {
    content:
      "Full-stack engineer with experience in building performant web apps, APIs, and PDF workflows. Skilled at turning product ideas into shipped features.",
  },
  skills: {
    content: [
      "Frontend: React, Next.js, TypeScript, Tailwind, CSS",
      "Backend: Node.js, Express, MongoDB, REST",
      "Tooling: GitHub, CI/CD, Docker",
    ],
  },
  experience: [
    {
      designation: "Senior Engineer",
      company: "Acme Corp",
      location: "Remote",
      duration: "2022 - Present",
      responsibilities: [
        "Built and maintained internal tooling for PDF exports and reporting.",
        "Led performance tuning efforts that improved build times and page speed scores.",
      ],
    },
    {
      designation: "Software Engineer",
      company: "Globex",
      location: "New York, NY",
      duration: "2019 - 2022",
      responsibilities: [
        "Developed customer-facing dashboards with React and Next.js.",
        "Collaborated with design and product to ship accessible UI components.",
      ],
    },
  ],
  projects: [
    {
      title: "ATS Resume Scanner",
      description: "AI-based resume scoring and optimization application.",
      link: "https://example.com/ats",
    },
    {
      title: "PDF Generator",
      description: "Utility that converts rich HTML templates into PDFs.",
      link: "https://example.com/pdf",
    },
  ],
  education: [
    {
      degree: "B.S. Computer Science",
      institute: "State University",
      duration: "2015 - 2019",
      grade: "GPA: 3.8/4.0",
    },
  ],
  achievements: [
    "Employee of the Year 2023",
    "Open-source contributor to popular React libraries",
  ],
};

const StaticPDF = ({ resume }) => {
  return (
    <div className={geistSans.className} style={{ fontSize: "12px" }}>
      <div className="head-section">
        <h1>{resume.header.name}</h1>
        <p>
          Email: {resume.header.email} | Phone: {resume.header.phone}
        </p>
      </div>
      <section>
        <h2>Summary</h2>
        <p>{resume.summary.content}</p>
      </section>

      <section>
        <h2>Skills</h2>
        <ul>
          {resume.skills.content.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Experience</h2>
        {resume.experience.map((job, idx) => (
          <div key={idx}>
            <strong>{job.designation}</strong> @ {job.company}, {job.location}{" "}
            <span style={{ float: "right" }}>{job.duration}</span>
            <ul>
              {job.responsibilities.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section>
        <h2>Projects</h2>
        {resume.projects.map((project, idx) => (
          <div key={idx}>
            <strong>{project.title}</strong>
            <br />
            {project.description}
            <br />
            {project.link && <a href={project.link}>{project.link}</a>}
          </div>
        ))}
      </section>

      <section>
        <h2>Education</h2>
        {resume.education.map((edu, idx) => (
          <div key={idx}>
            <strong>{edu.degree}</strong>{" "}
            {edu.grade ? ` - ${edu.grade}` : ""}
            <br />
            {edu.institute}, {edu.duration}
          </div>
        ))}
      </section>

      {resume.achievements && (
        <section>
          <h2>Achievements</h2>
          <ul>
            {resume.achievements.map((ach, idx) => (
              <li key={idx}>{ach}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default function Page() {
  return <StaticPDF resume={sampleResume} />;
}
