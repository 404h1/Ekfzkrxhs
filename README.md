# Zero Trace

Zero Trace is an April Fools survival game built with Next.js 16, React 19, and a custom canvas game loop. It looks like a straight 60-second bullet-hell challenge at first, then slowly reveals 12 route-specific prank patterns, collectible endings, and a fake reward flow designed to land as a delayed joke instead of instant chaos.

## Highlights

- Single-screen canvas action with mouse and touch input
- 12 bespoke prank routes with different timing, UI betrayal, and collision twists
- Ending collection saved in `localStorage`
- Supabase-backed leaderboard and duplicate-name avoidance
- Mobile-aware layout with a fixed 16:9 playfield and touch coordinate remapping

## Technical Intent

This repository is a jam-style game project, not a component library. The main gameplay lives in one client page on purpose so the render loop, collision rules, route timing, overlays, and save flow stay easy to follow during rapid iteration.

## Design Choices

- The canvas game loop stays close to the route logic so timing-sensitive behavior is easier to reason about.
- The API layer stays intentionally small: leaderboard reads, score writes, and nickname lookup match the game's narrow backend needs.
- The project prefers resilient fallbacks over hard failure. Without Supabase env vars, the front-end still boots and remains playable as a standalone demo.
- Mobile behavior is treated as part of the core experience, not an afterthought, so touch coordinates and visible play bounds are explicitly handled in the game runtime.

Supporting docs are kept alongside the code:

- [`app/dodge/page.tsx`](./app/dodge/page.tsx): shipped game runtime
- [`dodge/README.md`](./dodge/README.md): route and ending reference
- [`dodge/INTERNAL_DESIGN.md`](./dodge/INTERNAL_DESIGN.md): internal design intent
- [`dodge/dodge_game.html`](./dodge/dodge_game.html): archived pre-Next prototype, not used by the current app runtime

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- CSS Modules
- Supabase JS client
- Playwright smoke tests

## Project Map

- `app/page.tsx`: redirects the root route to `/dodge`
- `app/dodge/page.tsx`: canvas renderer, game state, route logic, overlays, collection UI
- `app/api/scores/route.ts`: leaderboard read/write endpoint
- `app/api/scores/names/route.ts`: existing-name lookup for random nickname generation
- `lib/db.ts`: Supabase client bootstrap for server routes
- `tests/game.spec.ts`: smoke tests for the current shipped flow

## Running Locally

1. Install dependencies with `npm install`
2. Create env values for Supabase if you want leaderboard persistence
3. Start the app with `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000)

## Environment

Expected variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Minimal `scores` table shape:

```sql
create table scores (
  id bigint generated always as identity primary key,
  name text not null,
  survival_time numeric not null,
  route text not null,
  ending text not null,
  created_at timestamptz not null default now()
);
```

If env vars are missing, the app still boots with placeholder values so the front-end remains demoable even without backend setup.

## QA

- `npm run lint`
- `npm run test:e2e`

The automated checks are intentionally scoped as smoke tests because route selection is randomized and the game loop is canvas-heavy. The tests verify the shipped UI shell, modal flow, and basic start-of-run behavior rather than deterministic route completion.
