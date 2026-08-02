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

## Trying it on a phone (manual walkthrough)

1. **Configure the API URL.** Copy `.env.example` to `.env`. If you're running the app in a web browser or an emulator/simulator on the same machine as the backend, `http://localhost:8080` works. **A physical phone cannot reach the laptop through `localhost`** — that address resolves to the phone itself, not your computer. Instead, set `EXPO_PUBLIC_API_BASE_URL` to your laptop's local-network IP (e.g. `http://192.168.1.23:8080`), found via `ipconfig` (Windows) or `ifconfig`/`ip addr` (macOS/Linux). The phone and laptop must be connected to the **same Wi-Fi network**.
2. **Start the backend** (`apps/api`) so it's reachable at that address — see the root `README.md`/`apps/api/README.md`. Confirm it's actually running before continuing.
3. **Start the mobile app**: `npx expo start` from `apps/mobile`.
4. **Scan the QR code** shown in the terminal/browser with the Expo Go app (iOS: Camera app or Expo Go; Android: Expo Go's own scanner).
5. **Sign in** with an existing DRIVER user's email and password. The driver account and their active route must already exist — created through the backend admin workflow (`/api/v1/admin/users`, `/api/v1/admin/routes`), not through this app. This app has no seed credentials of its own.
6. **Create a return**: tap **+ New Return**, fill in the form, and submit.
7. **Confirm it appears in My Returns**: after creating a return you're taken straight to its details; going back returns to My Returns, where the new return should already be listed (newest first).
8. **Open Return Details** on any return in the list to see its full read-only record.

## Local web testing (development only)

For quick UX iteration you can also run the app in a browser instead of Expo Go — useful for local testing, not a supported production target.

1. Run the backend on port 8080 **with the `local` Spring profile active** (see `apps/api`), and use `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080` in `.env` (both the browser and the API are on the same computer, so `localhost` works here — this is the one case in this README where it does).
2. Start the web build: `npx expo start --web -c` (the `-c` clears the Metro cache, useful after dependency changes).
3. The Expo development server runs on port **8081** (serves the frontend); the ReturnFlow API runs separately on port **8080**. Don't confuse the two — different ports means different browser origins, so a normal browser request between them requires CORS.

The `local` profile allows exactly the browser origin `http://localhost:8081` to call the API (see `auth.security.SecurityConfig`'s `app.cors.local-origin` property) — this is a narrow, explicit, local-development-only allowance, not a production CORS policy, and it is not active in any other profile. Native iOS/Android requests never go through a browser and never need CORS at all.

Expo SecureStore has no browser implementation, so the web build automatically uses `src/auth/tokenStorage.web.ts` (plain browser `localStorage`) instead of `src/auth/tokenStorage.ts` (Expo SecureStore) — this swap is automatic via React Native Web's platform-specific file resolution, no manual step needed. **`localStorage` is a development/testing fallback only, not equivalent security to native SecureStore** — native iOS/Android builds are unaffected and always use SecureStore.

## Scope

This phase (Phase 4) covers login, session restoration, viewing your own returns, creating a return, viewing return details, and logout — the non-media driver workflow. Photos and customer signatures are out of scope until Phase 5.
