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
  black: "#1c1d21",
  red: "#b42318",
  blue: "#2f4a8b",
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
      disagreements: cognitiveDisagreement ? { cognitive_patterns: cognitiveDisagreement } : {},
      disagreement_colors: cognitiveDisagreement
        ? { cognitive_patterns: cognitiveDisagreementColor }
        : {},
    });
  }

  return (
    <form className="result-section" onSubmit={handleSubmit}>
      <div className="fb-eyebrow">FEEDBACK</div>

      <div className="fb-label">
        <label htmlFor="feedback-notes">批注说明</label>
        <span className="hint">选择标注笔色</span>
        <div aria-label="批注说明颜色" className="fb-color-row" role="group">
          {COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={notesColor === option.value ? "fb-pill is-on" : "fb-pill"}
              disabled={isSaving}
              onClick={() => setNotesColor(option.value)}
              style={option.value !== "black" ? { color: COLOR_STYLE_MAP[option.value] } : undefined}
              type="button"
            >
              <span className="swatch" />
              {option.label}
            </button>
          ))}
        </div>
        <textarea
          className="fb-textarea"
          disabled={isSaving}
          id="feedback-notes"
          rows={4}
          style={getTextColorStyle(notesColor)}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="fb-label">
        <label htmlFor="feedback-rating">评分 (0-100)</label>
        <span className="hint">整体临床关注度</span>
        <div className="fb-score-track">
          <input
            aria-label="评分滑块"
            disabled={isSaving}
            id="feedback-rating"
            max={100}
            min={0}
            type="range"
            value={rating || "0"}
            onChange={(event) => setRating(event.target.value)}
          />
          <input
            aria-label="评分 (0-100)"
            className="fb-score-num"
            disabled={isSaving}
            max={100}
            min={0}
            type="number"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          />
        </div>
      </div>

      <div className="fb-label">
        <label htmlFor="feedback-cognitive-disagreement">认知模式分歧</label>
        <span className="hint">与 AI 判断不一致之处</span>
        <div aria-label="认知模式分歧颜色" className="fb-color-row" role="group">
          {COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={cognitiveDisagreementColor === option.value ? "fb-pill is-on" : "fb-pill"}
              disabled={isSaving}
              onClick={() => setCognitiveDisagreementColor(option.value)}
              style={option.value !== "black" ? { color: COLOR_STYLE_MAP[option.value] } : undefined}
              type="button"
            >
              <span className="swatch" />
              {option.label}
            </button>
          ))}
        </div>
        <input
          className="fb-textarea"
          disabled={isSaving}
          id="feedback-cognitive-disagreement"
          style={{ ...getTextColorStyle(cognitiveDisagreementColor), minHeight: 40 }}
          value={cognitiveDisagreement}
          onChange={(event) => setCognitiveDisagreement(event.target.value)}
        />
      </div>

      <button className="fb-save" disabled={isSaving} type="submit">
        {isSaving ? "保存中..." : "保存反馈"}
      </button>
    </form>
  );
}
