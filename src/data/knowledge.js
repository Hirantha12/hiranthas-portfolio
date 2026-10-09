// The facts the AI assistant is allowed to use, built from the same data the site shows.
// Only public, professional information goes here. Private CV details (NIC, date of birth,
// phone, street address, referees' contacts) are deliberately left out.
import { PROFILE, PROJECTS, MOVES, SKILLS } from './content.js';

// Each section is a self-contained chunk, so retrieval (RAG) can be added later without
// rewriting anything: index these chunks and send only the relevant ones.
export const KNOWLEDGE = [
  { id: 'profile', title: 'Profile', text:
    `${PROFILE.name}, ${PROFILE.role}, based in Colombo, Sri Lanka (UTC+5:30). More than four years of experience building production web apps end to end: React.js and Next.js front ends, Node.js, Express.js and NestJS back ends, SQL and NoSQL databases, deployed on AWS and Azure. Delivered 10+ production and freelance projects across e-commerce, consulting and enterprise clients. Works in Agile/Scrum teams, does code reviews, and has a growing focus on AI-powered features. Started out in UI/UX design.` },
  { id: 'education', title: 'Education', text:
    'Bachelor of Software Engineering (Honours), The Open University of Sri Lanka, 2019-2025, completed. Higher National Diploma in Software Engineering, The Open University of Sri Lanka, 2019-2023, completed.' },
  { id: 'experience', title: 'Experience', text:
    MOVES.map((m) => `${m.role} at ${m.org} (${m.when}): ${m.note}`).join('\n') },
  { id: 'skills', title: 'Skills', text:
    SKILLS.map(([group, list]) => `${group}: ${list.join(', ')}`).join('\n') +
    '\nAI work: contributed AI-powered CV screening that compares resumes with job descriptions and gives match scores; built a natural-language document search dashboard with citation links (VivoAssist).' },
  { id: 'projects', title: 'Projects', text:
    PROJECTS.map((p) => `${p.name} (${p.kind}, ${p.ctx}): ${p.desc} Stack: ${p.stack.join(', ')}.${p.url ? ` Live: ${p.url}` : ' Private platform, no public link.'}`).join('\n') },
  { id: 'achievements', title: 'Achievements and interests', text:
    'Chess: All-Island 2nd runner-up, Provincial Champion, District Champion. Football: Provincial 1st runner-up, District Champion. Cricket: represented school and district level.' },
  { id: 'contact', title: 'Contact', text:
    `Email: ${PROFILE.email}. GitHub: ${PROFILE.github}. LinkedIn: ${PROFILE.linkedin}. Email is the fastest way to reach him.` },
  { id: 'site', title: 'This portfolio', text:
    'This portfolio is a 3D chess plaza built with Three.js and GSAP, bundled with Vite and deployed on Vercel. The chess pieces, sounds and Hirantha\'s avatar are all generated in code. The "Ask Hirantha" assistant runs on Claude through a Vercel serverless function, grounded in these facts, with an offline fallback.' },
];

export const knowledgeText = () => KNOWLEDGE.map((k) => `## ${k.title}\n${k.text}`).join('\n\n');
