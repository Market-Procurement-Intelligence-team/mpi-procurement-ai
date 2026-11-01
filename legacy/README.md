# Old MPI app (reference only)

This folder keeps the old app as it was before the rebuild (moved here on 31 Oct 2026). Nothing in it is built, type-checked or deployed.

- `src/`: the old screens, components, context, hooks, video, data, services and helpers, and the old entry point (`App.tsx`, `main.tsx`, `index.css`)
- `netlify/functions/gemini.ts`: the old open AI proxy, which is no longer deployed
- `supabase/migrations/20261009…`, `20261010…`: old database files. **Never run these.**

The new app lives in `src/`. Delete this folder at the end of the project.
