import { useState, type CSSProperties, type FormEvent } from "react";

import type { AnnotationFeedback, FeedbackColor } from "../types";

type FeedbackPanelProps = {
  feedback: AnnotationFeedback;
  isSaving: boolean;
  onSave: (feedback: AnnotationFeedback) => Promise<void>;
};

const COLOR_OPTIONS: Array<{ label: string; value: FeedbackColor }> = [
  { label: "黑色", value: "black" },
  { label: "红色", value: "red" },
  { label: "蓝色", value: "blue" },
];

const COLOR_STYLE_MAP: Record<FeedbackColor, string> = {
  black: "#111827",
  red: "#b91c1c",
  blue: "#1d4ed8",
};

function getTextColorStyle(color: FeedbackColor): CSSProperties {
  return {
    color: COLOR_STYLE_MAP[color],
  };
}

export function FeedbackPanel({ feedback, isSaving, onSave }: FeedbackPanelProps) {
  const [notes, setNotes] = useState(feedback.notes);
  const [notesColor, setNotesColor] = useState<FeedbackColor>(feedback.notes_color ?? "black");
  const [rating, setRating] = useState<string>(feedback.rating !== null ? String(feedback.rating) : "");
  const [cognitiveDisagreement, setCognitiveDisagreement] = useState(
    feedback.disagreements.cognitive_patterns ?? "",
  );
  const [cognitiveDisagreementColor, setCognitiveDisagreementColor] = useState<FeedbackColor>(
    feedback.disagreement_colors.cognitive_patterns ?? "black",
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({
      notes,
      notes_color: notesColor,
      rating: rating ? Number(rating) : null,
      disagreements: cognitiveDisagreement
        ? { cognitive_patterns: cognitiveDisagreement }
        : {},
      disagreement_colors: cognitiveDisagreement
        ? { cognitive_patterns: cognitiveDisagreementColor }
        : {},
    });
  }

  return (
    <form className="feedback-panel" onSubmit={handleSubmit}>
      <h3>专业反馈</h3>

      <div className="feedback-field">
        <label htmlFor="feedback-notes">批注说明</label>
        <div className="color-picker" role="group" aria-label="批注说明颜色">
          {COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={notesColor === option.value ? "color-chip active" : "color-chip"}
              data-color={option.value}
              disabled={isSaving}
              onClick={() => setNotesColor(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <textarea
          id="feedback-notes"
          disabled={isSaving}
          rows={5}
          style={getTextColorStyle(notesColor)}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <label>
        评分（0-100）
        <input
          disabled={isSaving}
          type="number"
          min={0}
          max={100}
          value={rating}
          onChange={(event) => setRating(event.target.value)}
        />
      </label>

      <div className="feedback-field">
        <label htmlFor="feedback-cognitive-disagreement">认知模式分歧</label>
        <div className="color-picker" role="group" aria-label="认知模式分歧颜色">
          {COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={cognitiveDisagreementColor === option.value ? "color-chip active" : "color-chip"}
              data-color={option.value}
              disabled={isSaving}
              onClick={() => setCognitiveDisagreementColor(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <input
          id="feedback-cognitive-disagreement"
          disabled={isSaving}
          style={getTextColorStyle(cognitiveDisagreementColor)}
          value={cognitiveDisagreement}
          onChange={(event) => setCognitiveDisagreement(event.target.value)}
        />
      </div>

      <button type="submit" disabled={isSaving}>{isSaving ? "保存中..." : "保存反馈"}</button>
    </form>
  );
}
