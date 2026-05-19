import {
  BUBBLE_RADIUS,
  CANVAS_WIDTH,
  HIT_DISTANCE,
  LAUNCHER_X,
  LAUNCHER_Y,
  MIN_SHOT_ANGLE,
  SHOT_SPEED,
} from "./constants";
import type { GridBubble, MovingBubble } from "./types";

type LaunchOrigin = {
  x: number;
  y: number;
};

const DEFAULT_LAUNCH_ORIGIN: LaunchOrigin = { x: LAUNCHER_X, y: LAUNCHER_Y };

export function createShot(
  targetX: number,
  targetY: number,
  colorId: string,
  origin: LaunchOrigin = DEFAULT_LAUNCH_ORIGIN,
): MovingBubble {
  const dx = targetX - origin.x;
  const dy = targetY - origin.y;
  const angle = clampShotAngle(Math.atan2(dy, dx));

  return {
    x: origin.x,
    y: origin.y,
    vx: Math.cos(angle) * SHOT_SPEED,
    vy: Math.sin(angle) * SHOT_SPEED,
    colorId,
  };
}

export function updateMovingBubble(bubble: MovingBubble, deltaSeconds: number): MovingBubble {
  let x = bubble.x + bubble.vx * deltaSeconds;
  let y = bubble.y + bubble.vy * deltaSeconds;
  let vx = bubble.vx;

  if (x <= BUBBLE_RADIUS) {
    x = BUBBLE_RADIUS;
    vx = Math.abs(vx);
  }

  if (x >= CANVAS_WIDTH - BUBBLE_RADIUS) {
    x = CANVAS_WIDTH - BUBBLE_RADIUS;
    vx = -Math.abs(vx);
  }

  return { ...bubble, x, y, vx };
}

export function hasHitBubble(moving: MovingBubble, bubbles: GridBubble[]): boolean {
  return bubbles.some((bubble) => Math.hypot(bubble.x - moving.x, bubble.y - moving.y) <= HIT_DISTANCE);
}

export function getAimTarget(
  pointerX: number,
  pointerY: number,
  origin: LaunchOrigin = DEFAULT_LAUNCH_ORIGIN,
): { x: number; y: number } {
  const dy = Math.min(pointerY - origin.y, -20);
  const dx = pointerX - origin.x;
  const angle = clampShotAngle(Math.atan2(dy, dx));
  const distance = Math.max(80, Math.hypot(dx, dy));

  return {
    x: origin.x + Math.cos(angle) * distance,
    y: origin.y + Math.sin(angle) * distance,
  };
}

export function buildAimPath(
  targetX: number,
  targetY: number,
  origin: LaunchOrigin = DEFAULT_LAUNCH_ORIGIN,
): Array<{ x: number; y: number }> {
  const shot = createShot(targetX, targetY, "preview", origin);
  const points = [{ x: origin.x, y: origin.y }];
  let x = shot.x;
  let y = shot.y;
  let vx = shot.vx;
  const step = 1 / 24;

  for (let i = 0; i < 28; i += 1) {
    x += vx * step;
    y += shot.vy * step;

    if (x <= BUBBLE_RADIUS) {
      x = BUBBLE_RADIUS;
      vx = Math.abs(vx);
      points.push({ x, y });
    } else if (x >= CANVAS_WIDTH - BUBBLE_RADIUS) {
      x = CANVAS_WIDTH - BUBBLE_RADIUS;
      vx = -Math.abs(vx);
      points.push({ x, y });
    }

    if (y <= BUBBLE_RADIUS) {
      points.push({ x, y: BUBBLE_RADIUS });
      break;
    }
  }

  points.push({ x, y });
  return points;
}

function clampShotAngle(angle: number): number {
  const min = (-180 + MIN_SHOT_ANGLE) * (Math.PI / 180);
  const max = -MIN_SHOT_ANGLE * (Math.PI / 180);

  if (angle > max) {
    return max;
  }

  if (angle < min) {
    return min;
  }

  return angle;
}
