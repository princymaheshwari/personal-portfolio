# Personal portfolio

**Live site:** [princymaheshwari.me](https://princymaheshwari.me)

The portfolio is a 3D detective's evidence board (Three.js): one corkboard wall in a pine-green office, where scrolling moves the camera through the case file — SUBJECT PROFILE → THE TRAIL (experiences pinned chronologically, earliest at the bottom, red threads labeled with the skill each one passed forward) → EVIDENCE LOCKER (project exhibits) → M.O. (stack) → TIP LINE (Formspree contact form). Clicking any pinned card zooms in and opens its typed dossier memo.

All content lives in `data.js` — card positions, copy, threads, and links. The 3D scene is `board.js`, DOM glue is `main.js`. Mobile, `prefers-reduced-motion`, no-WebGL browsers, and `?flat=1` get an accessible 2D "flat file" version of the same content. No build step; Three.js r128 from CDN.

## Local preview

```bash
npm install
npm run dev
```

Opens `index.html` on port 3000.
