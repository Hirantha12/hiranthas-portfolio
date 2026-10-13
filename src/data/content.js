// All portfolio content lives here. Edit this file to update the site.

export const PROFILE = {
  name: 'Hirantha Rathnayaka',
  role: 'Full Stack Software Engineer',
  location: 'Colombo, Sri Lanka · UTC+5:30',
  email: 'hiranthaviraj@gmail.com',
  github: 'https://github.com/Hirantha12',
  linkedin: 'https://www.linkedin.com/in/hirantha-rathnayaka',
  // Your photo: put a square image (800×800 or larger) at public/hirantha.jpg. Until it's there,
  // the About panel shows your initials instead.
  photo: '/hirantha.jpg',
  // Your CV: public/Hirantha_Rathnayaka_CV.pdf (replace the file to update it; keep the name).
  cv: '/Hirantha_Rathnayaka_CV.pdf',
  now: 'Software Engineer at Softvil Technologies',
};

export const GLYPH = { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' };
export const PIECE_NAME = { king: 'King', queen: 'Queen', rook: 'Rook', bishop: 'Bishop', knight: 'Knight', pawn: 'Pawn' };

// Giant pieces on the plaza. Each one opens a section.
export const SECTIONS = {
  projects:   { piece: 'queen',  color: '#ff3d9a', label: 'PROJECTS',   sq: 'd1', title: 'Projects',   pos: [-5.6, 0, 1.2],  scale: 3.1, ivory: false, rot: 0.3 },
  experience: { piece: 'rook',   color: '#ffb547', label: 'EXPERIENCE', sq: 'a1', title: 'Experience', pos: [-9.8, 0, -3.4], scale: 3.0, ivory: true },
  about:      { piece: 'king',   color: '#3ef2ff', label: 'ABOUT ME',   sq: 'e1', title: 'Hirantha Rathnayaka', pos: [0, 0, -9.6], scale: 5.6, ivory: true },
  skills:     { piece: 'bishop', color: '#a77bff', label: 'SKILLS',     sq: 'c1', title: 'Skills',     pos: [9.8, 0, -3.4],  scale: 3.1, ivory: false },
  contact:    { piece: 'knight', color: '#57ffb0', label: 'CONTACT',    sq: 'g1', title: 'Your move',  pos: [5.6, 0, 1.2],   scale: 2.9, ivory: true, rot: -Math.PI / 2 - 0.5 },
};

// Nine projects: eight on the first rank (a1–h1), and this portfolio itself as the e2 pawn,
// the first piece that moves in most chess games.
// Optional detail fields, shown when filled in: role (your part), highlights (key features),
// result (an outcome or number, e.g. '500+ tutors registered in the first month'),
// image (a screenshot in /public/projects/, used for private projects and while a site loads),
// liveNote (a line under the live preview).
// To show a screenshot, put the image in /public/projects/ and set `image: '/projects/name.jpg'`.
export const PROJECTS = [
  { sq: 'a1', piece: 'rook', name: 'Exploreture', kind: 'Recruitment platform', ctx: 'Softvil Technologies · 2025', color: '#ff3d9a',
    desc: 'A recruitment platform with separate portals for job seekers, employers and admins. I designed the backend with hexagonal architecture, added real-time messaging, and built JWT/OAuth authentication across every user role.',
    stack: ['NestJS', 'MongoDB', 'Next.js', 'Hexagonal architecture', 'JWT / OAuth', 'Real-time messaging'], url: 'https://exploretureweb.vercel.app/',
    role: 'Built core features across the three portals and designed the backend.',
    highlights: ['Separate portals for job seekers, employers and admins', 'NestJS backend designed with hexagonal architecture', 'Real-time messaging', 'JWT / OAuth authentication across user roles'],
    result: '' },
  { sq: 'b1', piece: 'knight', name: 'TuitionLanka', kind: 'Tutoring marketplace', ctx: 'Softvil Technologies · 2025', color: '#3ef2ff',
    desc: 'A trilingual tutor-matching marketplace for Sri Lanka. I built the public site and the admin dashboard, architected the data layer with RTK Query, and set up a media pipeline on Azure Blob Storage.',
    stack: ['Next.js', 'RTK Query', 'Azure Blob Storage', '3 languages', 'Admin dashboard'], url: 'https://www.tuitionlanka.com/en',
    role: 'Built the public site and the admin dashboard.',
    highlights: ['Tutor matching in English, Sinhala and Tamil', 'Data layer architected with RTK Query', 'Media pipeline on Azure Blob Storage'],
    result: '' },
  { sq: 'c1', piece: 'bishop', name: 'VivoAssist', kind: 'Document intelligence SaaS', ctx: 'Softvil Technologies · 2025', color: '#a77bff',
    desc: 'A SaaS document-intelligence platform. I built its AI-powered query dashboard, where people search their documents in natural language and get answers with citation links, plus the authentication flow and the admin console.',
    stack: ['Next.js', 'TypeScript', 'AI search', 'Citations', 'Auth', 'Admin console'], url: null,
    role: 'Built the AI-powered query dashboard, the authentication flow and the admin console.',
    highlights: ['Natural-language search across documents', 'Answers with citation links back to the source', 'Built with Next.js and TypeScript'],
    result: '' },
  { sq: 'd1', piece: 'queen', name: 'Softmatter by MAS', kind: 'Corporate site + headless commerce', ctx: 'Explorelogy · 2023', color: '#ffb547',
    desc: 'Corporate website for a global smart-textiles manufacturer, part of MAS Holdings, with a headless Shopify store wired in through the Storefront API.',
    stack: ['Gatsby', 'React', 'Shopify Storefront API', 'GraphQL'], url: 'https://softmatter.io/',
    role: 'Developed and deployed the site at Explorelogy.',
    highlights: ['Headless Shopify commerce through the Storefront API', 'Built with Gatsby, React, GraphQL and Tailwind CSS'],
    // softmatter.io now appears to run on WordPress, so the live site may no longer be the Gatsby build.
    liveNote: 'This is the live site today. It may have changed since my 2023 work on it.',
    result: '' },
  { sq: 'e1', piece: 'king', name: 'Watawala Tea', kind: 'Brand marketing site', ctx: 'Explorelogy · 2023', color: '#57ffb0',
    desc: 'Trilingual marketing site for a Sri Lankan tea brand, with Firebase-backed enquiry forms and on-page SEO work.',
    stack: ['Gatsby', 'React', 'Firebase', 'On-page SEO', '3 languages'], url: 'https://watawalatea.lk/',
    role: 'Developed and deployed the site at Explorelogy.',
    highlights: ['Trilingual marketing site', 'Enquiry forms backed by Firebase (Firestore, Storage, Cloud Functions)', 'On-page SEO'],
    result: '' },
  { sq: 'f1', piece: 'bishop', name: 'NFT Auto Store', kind: 'E-commerce platform', ctx: 'Web build', color: '#ff3d9a',
    desc: 'An e-commerce platform for trading NFTs, combining storefront development with NFT domain knowledge.',
    stack: ['E-commerce', 'NFT trading', 'Web development'], url: 'https://www.nftautostore.io/',
    result: '' },
  { sq: 'g1', piece: 'knight', name: 'Kataka Live In Concert', kind: 'Event website', ctx: 'Freelance · Drill Team Westnahira', color: '#3ef2ff',
    desc: 'Event site for a live concert that presents the show details, built so ticketing can be added later.',
    stack: ['Next.js', 'React', 'Event pages'], url: 'https://katakaliveinconcert.com/',
    role: 'Built the site as a freelance project for Drill Team Westnahira.',
    highlights: ['Event details for the concert', 'Built with Next.js and React', 'Structured so ticketing can be added later'],
    result: '' },
  { sq: 'h1', piece: 'rook', name: 'NSD Consulting', kind: 'Consulting firm website', ctx: 'Client project · UAE', color: '#ffb547',
    desc: 'A custom WordPress site with React components for a UAE-based consulting firm, including analytics integration.',
    stack: ['WordPress', 'React', 'Analytics'], url: 'https://nsdconsultingservices.com/',
    highlights: ['Custom WordPress site with React components', 'Analytics integration'],
    result: '' },
  { sq: 'e2', piece: 'pawn', name: "Hirantha's Gambit", kind: '3D portfolio website', ctx: 'Personal project · 2026', color: '#a77bff',
    desc: 'This portfolio: a rainy neon chess plaza where visitors explore my work, play a chess game that unlocks a project with every move, and ask an AI version of me about my career.',
    stack: ['Three.js', 'GSAP', 'Vite', 'Web Audio API', 'Transformers.js', 'Claude API', 'Vercel'], url: 'https://hiranthas-portfolio.vercel.app/',
    liveNote: 'The live site inside itself. It waits on its START screen: press START in the box to load the 3D board, or try Quick view.',
    role: 'Designed and built the whole site: 3D scene, animation, sound, the chess game and the AI assistant.',
    highlights: ['3D scene, chess pieces and avatar all generated in code, with no 3D model files', 'Playable chess game: 14 opening traps, each checked with chess.js', '"Ask Hirantha" assistant: in-browser semantic search, with an optional Claude API layer', 'Live, scrollable previews of my project sites', 'Rain, thunder and music generated with the Web Audio API'],
    result: '' },
];

// "Play for them" openings live in src/data/games.js (generated by `npm run games`).
// The game has one move per project, so keep PROJECTS at 9 or add/remove a move in every opening.

// Career as a chess scoresheet.
export const MOVES = [
  { n: 1, phase: 'Opening', when: 'Feb 2022 – Aug 2022', role: 'Software Engineer Intern', org: 'Explorelogy, Colombo', ann: '!',
    note: 'Wireframes, interactive prototypes and usability testing, plus early front-end work with senior engineers. Promoted after six months.' },
  { n: 2, phase: 'Opening', when: 'Sep 2022 – Feb 2023', role: 'Associate UI/UX Engineer', org: 'Explorelogy, Colombo',
    note: 'Designed user-centred interfaces and turned wireframes into working UI components with the dev team. Ran user tests and design reviews that made client projects more consistent.' },
  { n: 3, phase: 'Middlegame', when: 'Mar 2023 – Nov 2023', role: 'Associate Software Engineer', org: 'Explorelogy, Colombo',
    note: 'Shipped Gatsby, React, GraphQL and Tailwind sites for Softmatter (MAS Holdings), Watawala Plantations, Nareta, Kefi and Wyld Global. Integrated the Shopify Storefront API and Firebase, and worked on Kirana, a serverless app on AWS AppSync, DynamoDB, Lambda and Cognito.' },
  { n: 4, phase: 'Middlegame', when: 'Nov 2023 – Aug 2024', role: 'Web Developer', org: 'Stalione Group (Pvt) Ltd',
    note: 'Built client sites and web apps from design to launch with React, Laravel, PHP, AngularJS, Gatsby and WordPress, with SEO built into every build.' },
  { n: 5, phase: 'Middlegame', when: 'Aug 2024 – Jun 2025', role: 'Freelance Software Developer', org: 'Web development & SEO',
    note: 'Delivered 10+ projects for clients including Invos Global, K2 Consultants, GoDigital, Codezela Technologies, Drill Team Westnahira and Urban Vogue, and handled requirements and client communication directly.' },
  { n: 6, phase: 'Current position', when: 'Jun 2025 – Present', role: 'Software Engineer', org: 'Softvil Technologies', now: true,
    note: 'Building VivoAssist (AI document search with citations), TuitionLanka (trilingual tutoring marketplace on Azure) and Exploreture (recruitment platform with a hexagonal NestJS backend, real-time messaging and JWT/OAuth).' },
];

export const SKILLS = [
  ['Languages & frameworks', ['JavaScript', 'TypeScript', 'PHP', 'React.js', 'Next.js', 'Node.js', 'Express.js', 'NestJS', 'Gatsby.js', 'AngularJS'], true],
  ['Styling & UI', ['Tailwind CSS', 'Bootstrap', 'CSS3', 'HTML5']],
  ['Databases', ['PostgreSQL', 'MySQL', 'MongoDB', 'Firebase', 'DynamoDB']],
  ['Cloud & DevOps', ['AWS', 'Azure', 'Docker', 'CI/CD pipelines']],
  ['Tools', ['Git / GitHub', 'Jira', 'Redux / RTK Query', 'GraphQL', 'WordPress', 'Shopify Storefront API']],
  ['Practices', ['Agile / Scrum', 'RESTful API design', 'Hexagonal architecture', 'On-page SEO', 'UI/UX prototyping', 'Code reviews']],
];

// The scoresheet clipboard on the plaza: your stack written as moves.
export const SCORESHEET_MOVES = [
  ['React.js', 'Next.js'], ['Node.js', 'NestJS'], ['TypeScript', 'PostgreSQL'], ['MongoDB', 'AWS'],
  ['Azure', 'Docker'], ['Tailwind CSS', 'GraphQL'], ['UI/UX', 'On-page SEO'], ['AI search', 'Ship it !!'],
];

// Code typed on the kiosk screen and the laptop.
export const CODE_LINES = [
  '// hirantha.ts — full stack, one move at a time',
  "import { NextJS, NestJS, Postgres } from 'stack';",
  '',
  'export async function nextMove(board: Board) {',
  '  const plan = await think(board, { depth: 4 });',
  '  const api  = NestJS.build(plan.backend);',
  '  const ui   = NextJS.render(plan.frontend);',
  "  return ship({ api, ui, cloud: 'aws' }); // ✓",
  '}',
];
