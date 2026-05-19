import { COLOR_BY_ID } from "@/lib/game/constants";
import { getTierHudDetail, type DifficultyTier } from "@/lib/game/difficulty";

type GameHUDProps = {
  score: number;
  bestScore: number;
  nextColorId: string;
  scoreFeedback: ScoreFeedback | null;
  difficultyTier: DifficultyTier;
};

export type ScoreFeedback = {
  id: number;
  amount: number;
  droppedCount: number;
};

export function GameHUD({ score, bestScore, nextColorId, scoreFeedback, difficultyTier }: GameHUDProps) {
  const nextColor = COLOR_BY_ID[nextColorId];

  return (
    <header className="game-hud" aria-label="Game status">
      <div className="title-row">
        <h1 className="game-title" aria-label="Bubble Dragon">
          <span className="game-title__bubble">Bubble</span>
          <span className="game-title__dragon">Dragon</span>
        </h1>
        <div className="stage-badge" aria-label={`Stage ${difficultyTier.stage}, ${difficultyTier.name}`}>
          <span>Stage {difficultyTier.stage}</span>
          <strong>{difficultyTier.name}</strong>
          <small>{getTierHudDetail(difficultyTier)}</small>
        </div>
      </div>
      <div className="hero-gif-row" aria-label="Bubble Dragon mascot animation">
        <img
          className="hero-gif-row__dragon"
          src="/images/gifs/dragon-shoot.gif"
          alt="Bubble Dragon mascot"
          width={148}
          height={148}
        />
        <img
          className="hero-gif-row__pop"
          src="/images/gifs/bubble-pop-transparent.gif"
          alt=""
          width={58}
          height={58}
          aria-hidden="true"
        />
      </div>
      <div className="stats-row">
        <div className="stat-card score-card">
          <span className="stat-card__label">Score</span>
          <span key={scoreFeedback?.id ?? "score"} className="stat-card__value score-card__value">
            {score}
          </span>
          {scoreFeedback ? (
            <span key={`float-${scoreFeedback.id}`} className="score-float" aria-hidden="true">
              +{scoreFeedback.amount}
              {scoreFeedback.droppedCount > 0 ? <small>Drop Bonus</small> : null}
            </span>
          ) : null}
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
