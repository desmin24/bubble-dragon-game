import { findFloatingBubbles, findMatchingCluster } from "./grid";
import { getShotScore } from "./scoring";
import type { GridBubble } from "./types";

export type ShotResolution = {
  grid: GridBubble[];
  matched: GridBubble[];
  dropped: GridBubble[];
  scoreDelta: number;
};

export function resolveSettledShot(grid: GridBubble[], settled: GridBubble): ShotResolution {
  const gridWithSettledBubble = [...grid, settled];
  const rawMatched = findMatchingCluster(settled, gridWithSettledBubble);
  const matched = rawMatched.filter((bubble) => bubble.colorId === settled.colorId);

  if (process.env.NODE_ENV !== "production" && rawMatched.length !== matched.length) {
    console.warn("Bubble Dragon: non-matching bubbles were found in the color cluster and ignored.", {
      settledColorId: settled.colorId,
      rawMatched,
      matched,
    });
  }

  if (matched.length < 3) {
    return {
      grid: gridWithSettledBubble,
      matched: [],
      dropped: [],
      scoreDelta: 0,
    };
  }

  const matchedIds = new Set(matched.map((bubble) => bubble.id));
  const gridAfterColorMatch = gridWithSettledBubble.filter((bubble) => !matchedIds.has(bubble.id));
  const dropped = findFloatingBubbles(gridAfterColorMatch);
  const droppedIds = new Set(dropped.map((bubble) => bubble.id));

  // Color matching and floating drops are separate rules. Dropped bubbles may be
  // any color, but only after the same-color cluster has already been removed.
  const resolvedGrid = gridAfterColorMatch.filter((bubble) => !droppedIds.has(bubble.id));

  return {
    grid: resolvedGrid,
    matched,
    dropped,
    scoreDelta: getShotScore(matched.length, dropped.length),
  };
}
