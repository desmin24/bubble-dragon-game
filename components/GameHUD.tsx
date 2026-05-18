import { COLOR_BY_ID } from "@/lib/game/constants";

type GameHUDProps = {
  score: number;
  bestScore: number;
  nextColorId: string;
};

export function GameHUD({ score, bestScore, nextColorId }: GameHUDProps) {
  const nextColor = COLOR_BY_ID[nextColorId];

  return (
    <header className="game-hud" aria-label="Game status">
      <div className="title-row">
        <h1 className="game-title" aria-label="Bubble Dragon">
          <span className="game-title__bubble">Bubble</span>
          <span className="game-title__dragon">Dragon</span>
        </h1>
      </div>
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-card__label">Score</span>
          <span className="stat-card__value">{score}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Best Score</span>
          <span className="stat-card__value">{bestScore}</span>
        </div>
        <div className="next-bubble" aria-label={`Next Bubble ${nextColor?.id ?? nextColorId}`}>
          <span className="next-bubble__label">Next Bubble</span>
          <span
            className="next-bubble__orb"
            style={{ "--bubble-color": nextColor?.fill ?? "#ffffff" } as React.CSSProperties}
          />
        </div>
      </div>
    </header>
  );
}
