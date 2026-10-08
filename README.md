# Hirantha's Gambit

A game-style 3D portfolio: press START, rain and thunder begin, giant chess pieces drop onto a neon plaza, and each piece flies the camera into a section. Projects sit on the first rank of a chessboard. Built with Three.js, GSAP and Vite.

## Run it

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173).

```bash
npm run build     # production build in /dist
npm run preview   # serve the build locally
```

## Where things live

| File | What it does |
| --- | --- |
| `src/data/content.js` | All text: profile, projects, experience, skills, scoresheet moves. Edit this first. |
| `index.html` | Page shell, SEO tags, and the plain-HTML **Quick view** for recruiters and search engines. Keep it in sync with `content.js`. |
| `src/main.js` | Renderer, bloom, camera flights, 360° orbit, clicking/hover, intro, render loop. |
| `src/scene/world.js` | Builds the plaza: lights, floor, city, café kiosk, giant pieces, board, scoresheet, rain. |
| `src/scene/pieces.js` | Procedural chess pieces (lathe + extruded knight). |
| `src/scene/canvas.js` | Canvas helpers for signs, labels and textures. |
| `src/ui/panel.js` | The side panel content for each section. |
| `src/audio/sound.js` | Rain, thunder, piece clacks and music, generated with Web Audio (no audio files). |
| `src/style.css` | HUD, dock, panel and quick view styles. |

## Common changes

- **Add project screenshots:** put images in `public/projects/` and add `image: '/projects/exploreture.jpg'` to that project in `content.js`.
- **Change a section's piece, colour or position:** edit `SECTIONS` in `content.js`.
- **Link preview image:** add `public/og.jpg` (1200×630) and set `og:url` in `index.html` once you have a domain.
- **Deep links:** `/#projects`, `/#experience`, `/#skills`, `/#about`, `/#contact` open that section after START.

## Controls

- Drag to orbit 360°, scroll to zoom, double-click to reset the view.
- Click a giant piece or the scoresheet to open a section. Esc goes back.
- In Projects, the arrow keys step through the eight projects.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, choose **Add New → Project**, import the repo. It detects Vite automatically (build `npm run build`, output `dist`).
3. Add your domain in the project settings.

## Next steps (from the research guide)

1. Model the kiosk and pieces in Blender, bake the lighting into textures, export GLB, and load with `GLTFLoader`. When you do, turn colour management back on (see the comment at the top of `src/main.js`).
2. Compress models with `npx @gltf-transform/cli optimize in.glb out.glb`.
3. Move the rain to the GPU (a shader on `InstancedMesh` or `Points`) for better phone performance.
4. Add an `OutputPass` after bloom once you switch to sRGB output and tone mapping.
