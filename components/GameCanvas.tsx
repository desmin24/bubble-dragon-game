"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameHUD } from "./GameHUD";
import { GameOverlay } from "./GameOverlay";
import {
  BUBBLE_COLORS,
  BUBBLE_RADIUS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLOR_BY_ID,
  DANGER_LINE_Y,
  GRID_TOP,
  LAUNCHER_X,
  LAUNCHER_Y,
  STORAGE_BEST_SCORE_KEY,
} from "@/lib/game/constants";
import { addBubbleToGrid, createInitialGrid } from "@/lib/game/grid";
import { buildAimPath, createShot, getAimTarget, hasHitBubble, updateMovingBubble } from "@/lib/game/physics";
import { resolveSettledShot } from "@/lib/game/rules";
import type { AimState, GridBubble, MovingBubble } from "@/lib/game/types";

type GameState = {
  grid: GridBubble[];
  moving: MovingBubble | null;
  currentColorId: string;
  nextColorId: string;
  aim: AimState;
  score: number;
  gameOver: boolean;
};

const emptyAim: AimState = { active: false, x: LAUNCHER_X, y: LAUNCHER_Y - 140 };

function randomColorId(): string {
  return BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)].id;
}

function createNewGame(): GameState {
  return {
    grid: createInitialGrid(),
    moving: null,
    currentColorId: randomColorId(),
    nextColorId: randomColorId(),
    aim: emptyAim,
    score: 0,
    gameOver: false,
  };
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createNewGame());
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [nextColorId, setNextColorId] = useState(stateRef.current.nextColorId);
  const [gameOver, setGameOver] = useState(false);

  const syncReactState = useCallback(() => {
    const state = stateRef.current;
    setScore(state.score);
    setNextColorId(state.nextColorId);
    setGameOver(state.gameOver);
    setBestScore((currentBest) => {
      const nextBest = Math.max(currentBest, state.score);

      if (nextBest !== currentBest) {
        localStorage.setItem(STORAGE_BEST_SCORE_KEY, String(nextBest));
      }

      return nextBest;
    });
  }, []);

  const restart = useCallback(() => {
    stateRef.current = createNewGame();
    syncReactState();
  }, [syncReactState]);

  useEffect(() => {
    const storedBest = Number(localStorage.getItem(STORAGE_BEST_SCORE_KEY) ?? "0");

    if (Number.isFinite(storedBest)) {
      setBestScore(storedBest);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const render = (timestamp: number) => {
      const previousTimestamp = lastFrameRef.current || timestamp;
      const deltaSeconds = Math.min((timestamp - previousTimestamp) / 1000, 0.033);
      lastFrameRef.current = timestamp;

      tick(deltaSeconds);
      drawGame(context, stateRef.current);

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [syncReactState]);

  const tick = (deltaSeconds: number) => {
    const state = stateRef.current;

    if (state.gameOver || !state.moving) {
      return;
    }

    const moving = updateMovingBubble(state.moving, deltaSeconds);
    state.moving = moving;

    if (moving.y <= GRID_TOP + BUBBLE_RADIUS || hasHitBubble(moving, state.grid)) {
      settleMovingBubble(moving);
    }
  };

  const settleMovingBubble = (moving: MovingBubble) => {
    const state = stateRef.current;
    const settled = addBubbleToGrid(moving.x, moving.y, moving.colorId, state.grid);
    const resolution = resolveSettledShot(state.grid, settled);
    const nextGrid = resolution.grid;

    state.score += resolution.scoreDelta;

    state.grid = nextGrid;
    state.moving = null;
    state.currentColorId = state.nextColorId;
    state.nextColorId = randomColorId();
    state.gameOver = nextGrid.some((bubble) => bubble.y + BUBBLE_RADIUS >= DANGER_LINE_Y);
    syncReactState();
  };

  const getPointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: LAUNCHER_X, y: LAUNCHER_Y - 100 };
    }

    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;

    if (state.gameOver || state.moving) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const pointer = getPointerPosition(event);
    const target = getAimTarget(pointer.x, pointer.y);
    state.aim = { active: true, x: target.x, y: target.y };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;

    if (!state.aim.active || state.gameOver || state.moving) {
      return;
    }

    const pointer = getPointerPosition(event);
    const target = getAimTarget(pointer.x, pointer.y);
    state.aim = { active: true, x: target.x, y: target.y };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = stateRef.current;

    if (!state.aim.active || state.gameOver || state.moving) {
      return;
    }

    const pointer = getPointerPosition(event);
    const target = getAimTarget(pointer.x, pointer.y);
    state.moving = createShot(target.x, target.y, state.currentColorId);
    state.aim = emptyAim;
  };

  return (
    <section className="game-frame" aria-label="Bubble Dragon game">
      <GameHUD score={score} bestScore={bestScore} nextColorId={nextColorId} />
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          aria-label="Bubble Dragon play field"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            stateRef.current.aim = emptyAim;
          }}
        />
      </div>
      <footer className="game-footer">
        <button className="restart-button" type="button" onClick={restart}>
          Restart
        </button>
        <p className="hint-text">拖曳瞄準，放開發射</p>
      </footer>
      {gameOver ? <GameOverlay score={score} onRestart={restart} /> : null}
    </section>
  );
}

function drawGame(context: CanvasRenderingContext2D, state: GameState) {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackground(context);
  drawDangerLine(context);
  drawAim(context, state);

  for (const bubble of state.grid) {
    drawBubble(context, bubble.x, bubble.y, bubble.colorId);
  }

  if (state.moving) {
    drawBubble(context, state.moving.x, state.moving.y, state.moving.colorId);
  }

  drawLauncher(context, state.currentColorId);
}

function drawBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#14245e");
  gradient.addColorStop(0.55, "#10194b");
  gradient.addColorStop(1, "#090d2b");
  context.fillStyle = gradient;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.save();
  context.globalAlpha = 0.2;
  for (let i = 0; i < 42; i += 1) {
    const x = (i * 83) % CANVAS_WIDTH;
    const y = (i * 137) % CANVAS_HEIGHT;
    context.beginPath();
    context.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2);
    context.fillStyle = i % 2 === 0 ? "#ffffff" : "#54e2ff";
    context.fill();
  }
  context.restore();
}

function drawDangerLine(context: CanvasRenderingContext2D) {
  context.save();
  context.setLineDash([8, 8]);
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255, 107, 154, 0.72)";
  context.beginPath();
  context.moveTo(18, DANGER_LINE_Y);
  context.lineTo(CANVAS_WIDTH - 18, DANGER_LINE_Y);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "rgba(255, 107, 154, 0.82)";
  context.font = "800 11px Trebuchet MS, sans-serif";
  context.fillText("DANGER", 22, DANGER_LINE_Y - 8);
  context.restore();
}

function drawAim(context: CanvasRenderingContext2D, state: GameState) {
  if (!state.aim.active || state.moving || state.gameOver) {
    return;
  }

  const path = buildAimPath(state.aim.x, state.aim.y);
  context.save();
  context.setLineDash([4, 11]);
  context.lineCap = "round";
  context.lineWidth = 4;
  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.beginPath();
  context.moveTo(path[0].x, path[0].y);

  for (const point of path.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  context.stroke();
  context.restore();
}

function drawLauncher(context: CanvasRenderingContext2D, colorId: string) {
  context.save();
  context.translate(LAUNCHER_X, LAUNCHER_Y + 18);

  const bodyGradient = context.createLinearGradient(0, -26, 0, 42);
  bodyGradient.addColorStop(0, "#7de7ff");
  bodyGradient.addColorStop(0.48, "#4569ff");
  bodyGradient.addColorStop(1, "#221358");

  context.fillStyle = bodyGradient;
  context.beginPath();
  context.moveTo(0, -38);
  context.quadraticCurveTo(48, -22, 43, 24);
  context.quadraticCurveTo(18, 45, -18, 45);
  context.quadraticCurveTo(-49, 25, -43, -18);
  context.quadraticCurveTo(-24, -42, 0, -38);
  context.fill();

  context.fillStyle = "#ffd166";
  context.beginPath();
  context.moveTo(-30, -15);
  context.lineTo(-53, -24);
  context.lineTo(-36, -2);
  context.fill();
  context.beginPath();
  context.moveTo(30, -15);
  context.lineTo(53, -24);
  context.lineTo(36, -2);
  context.fill();

  context.fillStyle = "#07102c";
  context.beginPath();
  context.arc(-13, -14, 4, 0, Math.PI * 2);
  context.arc(13, -14, 4, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(255,255,255,0.55)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, -1, 15, 0.15 * Math.PI, 0.85 * Math.PI);
  context.stroke();
  context.restore();

  drawBubble(context, LAUNCHER_X, LAUNCHER_Y - 18, colorId, 1.08);
}

function drawBubble(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorId: string,
  scale = 1,
) {
  const color = COLOR_BY_ID[colorId] ?? BUBBLE_COLORS[0];
  const radius = BUBBLE_RADIUS * scale;
  const gradient = context.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.42,
    radius * 0.2,
    x,
    y,
    radius,
  );

  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.18, color.rim);
  gradient.addColorStop(0.48, color.fill);
  gradient.addColorStop(1, color.shadow);

  context.save();
  context.shadowColor = "rgba(0, 0, 0, 0.26)";
  context.shadowBlur = 9;
  context.shadowOffsetY = 4;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();

  context.shadowColor = "transparent";
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255, 255, 255, 0.44)";
  context.stroke();

  context.globalAlpha = 0.72;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.ellipse(x - radius * 0.35, y - radius * 0.45, radius * 0.22, radius * 0.13, -0.55, 0, Math.PI * 2);
  context.fill();
  context.restore();
}
