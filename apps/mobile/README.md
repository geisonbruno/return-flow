# ReturnFlow Mobile

Driver app for ReturnFlow (Expo + React Native + TypeScript). See the root and `apps/mobile/CLAUDE.md` for product scope.

## Commands

```powershell
npm install
npx expo start   # start the Expo dev server
npm run lint       # eslint (eslint-config-expo)
npm run typecheck  # tsc --noEmit
npm run test        # jest (jest-expo preset)
```

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to point at the local API.

> Requires Node >=20.19.4 (or >=22.12) — the Expo CLI enforces this minimum for `expo start`/`expo lint`.
