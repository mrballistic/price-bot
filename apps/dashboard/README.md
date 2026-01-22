
# Dashboard (optional)

A minimal Next.js dashboard that reads `../../data/history.json` and `../../data/state.json`.

## Run locally
```bash
cd apps/dashboard
npm install
npm run dev
```

Then open http://localhost:3000

## Deploy
Easiest: deploy `apps/dashboard` to Vercel as a separate project.
Ensure the deployed build has access to the `data/` directory (monorepo checkout).
