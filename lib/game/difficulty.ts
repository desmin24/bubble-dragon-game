import { BUBBLE_COLORS } from "./constants";

export type DifficultyTier = {
  id: "warm-up" | "more-colors" | "pressure-rising" | "dragon-master";
  stage: number;
  name: string;
  noticeTitle: string;
  noticeDetail: string;
  minShots: number;
  minScore: number;
  colorCount: number;
  pressureEveryMisses: number | null;
};

export const PRESSURE_ADVANCE_ROWS = 2;

export const DIFFICULTY_TIERS: DifficultyTier[] = [
  {
    id: "warm-up",
    stage: 1,
    name: "Warm Up",
    noticeTitle: "Warm Up",
    noticeDetail: "4 colors to start",
    minShots: 0,
    minScore: 0,
    colorCount: 4,
    pressureEveryMisses: null,
  },
  {
    id: "more-colors",
    stage: 2,
    name: "More Colors",
    noticeTitle: "More Colors!",
    noticeDetail: "5 colors unlocked",
    minShots: 8,
    minScore: 500,
    colorCount: 5,
    pressureEveryMisses: null,
  },
  {
    id: "pressure-rising",
    stage: 3,
    name: "Pressure Rising",
    noticeTitle: "Pressure Rising",
    noticeDetail: "Rows advance after 4 misses",
    minShots: 14,
    minScore: 1200,
    colorCount: 6,
    pressureEveryMisses: 4,
  },
  {
    id: "dragon-master",
    stage: 4,
    name: "Dragon Master",
    noticeTitle: "Dragon Master",
    noticeDetail: "Rows advance after 3 misses",
    minShots: 28,
    minScore: 2600,
    colorCount: 6,
    pressureEveryMisses: 3,
  },
];

export function getDifficultyTier(score: number, shotsFired: number): DifficultyTier {
  return DIFFICULTY_TIERS.reduce((activeTier, tier) => {
    const unlockedByShots = shotsFired >= tier.minShots;
    const unlockedByScore = score >= tier.minScore;

    return unlockedByShots || unlockedByScore ? tier : activeTier;
  }, DIFFICULTY_TIERS[0]);
}

export function getColorIdsForTier(tier: DifficultyTier): string[] {
  return BUBBLE_COLORS.slice(0, tier.colorCount).map((color) => color.id);
}

export function getTierHudDetail(tier: DifficultyTier): string {
  if (tier.pressureEveryMisses === null) {
    return `${tier.colorCount} colors`;
  }

  return `${tier.colorCount} colors · ${tier.pressureEveryMisses} misses`;
}
