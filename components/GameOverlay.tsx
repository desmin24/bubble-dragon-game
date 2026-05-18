type GameOverlayProps = {
  score: number;
  onRestart: () => void;
};

export function GameOverlay({ score, onRestart }: GameOverlayProps) {
  return (
    <div className="game-over-backdrop" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <section className="game-over-card">
        <h2 id="game-over-title">Game Over</h2>
        <p>泡泡龍暫時被泡泡包圍了。</p>
        <div className="score-pill">
          <span>Score</span>
          <span>{score}</span>
        </div>
        <button className="restart-button" type="button" onClick={onRestart}>
          Restart
        </button>
      </section>
    </div>
  );
}
