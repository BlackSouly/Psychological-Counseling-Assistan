import { useMemo, useState } from "react";

import { ANNOTATION_COLORS, AnnotationLayer } from "./AnnotationLayer";
import { PinnedQuoteList } from "./PinnedQuoteList";
import { createId, segmentsToAnalysisText, speakerLabel } from "./sessionText.utils";
import type {
  Annotation,
  AnnotationColor,
  PinnedQuote,
  SubmittedTranscriptEntry,
  TranscriptSegment,
} from "./sessionText.types";

type TranscriptViewerProps = {
  annotations: Annotation[];
  currentAnalysisLabel?: string | null;
  currentAnalysisSessionId?: string | null;
  currentAnalyzedText?: string | null;
  pinnedQuotes: PinnedQuote[];
  timelineEntries: SubmittedTranscriptEntry[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  onAppend: () => void;
  onEdit: () => void;
  onPinnedQuotesChange: (quotes: PinnedQuote[]) => void;
  onSelectEntry?: (sessionId: string) => Promise<void> | void;
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

function formatSubmittedAt(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeTranscriptText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function TranscriptViewer({
  annotations,
  currentAnalysisLabel,
  currentAnalysisSessionId,
  currentAnalyzedText,
  pinnedQuotes,
  timelineEntries,
  onAnnotationsChange,
  onAppend,
  onEdit,
  onPinnedQuotesChange,
  onSelectEntry,
}: TranscriptViewerProps) {
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const visibleEntries = useMemo(
    () => timelineEntries.filter((entry) => entry.segments.some((segment) => segment.text.trim())),
    [timelineEntries],
  );

  const entryOrderMap = useMemo(
    () => new Map(visibleEntries.map((entry, index) => [entry.entryId, index + 1])),
    [visibleEntries],
  );

  const sortedEntries = useMemo(
    () => [...visibleEntries].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)),
    [visibleEntries],
  );

  const currentAnalyzedEntryId = useMemo(() => {
    if (currentAnalysisSessionId) {
      const matchedBySessionId = visibleEntries.find(
        (entry) => entry.sessionId === currentAnalysisSessionId,
      );
      if (matchedBySessionId) {
        return matchedBySessionId.entryId;
      }
    }

    if (!currentAnalyzedText?.trim()) {
      return null;
    }

    const normalizedCurrent = normalizeTranscriptText(currentAnalyzedText);
    const matchedEntry = visibleEntries.find(
      (entry) => normalizeTranscriptText(segmentsToAnalysisText(entry.segments)) === normalizedCurrent,
    );
    return matchedEntry?.entryId ?? null;
  }, [currentAnalysisSessionId, currentAnalyzedText, visibleEntries]);

  const allSegments = useMemo(
    () => sortedEntries.flatMap((entry) => entry.segments),
    [sortedEntries],
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

    const segment = allSegments.find((item) => item.id === activeAnnotation.segmentId);
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
          <div className="rs-title">会谈时间线</div>
        </div>
        <div className="transcript-viewer-actions">
          <button className="btn ghost sm transcript-append-btn" onClick={onAppend} type="button">
            补充内容
          </button>
        </div>
      </div>

      <div className="transcript-timeline">
        {sortedEntries.map((entry, index) => {
          const isCurrentEntry = entry.entryId === currentAnalyzedEntryId;
          const isSelectable = Boolean(entry.sessionId && !isCurrentEntry);

          return (
            <section key={entry.entryId} className="transcript-timeline-entry">
              <div className="transcript-timeline-node" aria-hidden="true" />
              <div
                className={
                  isCurrentEntry
                    ? "transcript-timeline-card transcript-timeline-card-current"
                    : "transcript-timeline-card"
                }
                onClick={() => {
                  if (!entry.sessionId || isCurrentEntry) {
                    return;
                  }
                  onSelectEntry?.(entry.sessionId);
                }}
                onKeyDown={(event) => {
                  if (!entry.sessionId || isCurrentEntry) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectEntry?.(entry.sessionId);
                  }
                }}
                role={isSelectable ? "button" : undefined}
                tabIndex={isSelectable ? 0 : undefined}
              >
                <div className="transcript-timeline-entry-head">
                  <div className="transcript-timeline-entry-head-main">
                    <div className="transcript-timeline-entry-label">
                      第 {entryOrderMap.get(entry.entryId) ?? index + 1} 次提交
                    </div>
                    <div className="transcript-timeline-entry-time">
                      {formatSubmittedAt(entry.submittedAt)}
                    </div>
                  </div>
                  <div className="transcript-timeline-entry-actions">
                    {isCurrentEntry ? (
                      <span className="pill accent transcript-current-badge">
                        {currentAnalysisLabel ? `${currentAnalysisLabel} · 当前分析` : "当前分析"}
                      </span>
                    ) : entry.sessionId ? (
                      <span className="history-chip transcript-select-chip">查看这次分析</span>
                    ) : null}
                    {index === 0 ? (
                      <button
                        className="history-chip transcript-edit-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEdit();
                        }}
                        type="button"
                      >
                        修订这一段
                      </button>
                    ) : null}
                  </div>
                </div>
                <ul className="insight-list transcript-segment-list">
                  {entry.segments.map((segment: TranscriptSegment) => (
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
              </div>
            </section>
          );
        })}
      </div>

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
              固定到关键句
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
