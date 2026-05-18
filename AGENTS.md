# AGENTS.md

## Project Context

This project is a mobile-first Bubble Shooter game named Bubble Dragon. It is built with Next.js App Router, TypeScript, React functional components, and an HTML Canvas-based game screen.

## Priorities

- Keep the game playable.
- Keep `npm run build` passing.
- Preserve the current core game loop: aiming, shooting, wall bounce, grid snapping, matching, floating-bubble drops, scoring, game over, restart, and best score in `localStorage`.
- Prefer small, well-scoped changes to game logic so regressions are easy to reason about.

## Architecture Notes

- Main route: `app/page.tsx`
- Canvas/game component: `components/GameCanvas.tsx`
- HUD: `components/GameHUD.tsx`
- Game over UI: `components/GameOverlay.tsx`
- Game constants/types/logic live in `lib/game/`

## Future Expansion Ideas

- Sound effects and music
- Level progression
- Dragon character skins
- Leaderboard
- Special bubbles and power-ups
