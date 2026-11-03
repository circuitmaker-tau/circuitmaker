# CircuitMaker

Free interactive web app for visualizing digital circuits – TAU project 26-1-203.

אפליקציית ווב חינמית להדמיה ויזואלית של מעגלים ספרתיים: השהיות לכל שער, hazards, דיאגרמות זמנים ומודול ניתוח לימודי, לקורס "מבוא לחומרה" באוניברסיטת תל אביב.

**Live site:** https://circuitmaker-tau.github.io/circuitmaker/

## Run locally

Requires [Node.js](https://nodejs.org) LTS.

```bash
npm install      # once, after cloning
npm run dev      # dev server at http://localhost:5173/circuitmaker/
npm test         # unit tests (Vitest)
npm run lint     # ESLint
npm run build    # production build into dist/
```

## Project layout

```
src/
  engine/   simulation engine – pure TypeScript, no React (see docs/COMPONENT_SPEC.md)
  ui/       React components
  store/    app state (Zustand)
  i18n/     Hebrew / English strings
docs/       specs, test circuits, course notes, reference simulator
.github/    CI on every PR, deploy to GitHub Pages on every merge to main
```

`PROJECT_MASTER.md` is the source of truth for decisions and status.

## Workflow

`main` is protected. Every change goes through a branch and a pull request, which the other partner reviews and approves. CI must pass before merging.

## License

MIT
