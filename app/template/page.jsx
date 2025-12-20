'use client'

import { CheckCircle, CheckIcon, DownloadIcon, Link, LinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button";

const sampleResume = {
    header: {
        name: "Ashish B Thoppil",
        phone: "+918848274176",
        email: "ashisht.developer@gmail.com",
        links: [
            "https://www.linkedin.com/in/ashish-thoppil",
            "https://github.com/ashishthoppil"
        ]
    },
    summary: {
        content: "Results-driven Fullstack Engineer experienced in building scalable, high-performance web applications with React, Next.js, TypeScript, Node.js, and modern tooling."
    },
    skills: {
        content: [
            "Frontend: React, Next.js, TypeScript, JavaScript, HTML5, CSS3, Sass, Tailwind, Bootstrap, MaterialUI, Storybook",
            "Backend: Node.js, Express.js, REST API, MongoDB, MySQL, JWT Auth",
            "Devops & Tools: Docker, Azure DevOps, AWS, Git & Github, CI/CD pipelines, Webpack, Vite, Babel",
            "Testing & QA: Jest, Unit Testing, Performance Profiling, Lighthouse",
            "Others: Agile Methodologies, Open Project, Jira"
        ]
    },
    experience: [
        {
            company: "Dbiz AI",
            location: "Kochi, India",
            designation: "Analyst - Frontend Dev",
            duration: "Sep 2024 - Jan 2025",
            responsibilities: [
                "Improved response time of a Retrieval-Augmented Generation (RAG) AI chatbot by 50% through streaming and async optimizations using Vercel AI SDK and Next.js",
                "Enhanced application performance and user experience through iterative profiling and code refinement",
                "Achieved 90%+ unit test coverage with Jest, reducing production bugs",
                "Collaborated in Agile setup for weekly releases"
            ]
        },
        {
            company: "Fingent Global Solutions",
            location: "Kochi, India",
            designation: "Software Engineer",
            duration: "Jul 2022 - Aug 2024",
            responsibilities: [
                "Designed and implemented scalable backend RBAC systems using Node.js and MongoDB",
                "Mentored junior developers to improve delivery speed and code quality",
                "Developed responsive frontend components with React",
                "Participated in sprint planning, QA cycles, and client demo presentations"
            ]
        }
    ],
    projects: [
        {
            title: "RAG Based AI Chatbot",
            description: "A customizable multi-tenant AI chatbot with a custom knowledge base, capable of streaming chat interactions.",
            link: "https://kulfi-ai.com"
        },
        {
            title: "ATS Resume Scanner",
            description: "AI-based resume scoring and optimization application using OpenAI APIs.",
            link: "https://ats-resume-scanner.com"
        }
    ],
    education: [
        {
            degree: "Master of Computer Applications",
            institute: "Mahatma Gandhi University, Kottayam",
            duration: "Aug 2015 - Dec 2018",
            grade: ""
        },
        {
            degree: "Bachelor of Computer Applications",
            institute: "Mahatma Gandhi University, Kottayam",
            duration: "May 2012 - Jun 2015",
            grade: ""
        }
    ],
    achievements: [
        "Awarded the Employee of the year award.",
        "Awarded the XYZ for completing the ABC at Google."
    ]
}

const Template = ({ resume, setResumeResult }) => {

    const [name, setName] = useState(resume.header.name);
    const [email, setEmail] = useState(resume.header.email);
    const [phone, setPhone] = useState(resume.header.phone);
    const [summary, setSummary] = useState(resume.summary.content);
    const [skills, setSkills] = useState(resume.skills.content);
    const [experience, setExperience] = useState(resume.experience);
    const [projects, setProjects] = useState(resume.projects);
    const [education, setEducation] = useState(resume.education);
    const [achievements, setAchievements] = useState(resume.achievements);

    useEffect(() => {
        const style = document.createElement('style')
        style.innerHTML = `
            .head-section h1 {
                font-size: 32px;
                font-weight: 800;
            }
     
            .head-section p {
                display: inline-block; 
            }

            div section:not(:last-child) {
                padding: 10px 0px;
            }
            
            section h2 {
                font-size: 22px;
                font-weight: 700;
                margin: 10px 0px;
            }

            section p {
                font-size: 16px;
            }

            .skills-section ul {
                list-style-type: circle;
                margin-left: 15px;
            }

            .experience-section article ul {
                list-style-type: circle;
                margin-left: 15px;
            }

            .achievements-section ul {
                list-style-type: circle;
                margin-left: 15px;
            }

            .projects-section article h3 {
                font-size: 12px;
                font-weight: 700;
            }
        `
        document.head.append(style);
    }, [])

    const headerModifier = (item, key) => {
        setResumeResult(prev => ({
            ...prev,
            header: {
                ...prev.header,
                [key]: item
            }
        }))
    }
    
    const summaryModifier = (item) => {
        setResumeResult(prev => ({
            ...prev,
            summary: {
                ...prev.summary,
                content: item
            }
        }))
    }

    const skillsModifier = (item) => {
        setResumeResult(prev => ({
            ...prev,
            skills: {
                ...prev.skills,
                content: item
            }
        }))
    }

    const experienceModifier = (item) => {
        setResumeResult(prev => ({
            ...prev,
            experience: item
        }))
    }

    const projectsModifier = (item) => {
        setResumeResult(prev => ({
            ...prev,
            projects: item
        }))
    }

    const educationModifier = (item) => {
        setResumeResult(prev => ({
            ...prev,
            education: item
        }))
    }

        const achievementModifier = (item) => {
        setResumeResult(prev => ({
            ...prev,
            achievements: item
        }))
    }
    return (
            <div className="px-12 py-10 h-[30rem] overflow-y-auto">
                {resume.header ? <div className="head-section">
                    <Popover>
                        <PopoverTrigger><h1 type="text" className="text-[18px] md:text-[32px] font-bold hover:bg-gray-300 cursor-pointer outline-none">{resume.header.name}</h1></PopoverTrigger>
                        <PopoverContent className='flex gap-1'><input className="py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={name} onChange={e => setName(e.target.value)} /><Button className='rounded-sm' onClick={() => headerModifier(name, 'name')}><CheckIcon /></Button></PopoverContent>
                    </Popover>
                    
                    <div className="flex gap-2 justify-start text-[12px]">
                        <div className="flex items-center">Email:&nbsp;
                            <Popover>
                                <PopoverTrigger><span className="hover:bg-gray-300 cursor-pointer outline-none">{resume.header.email}</span></PopoverTrigger>
                                <PopoverContent className='flex gap-1'><input className="py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={email} onChange={e => setEmail(e.target.value)} /><Button className='rounded-sm' onClick={() => headerModifier(email, 'email')}><CheckIcon /></Button></PopoverContent>
                            </Popover>
                        </div> | <div className="flex items-center">Phone:&nbsp;
                            <Popover>
                                <PopoverTrigger><span className="hover:bg-gray-300 cursor-pointer outline-none">{resume.header.phone}</span></PopoverTrigger>
                                <PopoverContent className='flex gap-1'><input className="py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={phone} onChange={e => setPhone(e.target.value)} /><Button className='rounded-sm' onClick={() => headerModifier(phone, 'phone')}><CheckIcon /></Button></PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    {/* <div className="flex gap-2 justify-start">
                        {resume.header.links.map((item, index) => {
                            return <span key={index} className="flex justify-start items-center">
                                <Link className="h-2" />
                                <a className="text-blue-700 text-[12px]"  href={item}>{item}</a>
                            </span>
                        })}
                    </div> */}
                </div> : <></>}

                {resume.summary ? <section className="summary-section">
                    {/* <h2>Summary</h2> */}
                    <Popover>
                        <PopoverTrigger><p className="text-[12px] w-full hover:bg-gray-300 cursor-pointer text-left">{resume.summary.content}</p></PopoverTrigger>
                        <PopoverContent className='flex gap-1'><textarea className="py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={summary} onChange={e => setSummary(e.target.value)} /><Button className='rounded-sm' onClick={() => summaryModifier(summary)}><CheckIcon /></Button></PopoverContent>
                    </Popover>
                    
                </section> : <></>}
                {resume.skills.content.length ? <section className="skills-section">
                    <h2>Skills</h2>
                    <ul>
                        {resume.skills.content.map((item, index) => {
                            return (
                                <Popover key={index}>
                                    <PopoverTrigger className='text-left'><li className="text-[12px] hover:bg-gray-300 cursor-pointer" key={index}>{item}</li></PopoverTrigger>
                                    <PopoverContent className='flex gap-1'><input className="py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={skills[index]} onChange={e => setSkills(prev => {
                                        const updatedData = prev.map((element, i) => {
                                            if (i === index) {
                                                return e.target.value
                                            } else {
                                                return element;
                                            }
                                        })
                                        return updatedData
                                    })} /><Button className='rounded-sm' onClick={() => skillsModifier(skills)}><CheckIcon /></Button></PopoverContent>
                                </Popover>
                            )
                        })}
                    </ul>
                </section> : <></>}

                {resume.experience.length ? 
                <section className="experience-section">
                    <h2>Experience</h2>
                    {resume.experience.map((item, index) => {
                        return (
                           
                                    <article className="mb-5" key={index}>
                                        <Popover>
                                            <PopoverTrigger className='text-left w-full'>
                                            <div className="hover:bg-gray-300 cursor-pointer">
                                                <div className="flex justify-between text-[12px] "><h3 className="italics">{item.company} - {item.location}</h3><p className="text-[12px]">{item.duration}</p></div>
                                                <p className="text-[12px]"><strong>{item.designation}</strong></p>
                                            </div>
                                            </PopoverTrigger>
                                            <PopoverContent className='flex flex-col justify-end items-end gap-2'>
                                                <div className="flex items-center gap-1 input-group">
                                                    <label className="w-[50%]">Company:</label>
                                                    <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={experience[index]['company']}
                                                        onChange={e => setExperience(prev => {
                                                            const updatedData = prev.map((element, i) => {
                                                                if (i === index) {
                                                                    console.log('updatedData', {
                                                                        ...element,
                                                                        company: e.target.value,
                                                                    });
                                                                    return {
                                                                        ...element,
                                                                        company: e.target.value,
                                                                    }
                                                                } else {
                                                                    return element;
                                                                }
                                                            })
                                                            
                                                            return updatedData
                                                        })} 
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1 input-group">
                                                    <label className="w-[50%]">Location:</label>
                                                    <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={experience[index]['location']}
                                                        onChange={e => setExperience(prev => {
                                                            const updatedData = prev.map((element, i) => {
                                                                if (i === index) {
                                                                    return {
                                                                        ...element,
                                                                        location: e.target.value,
                                                                    }
                                                                } else {
                                                                    return element;
                                                                }
                                                            })
                                                            
                                                            return updatedData
                                                        })} 
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1 input-group">
                                                    <label className="w-[50%]">Designation:</label>
                                                    <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={experience[index]['designation']}
                                                        onChange={e => setExperience(prev => {
                                                            const updatedData = prev.map((element, i) => {
                                                                if (i === index) {
                                                                    return {
                                                                        ...element,
                                                                        designation: e.target.value,
                                                                    }
                                                                } else {
                                                                    return element;
                                                                }
                                                            })
                                                            
                                                            return updatedData
                                                        })} 
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1 input-group">
                                                    <label className="w-[50%]">Duration:</label>
                                                    <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={experience[index]['duration']}
                                                        onChange={e => setExperience(prev => {
                                                            const updatedData = prev.map((element, i) => {
                                                                if (i === index) {
                                                                    return {
                                                                        ...element,
                                                                        duration: e.target.value,
                                                                    }
                                                                } else {
                                                                    return element;
                                                                }
                                                            })
                                                            
                                                            return updatedData
                                                        })} 
                                                    />
                                                </div>
                                                
                                                <Button className='rounded-sm' onClick={() => experienceModifier(experience)}><CheckIcon /></Button>
                                            </PopoverContent>
                                        </Popover>
                                        <ul>
                                            {item.responsibilities.map((item, resIndex) => {
                                                return (
                                                    <Popover key={resIndex}>
                                                        <PopoverTrigger><li className="text-[12px] hover:bg-gray-300 cursor-pointer text-left">{item}</li></PopoverTrigger>
                                                        <PopoverContent className='flex gap-1'>
                                                            <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={experience[index]['responsibilities'][resIndex]}
                                                                onChange={e => setExperience(prev => {
                                                                    const updatedData = prev.map((element, i) => {
                                                                        if (i === index) {
                                                                            const updatedRes = [];
                                                                            prev[i].responsibilities.map((el, j) => {
                                                                                if (j === resIndex) {
                                                                                    updatedRes.push(e.target.value)
                                                                                } else {
                                                                                    updatedRes.push(el)
                                                                                }
                                                                            })

                                                                            return { ...prev[i], responsibilities: updatedRes }
                                                                        } else {
                                                                            return element;
                                                                        }
                                                                        
                                                                    })
                                                                    console.log('updatedDataupdatedData', updatedData);
                                                                    return updatedData
                                                                })} 
                                                            />
                                                            <Button className='rounded-sm' onClick={() => experienceModifier(experience)}><CheckIcon /></Button></PopoverContent>
                                                    </Popover>
                                                )
                                            })}
                                        </ul>
                                    </article>
                        )
                    })}
                </section> : <></>}

                {resume.projects.length ? <section className="projects-section">
                    <h2>Projects</h2>
                    {resume.projects.map((item, index) => {
                        return (
                            <Popover key={index}>
                                <PopoverTrigger className="text-left">
                                    <article className="hover:bg-gray-300 cursor-pointer" key={index}>
                                        <div className="flex gap-1"><h3 className="text-[12px]">{item.title}</h3>{item.link ? <p className=""><a href={item.link}><LinkIcon className="h-4" /></a></p> : <></>}</div>
                                        <p className="text-[12px]">{item.description}</p>
                                    </article>
                                </PopoverTrigger>
                                <PopoverContent className='flex flex-col gap-1'>
                                    <div className="flex items-center gap-1 input-group">
                                        <label className="w-[50%]">Title:</label>
                                        <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={projects[index]['title']}
                                            onChange={e => setProjects(prev => {
                                                const updatedData = prev.map((element, i) => {
                                                    if (i === index) {
                                                        return {
                                                            ...element,
                                                            title: e.target.value,
                                                        }
                                                    } else {
                                                        return element;
                                                    }
                                                })
                                                            
                                                return updatedData
                                            })} 
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 input-group">
                                        <label className="w-[50%]">Link:</label>
                                        <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={projects[index]['link']}
                                            onChange={e => setProjects(prev => {
                                                const updatedData = prev.map((element, i) => {
                                                    if (i === index) {
                                                        return {
                                                            ...element,
                                                            link: e.target.value,
                                                        }
                                                    } else {
                                                        return element;
                                                    }
                                                })
                                                            
                                                return updatedData
                                            })} 
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 input-group">
                                        <label className="w-[50%]">Description:</label>
                                        <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={projects[index]['description']}
                                            onChange={e => setExperience(prev => {
                                                const updatedData = prev.map((element, i) => {
                                                    if (i === index) {
                                                        return {
                                                            ...element,
                                                            description: e.target.value,
                                                        }
                                                    } else {
                                                        return element;
                                                    }
                                                })
                                                            
                                                return updatedData
                                            })} 
                                        />
                                    </div>
                                    <Button className='rounded-sm' onClick={() => projectsModifier(projects)}><CheckIcon /></Button>
                                </PopoverContent>
                            </Popover>    
                        )
                    })}
                </section> : <></>}

                {resume.education.length ? <section className="education-section">
                    <h2>Education</h2>
                    {resume.education.map((item, index) => {
                        return (
                            <Popover key={index}>
                                <PopoverTrigger className="text-left">
                                    <article key={index} className="hover:bg-gray-300 cursor-pointer text-[12px]">
                                        <h3 className="font-semibold">{item.degree} {item.grade ? '- GPA: ' + item.grade : ''}</h3>
                                        <p className="text-[12px]">{item.institute}, {item.duration}</p>
                                    </article>
                                </PopoverTrigger>
                                <PopoverContent className='flex flex-col gap-1'>
                                    <div className="flex items-center gap-1 input-group">
                                        <label className="w-[50%]">Degree:</label>
                                        <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={education[index]['degree']}
                                            onChange={e => setEducation(prev => {
                                                const updatedData = prev.map((element, i) => {
                                                    if (i === index) {
                                                        return {
                                                            ...element,
                                                            degree: e.target.value,
                                                        }
                                                    } else {
                                                        return element;
                                                    }
                                                })
                                                            
                                                return updatedData
                                            })} 
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 input-group">
                                        <label className="w-[50%]">Grade:</label>
                                        <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={education[index]['grade']}
                                            onChange={e => setEducation(prev => {
                                                const updatedData = prev.map((element, i) => {
                                                    if (i === index) {
                                                        return {
                                                            ...element,
                                                            grade: e.target.value,
                                                        }
                                                    } else {
                                                        return element;
                                                    }
                                                })
                                                            
                                                return updatedData
                                            })} 
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 input-group">
                                        <label className="w-[50%]">Institute:</label>
                                        <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={education[index]['institute']}
                                            onChange={e => setEducation(prev => {
                                                const updatedData = prev.map((element, i) => {
                                                    if (i === index) {
                                                        return {
                                                            ...element,
                                                            institute: e.target.value,
                                                        }
                                                    } else {
                                                        return element;
                                                    }
                                                })
                                                            
                                                return updatedData
                                            })} 
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 input-group">
                                        <label className="w-[50%]">Duration:</label>
                                        <input className="w-[50%] py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={education[index]['duration']}
                                            onChange={e => setEducation(prev => {
                                                const updatedData = prev.map((element, i) => {
                                                    if (i === index) {
                                                        return {
                                                            ...element,
                                                            duration: e.target.value,
                                                        }
                                                    } else {
                                                        return element;
                                                    }
                                                })
                                                            
                                                return updatedData
                                            })} 
                                        />
                                    </div>
                                    <Button className='rounded-sm' onClick={() => educationModifier(education)}><CheckIcon /></Button>
                                </PopoverContent>
                            </Popover>
                        )
                    })}
                </section> : <></>}

                {resume.achievements.length ? <section className="achievements-section">
                    <h2>Achievements</h2>
                    <ul>
                        {resume.achievements.map((item, index) => {
                            return (
                                <Popover key={index}>
                                    <PopoverTrigger className='text-left'><li className="text-[12px] hover:bg-gray-300 cursor-pointer">{item}</li></PopoverTrigger>
                                    <PopoverContent className='flex gap-1'><input className="py-1 px-2 border dark:border-slate-700/70 rounded-sm outline-none w-[100%]" value={achievements[index]} onChange={e => setAchievements(prev => {
                                        const updatedData = prev.map((element, i) => {
                                            if (i === index) {
                                                return e.target.value
                                            } else {
                                                return element;
                                            }
                                        })
                                        return updatedData
                                    })} /><Button className='rounded-sm' onClick={() => achievementModifier(achievements)}><CheckIcon /></Button></PopoverContent>
                                </Popover>
                            )
                        })}
                    </ul>
                </section> : <></>}
            </div>
    )
}

export default function Page() {
    const [resume, setResumeResult] = useState(sampleResume);

    return <Template resume={resume} setResumeResult={setResumeResult} />;
}
