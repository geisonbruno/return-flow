# ReturnFlow Web

Admin console for ReturnFlow (React + TypeScript + Vite). See the root and `apps/web/CLAUDE.md` for product scope.

## Commands

```powershell
npm install
npm run dev        # start dev server
npm run lint        # oxlint
npm run typecheck   # tsc project references
npm run test         # vitest
npm run build        # typecheck + production build
```

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to point at the local API.
