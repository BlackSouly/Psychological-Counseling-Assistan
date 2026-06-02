import { useMemo, useState } from "react";

import { ANNOTATION_COLORS, AnnotationLayer } from "./AnnotationLayer";
import { PinnedQuoteList } from "./PinnedQuoteList";
import { createId, speakerLabel } from "./sessionText.utils";
import type {
  Annotation,
  AnnotationColor,
  PinnedQuote,
  TranscriptSegment,
} from "./sessionText.types";

type TranscriptViewerProps = {
  annotations: Annotation[];
  pinnedQuotes: PinnedQuote[];
  segments: TranscriptSegment[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  onAppend: () => void;
  onEdit: () => void;
  onPinnedQuotesChange: (quotes: PinnedQuote[]) => void;
};

type SelectionState = {
  segmentId: string;
  startOffset: number;
  endOffset: number;
  text: string;
};

function getSelectionOffsets(container: HTMLElement): SelectionState | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }
  const segmentId = container.dataset.segmentId;
  if (!segmentId) {
    return null;
  }
  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = preRange.toString().length;
  const text = selection.toString();
  return {
    segmentId,
    startOffset,
    endOffset: startOffset + text.length,
    text,
  };
}

export function TranscriptViewer({
  annotations,
  pinnedQuotes,
  segments,
  onAnnotationsChange,
  onAppend,
  onEdit,
  onPinnedQuotesChange,
}: TranscriptViewerProps) {
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const visibleSegments = useMemo(
    () => segments.filter((segment) => segment.text.trim()),
    [segments],
  );

  function createAnnotation(color: AnnotationColor) {
    if (!selectionState) {
      return;
    }
    const nextAnnotation: Annotation = {
      id: createId("annotation"),
      segmentId: selectionState.segmentId,
      startOffset: selectionState.startOffset,
      endOffset: selectionState.endOffset,
      color,
      createdAt: new Date().toISOString(),
    };
    onAnnotationsChange([...annotations, nextAnnotation]);
    setSelectionState(null);
    window.getSelection()?.removeAllRanges();
  }

  function updateAnnotationNote() {
    if (!activeAnnotation) {
      return;
    }
    onAnnotationsChange(
      annotations.map((annotation) =>
        annotation.id === activeAnnotation.id
          ? { ...annotation, note: noteDraft.slice(0, 200) }
          : annotation,
      ),
    );
    setActiveAnnotation(null);
  }

  function deleteAnnotation() {
    if (!activeAnnotation) {
      return;
    }
    onAnnotationsChange(annotations.filter((annotation) => annotation.id !== activeAnnotation.id));
    setActiveAnnotation(null);
  }

  function pinAnnotation() {
    if (!activeAnnotation) {
      return;
    }
    const segment = segments.find((item) => item.id === activeAnnotation.segmentId);
    if (!segment) {
      return;
    }
    const text = segment.text.slice(activeAnnotation.startOffset, activeAnnotation.endOffset);
    onPinnedQuotesChange([
      ...pinnedQuotes,
      {
        id: createId("pin"),
        segmentId: segment.id,
        text,
        speaker: segment.speaker,
        pinnedAt: new Date().toISOString(),
      },
    ]);
    setActiveAnnotation(null);
  }

  return (
    <div className="transcript-viewer">
      <div className="rs-head transcript-viewer-head">
        <div>
          <div className="rs-eyebrow">TRANSCRIPT</div>
          <div className="rs-title">会话文本</div>
        </div>
        <div className="transcript-viewer-actions">
          <button className="history-chip" onClick={onAppend} type="button">
            补充内容
          </button>
          <button className="history-chip" onClick={onEdit} type="button">
            重新编辑
          </button>
        </div>
      </div>
      <ul className="insight-list transcript-segment-list">
        {visibleSegments.map((segment) => (
          <li key={segment.id} className="transcript-segment-row">
            <span
              className={
                segment.speaker === "client"
                  ? "pill warn speaker-badge"
                  : "pill muted speaker-badge"
              }
            >
              {segment.speaker === "client" ? "来" : "咨"}
            </span>
            <div className="transcript-segment-content">
              <div className="transcript-segment-meta">
                {speakerLabel(segment.speaker)}
                {segment.timestamp ? ` · ${segment.timestamp}` : ""}
              </div>
              <p
                data-segment-id={segment.id}
                onMouseUp={(event) => {
                  setSelectionState(getSelectionOffsets(event.currentTarget));
                  setActiveAnnotation(null);
                }}
              >
                <AnnotationLayer
                  annotations={annotations}
                  segmentId={segment.id}
                  text={segment.text}
                  onAnnotationClick={(annotation) => {
                    setActiveAnnotation(annotation);
                    setNoteDraft(annotation.note ?? "");
                    setSelectionState(null);
                  }}
                />
              </p>
            </div>
          </li>
        ))}
      </ul>
      {selectionState ? (
        <div className="annotation-toolbar" aria-label="标注颜色" role="toolbar">
          {ANNOTATION_COLORS.map((color) => (
            <button
              key={color}
              aria-label={`标注${color}`}
              className={`fb-pill annotation-dot-btn ${color}`}
              onClick={() => createAnnotation(color)}
              type="button"
            >
              <span className="swatch" />
              {color === "black" ? "黑色" : color === "red" ? "红色" : "蓝色"}
            </button>
          ))}
        </div>
      ) : null}
      {activeAnnotation ? (
        <div className="annotation-popover">
          <div className="annotation-popover-head">
            <span className={`annotation-dot ${activeAnnotation.color}`} />
            <span>
              {activeAnnotation.color === "black"
                ? "黑色"
                : activeAnnotation.color === "red"
                  ? "红色"
                  : "蓝色"}
              标注
            </span>
          </div>
          <textarea
            maxLength={200}
            placeholder="添加备注，最多 200 字"
            value={noteDraft}
            onBlur={updateAnnotationNote}
            onChange={(event) => setNoteDraft(event.target.value)}
          />
          <div className="annotation-popover-actions">
            <button className="btn ghost sm" onClick={deleteAnnotation} type="button">
              删除标注
            </button>
            <button className="btn ghost sm" onClick={pinAnnotation} type="button">
              Pin 到关键句
            </button>
          </div>
        </div>
      ) : null}
      <PinnedQuoteList
        pinnedQuotes={pinnedQuotes}
        onUnpin={(quoteId) =>
          onPinnedQuotesChange(pinnedQuotes.filter((quote) => quote.id !== quoteId))
        }
      />
    </div>
  );
}
