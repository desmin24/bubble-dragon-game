import { DROP_SCORE, MATCH_SCORE } from "./constants";

export function getShotScore(matches: number, drops: number): number {
  return matches * MATCH_SCORE + drops * DROP_SCORE;
}
