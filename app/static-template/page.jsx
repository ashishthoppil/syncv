import { Geist } from "next/font/google";

const geistSans = Geist({
  subsets: ["latin"],
});

export const StaticPDF = ({ resume }) => {
  return (
    <div style={{ fontSize: "12px" }}>
      <div className="head-section">
        <h1>{resume.header.name}</h1>
        <p>Email: {resume.header.email} | Phone: {resume.header.phone}</p>
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
            <strong>{job.designation}</strong> @ {job.company}, {job.location} <span style={{ float: "right" }}>{job.duration}</span>
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
            <strong>{project.title}</strong><br />
            {project.description}<br />
            {project.link && <a href={project.link}>{project.link}</a>}
          </div>
        ))}
      </section>

      <section>
        <h2>Education</h2>
        {resume.education.map((edu, idx) => (
          <div key={idx}>
            <strong>{edu.degree}</strong> {edu.grade ? ` - GPA: ${edu.grade}` : ""}
            <br />
            {edu.institute}, {edu.duration}
          </div>
        ))}
      </section>

      {resume.achievements &&<section>
        <h2>Achievements</h2>
        <ul>
          {resume.achievements.map((ach, idx) => (
            <li key={idx}>{ach}</li>
          ))}
        </ul>
      </section>}
    </div>
  );
};
