import { LearningMode, LEARNING_MODES } from "../types/modes";
import { capitalize } from "../utils/strings";

type Props = {
  language: string;
  onModeSelected: (mode: LearningMode) => void;
  onBack: () => void;
};

export default function ModeSelector({ language, onModeSelected, onBack }: Props) {
  const displayName = capitalize(language);

  return (
    <div className="container">
      <header>
        <h1>Learning {displayName}</h1>
        <button className="back-btn" onClick={onBack}>
          Change Language
        </button>
      </header>

      <p className="mode-prompt">Choose how you want to practice:</p>

      <div className="mode-grid">
        {LEARNING_MODES.map((mode) => (
          <button
            key={mode.id}
            className={`mode-card ${mode.disabled ? "mode-card--disabled" : ""}`}
            onClick={() => !mode.disabled && onModeSelected(mode.id)}
            disabled={mode.disabled}
          >
            <span className="mode-card__icon">{mode.icon}</span>
            <span className="mode-card__name">{mode.name}</span>
            <span className="mode-card__description">{mode.description}</span>
            {mode.disabled && <span className="mode-card__badge">Coming Soon</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
