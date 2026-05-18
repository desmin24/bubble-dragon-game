export type BubbleColor = {
  id: string;
  fill: string;
  rim: string;
  shadow: string;
};

export type GridBubble = {
  id: string;
  row: number;
  col: number;
  colorId: string;
  x: number;
  y: number;
};

export type MovingBubble = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colorId: string;
};

export type AimState = {
  active: boolean;
  x: number;
  y: number;
};

export type ShotResult = {
  removed: GridBubble[];
  dropped: GridBubble[];
};

export type Cell = {
  row: number;
  col: number;
  x: number;
  y: number;
};
