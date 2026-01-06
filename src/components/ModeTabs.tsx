import { LearningMode, LEARNING_MODES } from "../types/modes";

type Props = {
  currentMode: LearningMode;
  onModeChange: (mode: LearningMode) => void;
};

export default function ModeTabs({ currentMode, onModeChange }: Props) {
  const activeModes = LEARNING_MODES.filter((m) => !m.disabled);

  return (
    <div className="mode-tabs">
      {activeModes.map((mode) => (
        <button
          key={mode.id}
          className={`mode-tab ${currentMode === mode.id ? "mode-tab--active" : ""}`}
          onClick={() => onModeChange(mode.id)}
        >
          <span className="mode-tab__icon">{mode.icon}</span>
          <span className="mode-tab__name">{mode.name}</span>
        </button>
      ))}
    </div>
  );
}
