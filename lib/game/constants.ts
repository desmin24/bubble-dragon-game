import type { BubbleColor } from "./types";

export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 610;
export const BUBBLE_RADIUS = 15;
export const GRID_COLS = 11;
export const MAX_GRID_ROWS = 18;
export const INITIAL_ROWS = 7;
export const GRID_TOP = 38;
export const LAUNCHER_X = CANVAS_WIDTH / 2 + 34;
export const LAUNCHER_Y = CANVAS_HEIGHT - 97;
export const SHOT_SPEED = 680;
export const MIN_SHOT_ANGLE = 12;
export const DANGER_LINE_Y = CANVAS_HEIGHT - 118;
export const MATCH_SCORE = 40;
export const DROP_SCORE = 70;
export const HIT_DISTANCE = BUBBLE_RADIUS * 1.82;
export const STORAGE_BEST_SCORE_KEY = "bubble-dragon-best-score";

export const BUBBLE_COLORS: BubbleColor[] = [
  { id: "sun", fill: "#ffd166", rim: "#fff0a7", shadow: "#b77600" },
  { id: "rose", fill: "#ff6b9a", rim: "#ffc1d8", shadow: "#a91d55" },
  { id: "aqua", fill: "#4dd9ff", rim: "#c8f6ff", shadow: "#05759a" },
  { id: "leaf", fill: "#63e38d", rim: "#cfffdc", shadow: "#168046" },
  { id: "violet", fill: "#a78bfa", rim: "#dfd6ff", shadow: "#5530b7" },
  { id: "tangerine", fill: "#ff9f1c", rim: "#ffe0a3", shadow: "#9a4f00" },
];

export const COLOR_BY_ID = BUBBLE_COLORS.reduce<Record<string, BubbleColor>>(
  (colors, color) => {
    colors[color.id] = color;
    return colors;
  },
  {},
);
