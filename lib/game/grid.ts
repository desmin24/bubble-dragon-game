import {
  BUBBLE_COLORS,
  BUBBLE_RADIUS,
  GRID_COLS,
  GRID_TOP,
  INITIAL_ROWS,
  MAX_GRID_ROWS,
} from "./constants";
import type { Cell, GridBubble } from "./types";

const ROW_GAP = Math.sqrt(3) * BUBBLE_RADIUS;
const HORIZONTAL_GAP = BUBBLE_RADIUS * 2;
const DEFAULT_COLOR_IDS = BUBBLE_COLORS.map((color) => color.id);

export function getCellPosition(row: number, col: number): Cell {
  const rowOffset = row % 2 === 0 ? 0 : BUBBLE_RADIUS;

  return {
    row,
    col,
    x: BUBBLE_RADIUS + rowOffset + col * HORIZONTAL_GAP,
    y: GRID_TOP + BUBBLE_RADIUS + row * ROW_GAP,
  };
}

export function getRowLength(row: number): number {
  return row % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
}

export function createInitialGrid(colorIds: string[] = DEFAULT_COLOR_IDS): GridBubble[] {
  const bubbles: GridBubble[] = [];
  const safeColorIds = colorIds.length > 0 ? colorIds : DEFAULT_COLOR_IDS;
  const openingSeed = Math.floor(Math.random() * safeColorIds.length);

  for (let row = 0; row < INITIAL_ROWS; row += 1) {
    const rowLength = getRowLength(row);

    for (let col = 0; col < rowLength; col += 1) {
      const cell = getCellPosition(row, col);
      const clusterIndex = openingSeed + Math.floor(row / 2) * 2 + Math.floor(col / 2);
      const colorId = safeColorIds[clusterIndex % safeColorIds.length];

      bubbles.push({
        id: `${row}-${col}-${crypto.randomUUID()}`,
        row,
        col,
        colorId,
        x: cell.x,
        y: cell.y,
      });
    }
  }

  return bubbles;
}

export function createGridMap(bubbles: GridBubble[]): Map<string, GridBubble> {
  return new Map(bubbles.map((bubble) => [cellKey(bubble.row, bubble.col), bubble]));
}

export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function getNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
  const even = row % 2 === 0;
  const candidates = even
    ? [
        { row, col: col - 1 },
        { row, col: col + 1 },
        { row: row - 1, col: col - 1 },
        { row: row - 1, col },
        { row: row + 1, col: col - 1 },
        { row: row + 1, col },
      ]
    : [
        { row, col: col - 1 },
        { row, col: col + 1 },
        { row: row - 1, col },
        { row: row - 1, col: col + 1 },
        { row: row + 1, col },
        { row: row + 1, col: col + 1 },
      ];

  return candidates.filter(({ row: nextRow, col: nextCol }) => {
    return nextRow >= 0 && nextRow < MAX_GRID_ROWS && nextCol >= 0 && nextCol < getRowLength(nextRow);
  });
}

export function findNearestOpenCell(
  x: number,
  y: number,
  bubbles: GridBubble[],
): Cell {
  const occupied = createGridMap(bubbles);
  let nearest: Cell | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let row = 0; row < MAX_GRID_ROWS; row += 1) {
    const rowLength = getRowLength(row);

    for (let col = 0; col < rowLength; col += 1) {
      if (occupied.has(cellKey(row, col))) {
        continue;
      }

      const cell = getCellPosition(row, col);
      const distance = Math.hypot(cell.x - x, cell.y - y);

      if (distance < nearestDistance) {
        nearest = cell;
        nearestDistance = distance;
      }
    }
  }

  return nearest ?? getCellPosition(0, Math.floor(GRID_COLS / 2));
}

export function addBubbleToGrid(
  x: number,
  y: number,
  colorId: string,
  bubbles: GridBubble[],
): GridBubble {
  const cell = findNearestOpenCell(x, y, bubbles);

  return {
    id: `${cell.row}-${cell.col}-${crypto.randomUUID()}`,
    row: cell.row,
    col: cell.col,
    colorId,
    x: cell.x,
    y: cell.y,
  };
}

export function advanceGridPressure(
  bubbles: GridBubble[],
  colorIds: string[] = DEFAULT_COLOR_IDS,
  rowsToAdvance = 2,
): GridBubble[] {
  const safeColorIds = colorIds.length > 0 ? colorIds : DEFAULT_COLOR_IDS;
  const seed = Math.floor(Math.random() * safeColorIds.length);
  const pressureRows: GridBubble[] = [];

  for (let row = 0; row < rowsToAdvance; row += 1) {
    const rowLength = getRowLength(row);

    for (let col = 0; col < rowLength; col += 1) {
      const cell = getCellPosition(row, col);
      const colorId = safeColorIds[(seed + row + Math.floor(col / 2)) % safeColorIds.length];

      pressureRows.push({
        id: `pressure-${row}-${col}-${crypto.randomUUID()}`,
        row,
        col,
        colorId,
        x: cell.x,
        y: cell.y,
      });
    }
  }

  const shiftedBubbles = bubbles.map((bubble) => {
    const nextRow = bubble.row + rowsToAdvance;
    const cell = getCellPosition(nextRow, bubble.col);

    return {
      ...bubble,
      row: nextRow,
      x: cell.x,
      y: cell.y,
    };
  });

  return [...pressureRows, ...shiftedBubbles];
}

export function findMatchingCluster(start: GridBubble, bubbles: GridBubble[]): GridBubble[] {
  const map = createGridMap(bubbles);
  const visited = new Set<string>();
  const stack = [start];
  const cluster: GridBubble[] = [];

  while (stack.length > 0) {
    const bubble = stack.pop();

    if (!bubble) {
      continue;
    }

    const key = cellKey(bubble.row, bubble.col);

    if (visited.has(key)) {
      continue;
    }

    visited.add(key);
    cluster.push(bubble);

    for (const neighbor of getNeighbors(bubble.row, bubble.col)) {
      const next = map.get(cellKey(neighbor.row, neighbor.col));

      if (next && next.colorId === start.colorId && !visited.has(cellKey(next.row, next.col))) {
        stack.push(next);
      }
    }
  }

  return cluster;
}

export function findFloatingBubbles(bubbles: GridBubble[]): GridBubble[] {
  const map = createGridMap(bubbles);
  const connected = new Set<string>();
  const stack = bubbles.filter((bubble) => bubble.row === 0);

  while (stack.length > 0) {
    const bubble = stack.pop();

    if (!bubble) {
      continue;
    }

    const key = cellKey(bubble.row, bubble.col);

    if (connected.has(key)) {
      continue;
    }

    connected.add(key);

    for (const neighbor of getNeighbors(bubble.row, bubble.col)) {
      const next = map.get(cellKey(neighbor.row, neighbor.col));

      if (next && !connected.has(cellKey(next.row, next.col))) {
        stack.push(next);
      }
    }
  }

  return bubbles.filter((bubble) => !connected.has(cellKey(bubble.row, bubble.col)));
}
