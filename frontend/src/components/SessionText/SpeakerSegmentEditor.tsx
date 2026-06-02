import { useEffect, useRef } from "react";

import { createId, speakerLabel } from "./sessionText.utils";
import type { Speaker, TranscriptSegment } from "./sessionText.types";

type SpeakerSegmentEditorProps = {
  autoFocusMode?: "edit" | "append";
  segments: TranscriptSegment[];
  onSegmentsChange: (segments: TranscriptSegment[]) => void;
};

const SPEAKERS: Speaker[] = ["client", "therapist"];

function emptySegment(speaker: Speaker): TranscriptSegment {
  return {
    id: createId("segment"),
    speaker,
    text: "",
  };
}

function autoResize(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

export function SpeakerSegmentEditor({
  autoFocusMode = "edit",
  segments,
  onSegmentsChange,
}: SpeakerSegmentEditorProps) {
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    Object.values(refs.current).forEach((element) => {
      if (element) {
        autoResize(element);
      }
    });
  }, [segments]);

  useEffect(() => {
    if (autoFocusMode !== "append") {
      return;
    }
    const target = [...segments].reverse().find((segment) => segment.text.trim());
    if (!target) {
      return;
    }
    requestAnimationFrame(() => {
      const element = refs.current[target.id];
      if (!element) {
        return;
      }
      element.focus();
      const end = element.value.length;
      element.setSelectionRange(end, end);
    });
  }, [autoFocusMode, segments]);

  function addSegment(speaker: Speaker): TranscriptSegment {
    const nextSegment = emptySegment(speaker);
    onSegmentsChange([...segments, nextSegment]);
    requestAnimationFrame(() => refs.current[nextSegment.id]?.focus());
    return nextSegment;
  }

  function updateSegment(id: string, patch: Partial<TranscriptSegment>) {
    onSegmentsChange(
      segments.map((segment) => (segment.id === id ? { ...segment, ...patch } : segment)),
    );
  }

  function deleteSegment(id: string) {
    onSegmentsChange(segments.filter((segment) => segment.id !== id));
  }

  function focusOtherColumn(speaker: Speaker) {
    const otherSpeaker = speaker === "client" ? "therapist" : "client";
    const target =
      [...segments].reverse().find(
        (segment) => segment.speaker === otherSpeaker && !segment.text.trim(),
      ) ?? addSegment(otherSpeaker);
    requestAnimationFrame(() => refs.current[target.id]?.focus());
  }

  return (
    <div className="worksheet-grid speaker-editor-grid">
      {SPEAKERS.map((speaker) => {
        const speakerSegments = segments.filter((segment) => segment.speaker === speaker);
        return (
          <section key={speaker} className="worksheet-field speaker-column">
            <div className="rs-eyebrow speaker-column-header">{speakerLabel(speaker)}</div>
            <div className="speaker-segment-list">
              {speakerSegments.map((segment) => (
                <div key={segment.id} className="segment-row">
                  <input
                    aria-label={`${speakerLabel(speaker)}时间戳`}
                    className="segment-timestamp"
                    placeholder="00:00:00"
                    value={segment.timestamp ?? ""}
                    onChange={(event) => updateSegment(segment.id, { timestamp: event.target.value })}
                  />
                  <textarea
                    ref={(element) => {
                      refs.current[segment.id] = element;
                    }}
                    aria-label={`${speakerLabel(speaker)}发言`}
                    className="segment-textarea"
                    value={segment.text}
                    onChange={(event) => {
                      updateSegment(segment.id, { text: event.target.value });
                      autoResize(event.currentTarget);
                    }}
                    onKeyDown={(event) => {
                      const target = event.currentTarget;
                      if (event.key === "Enter" && target.selectionStart === target.value.length) {
                        event.preventDefault();
                        addSegment(speaker);
                      }
                      if (event.key === "Tab") {
                        event.preventDefault();
                        focusOtherColumn(speaker);
                      }
                    }}
                  />
                  <button
                    aria-label="删除"
                    className="danger-btn segment-delete-btn"
                    onClick={() => deleteSegment(segment.id)}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
            <button className="btn ghost sm add-segment-btn" onClick={() => addSegment(speaker)} type="button">
              + 添加发言
            </button>
          </section>
        );
      })}
    </div>
  );
}
