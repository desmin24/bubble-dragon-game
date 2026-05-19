"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameHUD, type ScoreFeedback } from "./GameHUD";
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
import { getColorIdsForTier, getDifficultyTier, PRESSURE_ADVANCE_ROWS, type DifficultyTier } from "@/lib/game/difficulty";
import { addBubbleToGrid, advanceGridPressure, createInitialGrid } from "@/lib/game/grid";
import { buildAimPath, createShot, getAimTarget, hasHitBubble, updateMovingBubble } from "@/lib/game/physics";
import { resolveSettledShot } from "@/lib/game/rules";
import { BubbleDragonSound, STORAGE_SOUND_ENABLED_KEY, type SoundCue } from "@/lib/audio/sound";
import type { AimState, GridBubble, MovingBubble } from "@/lib/game/types";

type GameState = {
  grid: GridBubble[];
  moving: MovingBubble | null;
  currentColorId: string;
  nextColorId: string;
  aim: AimState;
  score: number;
  shotsFired: number;
  missesSinceClear: number;
  difficultyTier: DifficultyTier;
  gameOver: boolean;
};

type BubbleEffectKind = "match" | "drop";

type BubbleEffect = {
  id: string;
  x: number;
  y: number;
  colorId: string;
  kind: BubbleEffectKind;
  startedAt: number;
  delay: number;
  duration: number;
  drift: number;
};

type HitEffect = {
  id: string;
  x: number;
  y: number;
  colorId: string;
  startedAt: number;
  duration: number;
};

type StageNoticeKind = "tier" | "pressure";

type StageNotice = {
  id: number;
  title: string;
  detail: string;
  kind: StageNoticeKind;
};

type BubbleDrawOptions = {
  alpha?: number;
  glow?: boolean;
};

const emptyAim: AimState = { active: false, x: LAUNCHER_X, y: LAUNCHER_Y - 140 };

function randomColorId(colorIds: string[]): string {
  const safeColorIds = colorIds.length > 0 ? colorIds : BUBBLE_COLORS.map((color) => color.id);

  return safeColorIds[Math.floor(Math.random() * safeColorIds.length)];
}

function createNewGame(): GameState {
  const difficultyTier = getDifficultyTier(0, 0);
  const colorIds = getColorIdsForTier(difficultyTier);

  return {
    grid: createInitialGrid(colorIds),
    moving: null,
    currentColorId: randomColorId(colorIds),
    nextColorId: randomColorId(colorIds),
    aim: emptyAim,
    score: 0,
    shotsFired: 0,
    missesSinceClear: 0,
    difficultyTier,
    gameOver: false,
  };
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createNewGame());
  const bubbleEffectsRef = useRef<BubbleEffect[]>([]);
  const hitEffectsRef = useRef<HitEffect[]>([]);
  const soundRef = useRef<BubbleDragonSound | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const pressurePulseRef = useRef<number>(0);
  const scoreFeedbackIdRef = useRef(0);
  const stageNoticeIdRef = useRef(0);
  const stageNoticeTimerRef = useRef<number | null>(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [nextColorId, setNextColorId] = useState(stateRef.current.nextColorId);
  const [difficultyTier, setDifficultyTier] = useState(stateRef.current.difficultyTier);
  const [gameOver, setGameOver] = useState(false);
  const [scoreFeedback, setScoreFeedback] = useState<ScoreFeedback | null>(null);
  const [stageNotice, setStageNotice] = useState<StageNotice | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const playSound = useCallback((cue: SoundCue) => {
    soundRef.current?.play(cue);
  }, []);

  const unlockAudio = useCallback(() => {
    void soundRef.current?.unlock();
  }, []);

  const syncReactState = useCallback(() => {
    const state = stateRef.current;
    setScore(state.score);
    setNextColorId(state.nextColorId);
    setDifficultyTier(state.difficultyTier);
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
    unlockAudio();
    stateRef.current = createNewGame();
    bubbleEffectsRef.current = [];
    hitEffectsRef.current = [];
    pressurePulseRef.current = 0;
    setScoreFeedback(null);
    setStageNotice(null);
    syncReactState();
  }, [syncReactState, unlockAudio]);

  const showStageNotice = useCallback((title: string, detail: string, kind: StageNoticeKind) => {
    stageNoticeIdRef.current += 1;
    const id = stageNoticeIdRef.current;

    if (stageNoticeTimerRef.current !== null) {
      window.clearTimeout(stageNoticeTimerRef.current);
    }

    setStageNotice({ id, title, detail, kind });
    stageNoticeTimerRef.current = window.setTimeout(() => {
      setStageNotice((currentNotice) => (currentNotice?.id === id ? null : currentNotice));
      stageNoticeTimerRef.current = null;
    }, kind === "pressure" ? 1400 : 1900);
  }, []);

  useEffect(() => {
    const sound = new BubbleDragonSound();
    const storedSoundEnabled = localStorage.getItem(STORAGE_SOUND_ENABLED_KEY);
    const initialSoundEnabled = storedSoundEnabled !== "false";
    const storedBest = Number(localStorage.getItem(STORAGE_BEST_SCORE_KEY) ?? "0");

    sound.setEnabled(initialSoundEnabled);
    soundRef.current = sound;
    setSoundEnabled(initialSoundEnabled);

    if (Number.isFinite(storedBest)) {
      setBestScore(storedBest);
    }

    return () => {
      if (stageNoticeTimerRef.current !== null) {
        window.clearTimeout(stageNoticeTimerRef.current);
      }

      sound.dispose();
      soundRef.current = null;
    };
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
      bubbleEffectsRef.current = pruneBubbleEffects(bubbleEffectsRef.current, timestamp);
      hitEffectsRef.current = pruneHitEffects(hitEffectsRef.current, timestamp);
      drawGame(
        context,
        stateRef.current,
        bubbleEffectsRef.current,
        hitEffectsRef.current,
        timestamp,
        pressurePulseRef.current,
      );

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

    const previousVelocityX = state.moving.vx;
    const moving = updateMovingBubble(state.moving, deltaSeconds);
    state.moving = moving;

    if (Math.sign(previousVelocityX) !== Math.sign(moving.vx)) {
      playSound("settle");
    }

    if (moving.y <= GRID_TOP + BUBBLE_RADIUS || hasHitBubble(moving, state.grid)) {
      settleMovingBubble(moving);
    }
  };

  const settleMovingBubble = (moving: MovingBubble) => {
    const state = stateRef.current;
    const settled = addBubbleToGrid(moving.x, moving.y, moving.colorId, state.grid);
    const resolution = resolveSettledShot(state.grid, settled);
    const now = performance.now();
    const shotsFired = state.shotsFired + 1;
    const score = state.score + resolution.scoreDelta;
    const didClear = resolution.matched.length >= 3;
    const nextTier = getDifficultyTier(score, shotsFired);
    const activeColorIds = getColorIdsForTier(nextTier);
    const didTierChange = nextTier.id !== state.difficultyTier.id;
    let nextGrid = resolution.grid;
    let missesSinceClear = didClear ? 0 : state.missesSinceClear + 1;
    let didPressureAdvance = false;

    if (
      !didClear &&
      nextTier.pressureEveryMisses !== null &&
      missesSinceClear >= nextTier.pressureEveryMisses
    ) {
      nextGrid = advanceGridPressure(nextGrid, activeColorIds, PRESSURE_ADVANCE_ROWS);
      missesSinceClear = 0;
      didPressureAdvance = true;
      pressurePulseRef.current = now;
    }

    const didGameOver = nextGrid.some((bubble) => bubble.y + BUBBLE_RADIUS >= DANGER_LINE_Y);

    hitEffectsRef.current.push({
      id: `hit-${settled.id}-${now}`,
      x: settled.x,
      y: settled.y,
      colorId: settled.colorId,
      startedAt: now,
      duration: 260,
    });

    bubbleEffectsRef.current.push(
      ...resolution.matched.map((bubble, index) => ({
        id: `match-${bubble.id}-${now}`,
        x: bubble.x,
        y: bubble.y,
        colorId: bubble.colorId,
        kind: "match" as const,
        startedAt: now,
        delay: (index % 4) * 18,
        duration: 390,
        drift: 0,
      })),
      ...resolution.dropped.map((bubble, index) => ({
        id: `drop-${bubble.id}-${now}`,
        x: bubble.x,
        y: bubble.y,
        colorId: bubble.colorId,
        kind: "drop" as const,
        startedAt: now,
        delay: 110 + (index % 6) * 26,
        duration: 780,
        drift: ((index % 5) - 2) * 8,
      })),
    );

    playSound("settle");

    if (resolution.matched.length >= 3) {
      playSound("clear");
    }

    if (resolution.dropped.length > 0) {
      playSound("drop");
    }

    if (didTierChange) {
      showStageNotice(nextTier.noticeTitle, nextTier.noticeDetail, "tier");
    } else if (didPressureAdvance) {
      showStageNotice("Pressure Wave", "Rows moved down", "pressure");
    }

    if (resolution.scoreDelta > 0) {
      scoreFeedbackIdRef.current += 1;
      setScoreFeedback({
        id: scoreFeedbackIdRef.current,
        amount: resolution.scoreDelta,
        droppedCount: resolution.dropped.length,
      });
    }

    if (didGameOver) {
      playSound("gameOver");
    }

    state.grid = nextGrid;
    state.moving = null;
    state.currentColorId = state.nextColorId;
    state.nextColorId = randomColorId(activeColorIds);
    state.score = score;
    state.shotsFired = shotsFired;
    state.missesSinceClear = missesSinceClear;
    state.difficultyTier = nextTier;
    state.gameOver = didGameOver;
    syncReactState();
  };

  const toggleSound = () => {
    setSoundEnabled((currentSoundEnabled) => {
      const nextSoundEnabled = !currentSoundEnabled;

      localStorage.setItem(STORAGE_SOUND_ENABLED_KEY, String(nextSoundEnabled));
      soundRef.current?.setEnabled(nextSoundEnabled);

      if (nextSoundEnabled) {
        void soundRef.current?.unlock().then(() => {
          soundRef.current?.play("clear");
        });
      }

      return nextSoundEnabled;
    });
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

    unlockAudio();
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
    unlockAudio();
    playSound("shoot");
    state.moving = createShot(target.x, target.y, state.currentColorId);
    state.aim = emptyAim;
  };

  return (
    <section className="game-frame" aria-label="Bubble Dragon game">
      <GameHUD
        score={score}
        bestScore={bestScore}
        nextColorId={nextColorId}
        scoreFeedback={scoreFeedback}
        difficultyTier={difficultyTier}
      />
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
      {stageNotice ? (
        <div key={stageNotice.id} className={`stage-toast stage-toast--${stageNotice.kind}`} role="status">
          <strong>{stageNotice.title}</strong>
          <span>{stageNotice.detail}</span>
        </div>
      ) : null}
      <footer className="game-footer">
        <div className="footer-actions">
          <button className="restart-button" type="button" onClick={restart}>
            Restart
          </button>
          <button
            className="sound-toggle"
            type="button"
            aria-pressed={!soundEnabled}
            aria-label={soundEnabled ? "Mute sound" : "Turn sound on"}
            onClick={toggleSound}
          >
            <span className="sound-toggle__dot" aria-hidden="true" />
            <span>{soundEnabled ? "Sound" : "Mute"}</span>
          </button>
        </div>
        <p className="hint-text">拖曳瞄準，放開發射</p>
      </footer>
      {gameOver ? <GameOverlay score={score} onRestart={restart} /> : null}
    </section>
  );
}

function drawGame(
  context: CanvasRenderingContext2D,
  state: GameState,
  bubbleEffects: BubbleEffect[],
  hitEffects: HitEffect[],
  timestamp: number,
  pressurePulseStartedAt: number,
) {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackground(context);
  const pressurePulseProgress =
    pressurePulseStartedAt > 0 ? clamp((timestamp - pressurePulseStartedAt) / 700, 0, 1) : 1;
  const pressurePulseStrength = pressurePulseStartedAt > 0 && pressurePulseProgress < 1 ? 1 - pressurePulseProgress : 0;

  drawDangerLine(context, pressurePulseStrength);
  drawPressureWarning(context, pressurePulseStrength);
  drawAim(context, state);

  for (const bubble of state.grid) {
    drawBubble(context, bubble.x, bubble.y, bubble.colorId);
  }

  if (state.moving) {
    drawBubble(context, state.moving.x, state.moving.y, state.moving.colorId);
  }

  drawBubbleEffects(context, bubbleEffects, timestamp);
  drawHitEffects(context, hitEffects, timestamp);
  drawLauncher(context, state.currentColorId);
}

function drawBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#1a2d72");
  gradient.addColorStop(0.45, "#101a51");
  gradient.addColorStop(0.78, "#0a1036");
  gradient.addColorStop(1, "#07102c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const aurora = context.createRadialGradient(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT, 10, CANVAS_WIDTH * 0.5, CANVAS_HEIGHT, 360);
  aurora.addColorStop(0, "rgba(84, 226, 255, 0.28)");
  aurora.addColorStop(0.38, "rgba(101, 91, 255, 0.13)");
  aurora.addColorStop(1, "rgba(84, 226, 255, 0)");
  context.fillStyle = aurora;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.save();
  context.globalAlpha = 0.22;
  context.strokeStyle = "rgba(117, 233, 255, 0.36)";
  context.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    context.beginPath();
    context.moveTo(-30, 145 + i * 58);
    context.bezierCurveTo(70, 118 + i * 36, 128, 180 + i * 42, 218, 142 + i * 47);
    context.bezierCurveTo(278, 116 + i * 38, 330, 150 + i * 45, 400, 126 + i * 48);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.34;
  for (let i = 0; i < 42; i += 1) {
    const x = (i * 83) % CANVAS_WIDTH;
    const y = (i * 137) % CANVAS_HEIGHT;
    context.beginPath();
    context.arc(x, y, 0.8 + (i % 4) * 0.72, 0, Math.PI * 2);
    context.fillStyle = i % 2 === 0 ? "#ffffff" : "#54e2ff";
    context.fill();
  }
  context.restore();

  drawCrystalHills(context);
}

function drawDangerLine(context: CanvasRenderingContext2D, pressurePulseStrength = 0) {
  context.save();
  context.setLineDash([9, 8]);
  context.lineWidth = 2.2 + pressurePulseStrength * 1.2;
  context.shadowColor = "rgba(255, 107, 154, 0.56)";
  context.shadowBlur = 10 + pressurePulseStrength * 18;
  context.strokeStyle = `rgba(255, 107, 154, ${0.8 + pressurePulseStrength * 0.18})`;
  context.beginPath();
  context.moveTo(21, DANGER_LINE_Y);
  context.lineTo(CANVAS_WIDTH - 21, DANGER_LINE_Y);
  context.stroke();
  context.setLineDash([]);
  context.shadowBlur = 0;
  context.fillStyle = "rgba(255, 107, 154, 0.14)";
  context.beginPath();
  context.roundRect(21, DANGER_LINE_Y - 18, 62, 15, 8);
  context.fill();
  context.fillStyle = "rgba(255, 158, 190, 0.92)";
  context.font = "900 10px Trebuchet MS, sans-serif";
  context.letterSpacing = "0.7px";
  context.fillText("DANGER", 28, DANGER_LINE_Y - 7);
  context.restore();
}

function drawPressureWarning(context: CanvasRenderingContext2D, pressurePulseStrength: number) {
  if (pressurePulseStrength <= 0) {
    return;
  }

  context.save();
  context.globalAlpha = pressurePulseStrength * 0.34;
  const gradient = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, "rgba(255, 209, 102, 0.34)");
  gradient.addColorStop(0.4, "rgba(255, 107, 154, 0.14)");
  gradient.addColorStop(1, "rgba(255, 107, 154, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.restore();
}

function drawAim(context: CanvasRenderingContext2D, state: GameState) {
  if (!state.aim.active || state.moving || state.gameOver) {
    return;
  }

  const path = buildAimPath(state.aim.x, state.aim.y);
  context.save();
  context.shadowColor = "rgba(84, 226, 255, 0.7)";
  context.shadowBlur = 12;
  context.setLineDash([2, 12]);
  context.lineCap = "round";
  context.lineWidth = 5;
  context.strokeStyle = "rgba(173, 245, 255, 0.78)";
  context.beginPath();
  context.moveTo(path[0].x, path[0].y);

  for (const point of path.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  context.stroke();

  const target = path[path.length - 1];
  context.setLineDash([]);
  context.lineWidth = 2;
  context.strokeStyle = "rgba(255, 255, 255, 0.76)";
  context.beginPath();
  context.arc(target.x, target.y, 8, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawLauncher(context: CanvasRenderingContext2D, colorId: string) {
  const pulse = 1 + Math.sin(performance.now() / 420) * 0.025;
  const characterY = LAUNCHER_Y - 3;
  const heldBubbleY = LAUNCHER_Y - 32;

  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.2)";
  context.filter = "blur(7px)";
  context.beginPath();
  context.ellipse(LAUNCHER_X, characterY + 52, 72, 16, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.translate(LAUNCHER_X, characterY);

  const bodyGradient = context.createLinearGradient(0, -26, 0, 42);
  bodyGradient.addColorStop(0, "#8af3ff");
  bodyGradient.addColorStop(0.45, "#4d82ff");
  bodyGradient.addColorStop(1, "#2b1a83");

  context.fillStyle = "rgba(113, 80, 255, 0.28)";
  context.beginPath();
  context.ellipse(0, 43, 66, 17, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = bodyGradient;
  context.beginPath();
  context.moveTo(0, -38);
  context.quadraticCurveTo(48, -22, 43, 24);
  context.quadraticCurveTo(18, 45, -18, 45);
  context.quadraticCurveTo(-49, 25, -43, -18);
  context.quadraticCurveTo(-24, -42, 0, -38);
  context.fill();

  const bellyGradient = context.createLinearGradient(0, 3, 0, 48);
  bellyGradient.addColorStop(0, "#c8fbff");
  bellyGradient.addColorStop(1, "#5ec8ff");
  context.fillStyle = bellyGradient;
  context.beginPath();
  context.ellipse(0, 25, 20, 21, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(255, 255, 255, 0.4)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 24, 13, 0.2 * Math.PI, 0.8 * Math.PI);
  context.stroke();

  context.fillStyle = "#ffd166";
  context.beginPath();
  context.moveTo(-30, -16);
  context.lineTo(-58, -29);
  context.lineTo(-38, 2);
  context.fill();
  context.beginPath();
  context.moveTo(30, -16);
  context.lineTo(58, -29);
  context.lineTo(38, 2);
  context.fill();

  context.fillStyle = "#fff0a7";
  context.beginPath();
  context.moveTo(-12, -36);
  context.lineTo(-6, -56);
  context.lineTo(0, -37);
  context.fill();
  context.beginPath();
  context.moveTo(12, -36);
  context.lineTo(6, -56);
  context.lineTo(0, -37);
  context.fill();

  context.fillStyle = "#07102c";
  context.beginPath();
  context.arc(-13, -16, 4.5, 0, Math.PI * 2);
  context.arc(13, -16, 4.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(255, 255, 255, 0.82)";
  context.beginPath();
  context.arc(-14.5, -17.5, 1.5, 0, Math.PI * 2);
  context.arc(11.5, -17.5, 1.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(255, 138, 199, 0.58)";
  context.beginPath();
  context.arc(-24, -5, 5, 0, Math.PI * 2);
  context.arc(24, -5, 5, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(255,255,255,0.55)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, -3, 15, 0.15 * Math.PI, 0.85 * Math.PI);
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = "rgba(84, 226, 255, 0.38)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(LAUNCHER_X, heldBubbleY, BUBBLE_RADIUS * 1.38 * pulse, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  drawBubble(context, LAUNCHER_X, heldBubbleY, colorId, 1.1 * pulse);
}

function drawBubbleEffects(context: CanvasRenderingContext2D, effects: BubbleEffect[], timestamp: number) {
  for (const effect of effects) {
    const elapsed = timestamp - effect.startedAt - effect.delay;

    if (elapsed < 0) {
      drawBubble(context, effect.x, effect.y, effect.colorId, 1, { alpha: 0.96 });
      continue;
    }

    const progress = clamp(elapsed / effect.duration, 0, 1);

    if (effect.kind === "match") {
      drawMatchedBubbleEffect(context, effect, progress);
    } else {
      drawDroppedBubbleEffect(context, effect, progress);
    }
  }
}

function drawMatchedBubbleEffect(context: CanvasRenderingContext2D, effect: BubbleEffect, progress: number) {
  const popScale = 1 + Math.sin(progress * Math.PI) * 0.34 - progress * 0.1;
  const alpha = 1 - easeOutCubic(progress);
  const ringRadius = BUBBLE_RADIUS * (1.1 + progress * 1.65);

  context.save();
  context.globalAlpha = Math.max(0, alpha);
  context.shadowColor = "rgba(255, 255, 255, 0.8)";
  context.shadowBlur = 16;
  drawBubble(context, effect.x, effect.y, effect.colorId, popScale, {
    alpha: Math.max(0, 0.95 - progress * 0.8),
    glow: true,
  });
  context.restore();

  context.save();
  context.globalAlpha = Math.max(0, 0.8 - progress * 0.8);
  context.strokeStyle = "rgba(255, 255, 255, 0.86)";
  context.lineWidth = 2;
  context.shadowColor = "rgba(255, 209, 102, 0.7)";
  context.shadowBlur = 12;
  context.beginPath();
  context.arc(effect.x, effect.y, ringRadius, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "rgba(255, 255, 255, 0.9)";
  for (let index = 0; index < 4; index += 1) {
    const angle = progress * Math.PI * 1.4 + index * (Math.PI / 2);
    const sparkleDistance = BUBBLE_RADIUS * (0.8 + progress * 1.5);
    context.beginPath();
    context.arc(
      effect.x + Math.cos(angle) * sparkleDistance,
      effect.y + Math.sin(angle) * sparkleDistance,
      1.7 * (1 - progress),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();
}

function drawDroppedBubbleEffect(context: CanvasRenderingContext2D, effect: BubbleEffect, progress: number) {
  const eased = easeInCubic(progress);
  const y = effect.y + eased * 170;
  const x = effect.x + Math.sin(progress * Math.PI * 1.8) * effect.drift;
  const alpha = Math.max(0, 1 - progress * 0.86);
  const scale = Math.max(0.62, 1 - progress * 0.22);

  context.save();
  context.globalAlpha = Math.max(0, 0.32 - progress * 0.3);
  context.strokeStyle = "rgba(173, 245, 255, 0.42)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(effect.x, effect.y + BUBBLE_RADIUS * 0.45);
  context.quadraticCurveTo(x + effect.drift * 0.4, (effect.y + y) / 2, x, y - BUBBLE_RADIUS);
  context.stroke();
  context.restore();

  drawBubble(context, x, y, effect.colorId, scale, { alpha });
}

function drawHitEffects(context: CanvasRenderingContext2D, effects: HitEffect[], timestamp: number) {
  for (const effect of effects) {
    const progress = clamp((timestamp - effect.startedAt) / effect.duration, 0, 1);
    const alpha = 1 - progress;
    const color = COLOR_BY_ID[effect.colorId] ?? BUBBLE_COLORS[0];

    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color.rim;
    context.lineWidth = 3 - progress;
    context.shadowColor = color.fill;
    context.shadowBlur = 16;
    context.beginPath();
    context.arc(effect.x, effect.y, BUBBLE_RADIUS * (1 + progress * 1.25), 0, Math.PI * 2);
    context.stroke();

    context.globalAlpha = alpha * 0.22;
    context.fillStyle = color.rim;
    context.beginPath();
    context.arc(effect.x, effect.y, BUBBLE_RADIUS * (0.9 + progress * 0.35), 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawBubble(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorId: string,
  scale = 1,
  options: BubbleDrawOptions = {},
) {
  const color = COLOR_BY_ID[colorId] ?? BUBBLE_COLORS[0];
  const alpha = options.alpha ?? 1;
  const radius = BUBBLE_RADIUS * scale;
  const gradient = context.createRadialGradient(
    x - radius * 0.38,
    y - radius * 0.45,
    radius * 0.2,
    x,
    y,
    radius,
  );

  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.16, color.rim);
  gradient.addColorStop(0.54, color.fill);
  gradient.addColorStop(0.78, color.fill);
  gradient.addColorStop(1, color.shadow);

  context.save();
  context.globalAlpha = alpha;
  context.shadowColor = "rgba(0, 0, 0, 0.32)";
  context.shadowBlur = options.glow ? 18 : 10;
  context.shadowOffsetY = 5;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();

  context.shadowColor = "transparent";
  context.lineWidth = 2.2;
  context.strokeStyle = "rgba(255, 255, 255, 0.58)";
  context.stroke();

  context.globalAlpha = alpha * 0.8;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.ellipse(x - radius * 0.36, y - radius * 0.47, radius * 0.24, radius * 0.13, -0.55, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = alpha * 0.18;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(x, y, radius * 0.7, 1.12 * Math.PI, 1.88 * Math.PI);
  context.stroke();
  context.restore();
}

function pruneBubbleEffects(effects: BubbleEffect[], timestamp: number): BubbleEffect[] {
  return effects.filter((effect) => timestamp <= effect.startedAt + effect.delay + effect.duration);
}

function pruneHitEffects(effects: HitEffect[], timestamp: number): HitEffect[] {
  return effects.filter((effect) => timestamp <= effect.startedAt + effect.duration);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function easeInCubic(value: number): number {
  return value * value * value;
}

function drawCrystalHills(context: CanvasRenderingContext2D) {
  context.save();
  context.globalAlpha = 0.56;

  const leftGradient = context.createLinearGradient(0, CANVAS_HEIGHT - 180, 0, CANVAS_HEIGHT);
  leftGradient.addColorStop(0, "rgba(69, 48, 144, 0)");
  leftGradient.addColorStop(0.55, "rgba(54, 43, 132, 0.5)");
  leftGradient.addColorStop(1, "rgba(14, 11, 44, 0.84)");
  context.fillStyle = leftGradient;
  context.beginPath();
  context.moveTo(0, CANVAS_HEIGHT);
  context.lineTo(0, CANVAS_HEIGHT - 70);
  context.lineTo(34, CANVAS_HEIGHT - 142);
  context.lineTo(58, CANVAS_HEIGHT - 70);
  context.lineTo(92, CANVAS_HEIGHT - 120);
  context.lineTo(132, CANVAS_HEIGHT);
  context.closePath();
  context.fill();

  const rightGradient = context.createLinearGradient(0, CANVAS_HEIGHT - 160, 0, CANVAS_HEIGHT);
  rightGradient.addColorStop(0, "rgba(60, 91, 180, 0)");
  rightGradient.addColorStop(0.55, "rgba(44, 66, 153, 0.42)");
  rightGradient.addColorStop(1, "rgba(7, 10, 35, 0.84)");
  context.fillStyle = rightGradient;
  context.beginPath();
  context.moveTo(CANVAS_WIDTH, CANVAS_HEIGHT);
  context.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 94);
  context.lineTo(CANVAS_WIDTH - 35, CANVAS_HEIGHT - 154);
  context.lineTo(CANVAS_WIDTH - 58, CANVAS_HEIGHT - 86);
  context.lineTo(CANVAS_WIDTH - 94, CANVAS_HEIGHT - 126);
  context.lineTo(CANVAS_WIDTH - 142, CANVAS_HEIGHT);
  context.closePath();
  context.fill();

  context.globalAlpha = 0.72;
  context.fillStyle = "rgba(84, 226, 255, 0.26)";
  for (const crystal of [
    { x: 26, y: CANVAS_HEIGHT - 58, h: 28 },
    { x: CANVAS_WIDTH - 28, y: CANVAS_HEIGHT - 62, h: 34 },
    { x: CANVAS_WIDTH - 64, y: CANVAS_HEIGHT - 40, h: 20 },
  ]) {
    context.beginPath();
    context.moveTo(crystal.x, crystal.y - crystal.h);
    context.lineTo(crystal.x + 9, crystal.y);
    context.lineTo(crystal.x - 8, crystal.y);
    context.closePath();
    context.fill();
  }

  context.restore();
}
