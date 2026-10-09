// "Ask Hirantha" knowledge: answers written from the CV, each with example questions.
// A small embedding model (src/ai/) compares a visitor's question with these examples by
// meaning, so differently worded questions reach the right answer. Keep to public facts:
// private CV details (NIC, date of birth, phone, street address, referees) are left out on
// purpose, and questions about them get a polite redirect to email.
// After editing the examples, run `npm run embed` to refresh src/data/qa-vectors.json.
import { PROFILE, PROJECTS } from './content.js';

export const INTRO =
  "Hi, I'm Hirantha Rathnayaka, a full stack software engineer from Colombo, Sri Lanka. " +
  'I have more than four years of experience building production web apps, from React and Next.js front ends ' +
  'to Node.js, Express and NestJS back ends, deployed on AWS and Azure. ' +
  'I completed my Bachelor of Software Engineering with Honours at the Open University of Sri Lanka, ' +
  "and right now I'm a software engineer at Softvil Technologies. " +
  "Away from the keyboard I play chess: I was All-Island second runner-up. Ask me anything about my work.";

export const SUGGESTIONS = ['Where are you based?', 'What did you study?', 'What do you do now?', 'What is your tech stack?', 'Tell me about your projects', 'How can I contact you?'];

export const UNKNOWN = `I'm not sure about that one, and I'd rather not guess. Try asking about my experience, skills, projects, education or chess, or email me at ${PROFILE.email}.`;

// id: stable name; a: the answer; q: example questions (wordings people actually use);
// keys: keywords for the instant keyword matcher used while the model loads.
export const QA = [
  { id: 'greet', a: 'Hello! Nice to meet you. Ask me about my experience, skills, projects or education.',
    q: ['hi', 'hello', 'hey there', 'good morning', 'hello Hirantha', 'how are you'], keys: ['hello', 'hi', 'hey', 'ayubowan'] },
  { id: 'thanks', a: `You're welcome! If you'd like to work together, email me at ${PROFILE.email}.`,
    q: ['thank you', 'thanks a lot', 'great, thanks', 'that was helpful', 'cool, cheers'], keys: ['thank', 'thanks', 'cheers'] },
  { id: 'intro', a: INTRO,
    q: ['who are you', 'tell me about yourself', 'introduce yourself', 'what is your name', 'give me a summary of your profile', 'what kind of engineer are you'], keys: ['yourself', 'introduce', 'who are you'] },
  { id: 'location', a: "I'm based in Colombo, Sri Lanka, in the UTC plus five thirty time zone.",
    q: ['where are you based', 'where do you live', 'which country are you from', 'what city are you in', 'what is your time zone', 'where are you located', 'do you live in Sri Lanka', 'are you based in Colombo', 'which country do you work from', 'is Sri Lanka your home country'], keys: ['where', 'location', 'based', 'live', 'country', 'city', 'timezone', 'sri', 'lanka', 'colombo'] },
  { id: 'education', a: 'I completed a Bachelor of Software Engineering with Honours at the Open University of Sri Lanka, from 2019 to 2025. Before that I finished a Higher National Diploma in Software Engineering there, from 2019 to 2023.',
    q: ['what did you study', 'what is your degree', 'which university did you go to', 'what are your qualifications', 'do you have a computer science degree', 'tell me about your education', 'where did you graduate from', 'are you a software engineering graduate', 'do you have a university degree', 'what is your academic background'], keys: ['study', 'degree', 'education', 'university', 'qualification', 'graduate', 'bachelor', 'diploma'] },
  { id: 'current', a: "Since June 2025 I've been a software engineer at Softvil Technologies. I built VivoAssist, a document intelligence platform with AI search and citations, TuitionLanka, a trilingual tutoring marketplace, and core features of Exploreture, a recruitment platform with a hexagonal NestJS back end.",
    q: ['what do you do now', 'where do you work currently', 'what is your current job', 'which company are you working for', 'what are you working on at the moment', 'what is your role at Softvil', 'who is your employer', 'what company do you work for today', 'what is your present position'], keys: ['now', 'current', 'currently', 'softvil', 'job', 'company'] },
  { id: 'experience', a: "I have more than four years of experience. I started as a software engineer intern at Explorelogy in 2022, moved to associate UI UX engineer, then associate software engineer. After that I was a web developer at Stalione Group, a freelance developer for clients like Invos Global and K2 Consultants, and since 2025 I'm a software engineer at Softvil Technologies.",
    q: ['how many years of experience do you have', 'tell me about your work experience', 'what is your career history', 'where have you worked before', 'what was your career path', 'how long have you been a developer', 'what roles have you held', 'which companies have you worked for', 'list your previous positions', 'how long have you worked in software'], keys: ['experience', 'years', 'career', 'history', 'worked', 'previous'] },
  { id: 'explorelogy', a: 'At Explorelogy I went from intern to associate UI UX engineer to associate software engineer. I built sites for Softmatter by MAS Holdings, Watawala, Nareta, Kefi and Wyld Global with Gatsby, React, GraphQL and Tailwind, integrated the Shopify Storefront API and Firebase, and worked on Kirana, a serverless app on AWS.',
    q: ['what did you do at Explorelogy', 'tell me about your internship', 'what was your first job', 'what did you work on as an intern'], keys: ['explorelogy', 'intern', 'internship'] },
  { id: 'stalione', a: 'At Stalione Group I built client websites and web apps from design to launch with React, Laravel, PHP, AngularJS, Gatsby and WordPress, with SEO built into every build.',
    q: ['what did you do at Stalione', 'tell me about your web developer role', 'have you used Laravel or PHP'], keys: ['stalione', 'laravel', 'php'] },
  { id: 'freelance', a: 'As a freelancer I delivered more than ten projects for clients such as Invos Global, K2 Consultants, GoDigital, Codezela Technologies, Drill Team Westnahira and Urban Vogue, including a rental service, retail shops and a beauty business, and I handled requirements and client communication myself.',
    q: ['have you done freelance work', 'who were your clients', 'tell me about your freelancing', 'have you worked directly with clients'], keys: ['freelance', 'freelancer', 'clients'] },
  { id: 'skills', a: 'My main stack is JavaScript and TypeScript, React and Next.js on the front end, Node.js, Express and NestJS on the back end, with PostgreSQL, MySQL and MongoDB, deployed on AWS and Azure with Docker and CI CD pipelines. I also use Tailwind, Redux, GraphQL, PHP and WordPress.',
    q: ['what is your tech stack', 'what technologies do you use', 'what are your skills', 'which programming languages do you know', 'what frameworks are you good at', 'are you a full stack developer', 'do you code in TypeScript', 'how strong is your JavaScript', 'what is your main programming language'], keys: ['skill', 'skills', 'stack', 'tech', 'technologies', 'languages', 'framework', 'typescript', 'javascript'] },
  { id: 'frontend', a: 'On the front end I mostly use React and Next.js with TypeScript and Tailwind CSS, plus Redux and RTK Query for data. I started out in UI UX design, so I care about clean, usable interfaces.',
    q: ['do you know React', 'how good are you at frontend', 'have you used Next.js', 'what do you use for styling', 'do you know Tailwind'], keys: ['frontend', 'react', 'nextjs', 'tailwind', 'css'] },
  { id: 'backend', a: 'On the back end I build REST APIs with Node.js, Express and NestJS. For Exploreture I designed a hexagonal architecture with real-time messaging and JWT and OAuth authentication across user roles.',
    q: ['do you do backend development', 'have you used NestJS', 'how do you design APIs', 'do you know Node.js', 'what is hexagonal architecture experience', 'have you built servers with Node and Express', 'can you develop server side code', 'do you write RESTful services'], keys: ['backend', 'node', 'nestjs', 'express', 'api', 'apis'] },
  { id: 'databases', a: 'I work with PostgreSQL and MySQL for relational data and MongoDB for document data, and I have used Firebase and DynamoDB in serverless projects.',
    q: ['which databases do you use', 'do you know SQL', 'have you worked with MongoDB', 'SQL or NoSQL'], keys: ['database', 'databases', 'sql', 'postgres', 'postgresql', 'mysql', 'mongodb'] },
  { id: 'cloud', a: 'I deploy on AWS and Azure, use Docker, and set up CI CD pipelines. For example, TuitionLanka has a media pipeline on Azure Blob Storage, and Kirana ran on AWS AppSync, DynamoDB, Lambda and Cognito.',
    q: ['do you know AWS', 'have you used Azure', 'do you use Docker', 'how do you deploy applications', 'do you have DevOps experience', 'have you set up CI CD', 'have you used Docker containers', 'are you comfortable with cloud hosting', 'have you put apps in production on AWS'], keys: ['cloud', 'aws', 'azure', 'docker', 'devops', 'deploy', 'containers', 'kubernetes'] },
  { id: 'ai', a: "I've been adding AI features to products: natural language document search with citation links in VivoAssist, and CV screening that compares resumes with job descriptions and gives match scores. This chat also runs a small AI model right in your browser to understand your questions.",
    q: ['do you have AI experience', 'have you worked with machine learning', 'have you built AI features', 'do you use LLMs', 'how does this chatbot work', 'have you integrated large language models', 'have you used OpenAI or Claude style models', 'do you know about generative AI'], keys: ['ai', 'artificial', 'llm', 'chatbot'] },
  { id: 'seo', a: 'I do on-page SEO on most of my builds, which improved performance and search visibility for client sites.',
    q: ['do you know SEO', 'can you improve search rankings', 'have you done search engine optimization'], keys: ['seo'] },
  { id: 'design', a: 'I began my career in UI UX: wireframes, interactive prototypes and usability testing. That helps me work closely with designers and build interfaces that feel right.',
    q: ['do you do UI UX design', 'can you design interfaces', 'have you used Figma', 'do you make prototypes', 'do you have user experience skills', 'do you create wireframes and mockups', 'have you done usability testing'], keys: ['ux', 'design', 'designer', 'figma', 'prototype', 'wireframe', 'wireframes', 'wireframing'] },
  { id: 'team', a: 'I work in Agile and Scrum teams, do code reviews, and collaborate closely with designers, product managers and clients.',
    q: ['how do you work in a team', 'do you know Agile', 'have you worked in Scrum', 'do you do code reviews'], keys: ['team', 'agile', 'scrum', 'collaborate', 'review'] },
  { id: 'projects', a: 'Some of my projects are Exploreture, TuitionLanka, VivoAssist, Softmatter by MAS Holdings, Watawala Tea, NFT Auto Store, Kataka Live In Concert and NSD Consulting. Ask me about any of them, or try Play for them in the Projects section.',
    q: ['tell me about your projects', 'what have you built', 'show me your portfolio work', 'what are your best projects', 'which apps have you made', 'show me examples of your work', 'what have you delivered to production', 'what websites have you developed'], keys: ['project', 'projects', 'portfolio', 'built'] },
  { id: 'chess', a: 'I love chess: I was All-Island second runner-up, a provincial champion and a district champion. I also played football, finishing provincial first runner-up and district champion, and I played cricket at school and district level.',
    q: ['do you play chess', 'what are your hobbies', 'what do you do in your free time', 'do you play sports', 'what are your achievements outside work', 'what do you like to do for fun', 'what are your interests besides programming', 'any chess achievements'], keys: ['chess', 'hobby', 'hobbies', 'sport', 'sports', 'football', 'cricket'] },
  { id: 'contact', a: `The best way to reach me is email, at ${PROFILE.email}. You can also find me on GitHub as Hirantha12 and on LinkedIn.`,
    q: ['how can I contact you', 'what is your email', 'are you available for hire', 'can I see your LinkedIn', 'what is your GitHub', 'how do I get in touch'], keys: ['contact', 'email', 'reach', 'hire', 'linkedin', 'github'] },
  { id: 'site', a: 'I built this portfolio with Three.js for the 3D scene and GSAP for the animations, bundled with Vite and deployed on Vercel. Everything, even me, is made in code, and this chat uses a small AI model that runs in your browser.',
    q: ['how did you build this website', 'what is this portfolio made with', 'how was this 3D site made'], keys: ['website', 'threejs', 'gsap', 'vite'] },
  { id: 'private', a: `I keep personal details like that off the website. Please email me at ${PROFILE.email} and I'll be happy to share what you need.`,
    q: ['what is your phone number', 'can I have your mobile number', 'what is your home address', 'how old are you', 'when is your birthday', 'what is your NIC number', 'what are your salary expectations', 'can you give me references', 'what is your whatsapp'], keys: ['phone', 'mobile', 'whatsapp', 'address', 'nic', 'birthday', 'age', 'salary', 'reference', 'references'] },
  // one entry per project, written from the project data
  ...PROJECTS.map((p) => ({
    id: `project:${p.name}`,
    a: `${p.name} is a ${p.kind.toLowerCase()}. ${p.desc} It was built with ${p.stack.slice(0, 4).join(', ')}.`,
    q: [`tell me about ${p.name}`, `what is ${p.name}`, `what did you build for ${p.name}`, `tell me about your ${p.kind.toLowerCase()}`, `have you built a ${p.kind.toLowerCase()}`],
    keys: [p.name.toLowerCase().split(' ')[0]],
  })),
];

const norm = (s) => ` ${s.toLowerCase().replace(/[^a-z0-9+#\s]/g, ' ').replace(/\s+/g, ' ')} `;

// Keyword matcher: instant, no model. Used while the model downloads and as a backstop.
// Returns { item, score }, where score counts keyword hits.
export function keywordMatch(question) {
  const q = norm(question);
  let best = null, bestScore = 0;
  for (const it of QA) {
    let score = 0;
    for (const k of it.keys) if (q.includes(` ${k} `) || (k.includes(' ') && q.includes(k))) score += 1;
    if (it.id.startsWith('project:') && q.includes(norm(it.id.slice(8)).trim())) score += 3; // full project name
    if (score > bestScore) { best = it; bestScore = score; }
  }
  return { item: best, score: bestScore };
}
