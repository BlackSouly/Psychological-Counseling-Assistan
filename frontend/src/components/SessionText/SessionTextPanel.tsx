import { useEffect, useMemo, useState } from "react";

import { ImportToolbar } from "./ImportToolbar";
import { PlainTextEditor } from "./PlainTextEditor";
import { SpeakerSegmentEditor } from "./SpeakerSegmentEditor";
import { TranscriptViewer } from "./TranscriptViewer";
import {
  buildSegmentChunks,
  createInitialSessionTextState,
  createTimelineEntryFromDraft,
  createTranscriptSegment,
  getAnalysisText,
  getTimelineSegments,
  getTotalCharacterCount,
  hasSessionTextContent,
  loadSessionTextState,
  nextAppendSpeaker,
  parseSpeakerPrefixedText,
  parsedLinesToSegments,
  saveSessionTextState,
  segmentsToAnalysisText,
  timelineEntryToDraft,
} from "./sessionText.utils";
import type {
  Annotation,
  InputMode,
  PinnedQuote,
  SessionTextState,
  SubmittedTranscriptEntry,
  TranscriptSegment,
} from "./sessionText.types";
import { linkTimelineEntriesToSessions } from "./timelineLinking";
import type { TimelineSessionCandidate } from "./timelineLinking";
import type { SessionRecord } from "../../types";

type SessionTextPanelProps = {
  clientCode: string | null;
  currentAnalysisLabel?: string | null;
  currentAnalysisSessionId?: string | null;
  currentAnalyzedText?: string | null;
  isAnalyzing: boolean;
  onAnalyze?: (sourceText: string) => Promise<SessionRecord | void>;
  onPinnedQuotesChange?: (pinnedQuotes: PinnedQuote[]) => void;
  onSelectTimelineEntry?: (sessionId: string) => Promise<void> | void;
  timelineSessionCandidates?: TimelineSessionCandidate[];
  seedSessionId?: string;
  seedSourceText?: string;
  seedSubmittedAt?: string;
};

type ReturnToEditorMode = "edit" | "append";

const MAX_CHUNK_LENGTH = 3000;

function defaultSessionId(clientCode: string | null): string {
  return clientCode ? `draft:${clientCode}` : "draft:unassigned";
}

function createSubmitEvent(state: SessionTextState) {
  return new CustomEvent<SessionTextState>("sessiontext:submit", {
    detail: state,
  });
}

export function SessionTextPanel({
  clientCode,
  currentAnalysisLabel,
  currentAnalysisSessionId,
  currentAnalyzedText,
  isAnalyzing,
  onAnalyze,
  onPinnedQuotesChange,
  onSelectTimelineEntry,
  timelineSessionCandidates = [],
  seedSessionId,
  seedSourceText,
  seedSubmittedAt,
}: SessionTextPanelProps) {
  const sessionId = defaultSessionId(clientCode);
  const [state, setState] = useState<SessionTextState>(() => {
    if (typeof window === "undefined") {
      return createInitialSessionTextState(sessionId);
    }
    return loadSessionTextState(sessionId);
  });
  const [detectedSegments, setDetectedSegments] = useState<TranscriptSegment[]>([]);
  const [showDetectionBanner, setShowDetectionBanner] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState("");
  const [progressLabel, setProgressLabel] = useState("");
  const [failedChunk, setFailedChunk] = useState<number | null>(null);
  const [returnToEditorMode, setReturnToEditorMode] = useState<ReturnToEditorMode>("edit");
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
  const [highlightPlainAppend, setHighlightPlainAppend] = useState(false);

  useEffect(() => {
    setState(loadSessionTextState(sessionId));
    setDetectedSegments([]);
    setShowDetectionBanner(false);
    setReturnToEditorMode("edit");
    setHighlightedSegmentId(null);
    setHighlightPlainAppend(false);
  }, [sessionId]);

  useEffect(() => {
    if (!seedSourceText?.trim()) {
      return;
    }
    if (state.timelineEntries.length > 0 || state.plainText.trim() || state.segments.some((segment) => segment.text.trim())) {
      return;
    }
    const parsed = parseSpeakerPrefixedText(seedSourceText);
    const nextInputMode: InputMode = parsed.shouldSuggestSplit ? "split" : "plain";
    const nextSegments = parsed.shouldSuggestSplit
      ? parsedLinesToSegments(parsed.parsedLines)
      : [
          {
            id: "seed_plain_text_segment",
            speaker: "client" as const,
            text: seedSourceText.trim(),
          },
        ];
    const submittedAt = seedSubmittedAt ?? new Date().toISOString();
    updateState({
      inputMode: nextInputMode,
      timelineEntries: [
        {
          entryId: "seed_timeline_entry",
          inputMode: nextInputMode,
          segments: nextSegments,
          sessionId: seedSessionId,
          submittedAt,
        },
      ],
      plainText: "",
      segments: [],
      analysisSubmittedAt: submittedAt,
    });
  }, [
    seedSessionId,
    seedSourceText,
    seedSubmittedAt,
    state.plainText,
    state.segments,
    state.timelineEntries,
  ]);

  useEffect(() => {
    const linkResult = linkTimelineEntriesToSessions({
      entries: state.timelineEntries,
      sessions: timelineSessionCandidates,
      currentAnalysisSessionId,
      currentAnalyzedText,
    });
    if (linkResult.changed) {
      updateState({ timelineEntries: linkResult.entries });
    }
  }, [currentAnalyzedText, currentAnalysisSessionId, state.timelineEntries, timelineSessionCandidates]);

  useEffect(() => {
    onPinnedQuotesChange?.(state.pinnedQuotes);
  }, [onPinnedQuotesChange, state.pinnedQuotes]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const lastSavedAt = new Date().toISOString();
      const nextState = { ...state, lastSavedAt };
      saveSessionTextState(nextState);
      setState(nextState);
      setSaveLabel(
        `已自动保存 ${new Date(lastSavedAt).toLocaleTimeString("zh-CN", { hour12: false })}`,
      );
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    state.annotations,
    state.editingEntryId,
    state.inputMode,
    state.pinnedQuotes,
    state.plainText,
    state.segments,
    state.sessionId,
    state.timelineEntries,
    state.analysisSubmittedAt,
  ]);

  useEffect(() => {
    if (!fileError) {
      return;
    }
    const timer = window.setTimeout(() => setFileError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [fileError]);

  useEffect(() => {
    if (!highlightedSegmentId && !highlightPlainAppend) {
      return;
    }
    const timer = window.setTimeout(() => {
      setHighlightedSegmentId(null);
      setHighlightPlainAppend(false);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [highlightPlainAppend, highlightedSegmentId]);

  const canSubmit = useMemo(() => hasSessionTextContent(state), [state]);
  const isLongText = getTotalCharacterCount(state) > MAX_CHUNK_LENGTH;
  const latestTimelineEntry = state.timelineEntries[state.timelineEntries.length - 1] ?? null;

  function updateState(patch: Partial<SessionTextState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function updateTimelineEntry(
    entryId: string,
    updater: (entry: SubmittedTranscriptEntry) => SubmittedTranscriptEntry,
  ) {
    setState((current) => ({
      ...current,
      timelineEntries: current.timelineEntries.map((entry) =>
        entry.entryId === entryId ? updater(entry) : entry,
      ),
    }));
  }

  function clearAppendHighlight() {
    setHighlightedSegmentId(null);
    setHighlightPlainAppend(false);
  }

  function clearDraft() {
    return state.inputMode === "split"
      ? { plainText: "", segments: [] as TranscriptSegment[] }
      : { plainText: "", segments: [] as TranscriptSegment[] };
  }

  function handleModeChange(inputMode: InputMode) {
    clearAppendHighlight();
    updateState({ inputMode });
  }

  function handleImportedText(text: string) {
    const parsed = parseSpeakerPrefixedText(text);
    clearAppendHighlight();
    if (parsed.shouldSuggestSplit) {
      updateState({
        inputMode: "split",
        plainText: "",
        segments: parsedLinesToSegments(parsed.parsedLines),
        analysisSubmittedAt: undefined,
        editingEntryId: undefined,
      });
      setShowDetectionBanner(false);
      return;
    }
    updateState({
      inputMode: "plain",
      plainText: text,
      segments: [],
      analysisSubmittedAt: undefined,
      editingEntryId: undefined,
    });
  }

  async function submitOneText(text: string, submittedState: SessionTextState) {
    if (onAnalyze) {
      return onAnalyze(text);
    }
    window.dispatchEvent(createSubmitEvent(submittedState));
    return undefined;
  }

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    const submittedAt = new Date().toISOString();
    const entryId = state.editingEntryId ?? undefined;
    const nextEntry = createTimelineEntryFromDraft(state, submittedAt, entryId);
    const nextTimelineEntries = state.editingEntryId
      ? state.timelineEntries.map((entry) =>
          entry.entryId === state.editingEntryId ? nextEntry : entry,
        )
      : [...state.timelineEntries, nextEntry];

    const submittedState: SessionTextState = {
      ...state,
      timelineEntries: nextTimelineEntries,
      editingEntryId: undefined,
      analysisSubmittedAt: submittedAt,
      ...clearDraft(),
    };

    setState(submittedState);
    setFailedChunk(null);
    clearAppendHighlight();

    if (isLongText && state.inputMode === "split") {
      const chunks = buildSegmentChunks(nextEntry.segments, MAX_CHUNK_LENGTH);
      for (let index = 0; index < chunks.length; index += 1) {
        setProgressLabel(`正在分析第 ${index + 1} / ${chunks.length} 段...`);
        try {
          await submitOneText(segmentsToAnalysisText(chunks[index]), submittedState);
        } catch {
          setFailedChunk(index + 1);
          setProgressLabel("");
          return;
        }
      }
      setProgressLabel("");
      return;
    }

    const createdSession = await submitOneText(
      state.inputMode === "split" ? segmentsToAnalysisText(nextEntry.segments) : getAnalysisText(state),
      submittedState,
    );
    if (createdSession?.session_id) {
      updateTimelineEntry(nextEntry.entryId, (entry) => ({
        ...entry,
        sessionId: createdSession.session_id,
      }));
    }
  }

  function handlePlainTextChange(plainText: string) {
    updateState({ plainText });
  }

  function handleDetectedSegments(segments: TranscriptSegment[]) {
    setDetectedSegments(segments);
    setShowDetectionBanner(true);
  }

  function switchToSplit(segments: TranscriptSegment[]) {
    clearAppendHighlight();
    updateState({
      inputMode: "split",
      plainText: "",
      segments,
    });
    setShowDetectionBanner(false);
  }

  function handleEditLatest() {
    if (!latestTimelineEntry) {
      return;
    }
    setReturnToEditorMode("edit");
    clearAppendHighlight();
    updateState({
      ...timelineEntryToDraft(latestTimelineEntry),
      analysisSubmittedAt: undefined,
      editingEntryId: latestTimelineEntry.entryId,
    });
  }

  function handleAppend() {
    setReturnToEditorMode("append");
    clearAppendHighlight();

    if (state.inputMode === "split") {
      const nextSegment = createTranscriptSegment(nextAppendSpeaker(getTimelineSegments(state.timelineEntries)));
      setHighlightedSegmentId(nextSegment.id);
      updateState({
        analysisSubmittedAt: undefined,
        editingEntryId: undefined,
        plainText: "",
        segments: [nextSegment],
      });
      return;
    }

    setHighlightPlainAppend(true);
    updateState({
      analysisSubmittedAt: undefined,
      editingEntryId: undefined,
      plainText: "",
      segments: [],
    });
  }

  return (
    <section className="session-text-panel">
      <ImportToolbar
        canSubmit={canSubmit}
        disabled={isAnalyzing}
        inputMode={state.inputMode}
        onImportError={(message) => setFileError(message)}
        onImportedText={handleImportedText}
        onModeChange={handleModeChange}
        onSubmit={() => void handleSubmit()}
      />
      {fileError ? <div className="file-import-error">{fileError}</div> : null}
      {isLongText ? (
        <div className="analysis-progress-bar">
          当前文本较长，将分段提交分析；结果会按顺序逐段返回。
        </div>
      ) : null}
      {progressLabel ? <div className="analysis-progress-bar">{progressLabel}</div> : null}
      {failedChunk ? (
        <div className="file-import-error">
          第 {failedChunk} 段分析失败，可直接重试当前提交。
          <button onClick={() => void handleSubmit()} type="button">
            重试
          </button>
        </div>
      ) : null}

      {state.timelineEntries.length > 0 ? (
        <div className="session-stage session-history-stage">
          <TranscriptViewer
            annotations={state.annotations}
            currentAnalysisLabel={currentAnalysisLabel}
            currentAnalysisSessionId={currentAnalysisSessionId}
            currentAnalyzedText={currentAnalyzedText}
            pinnedQuotes={state.pinnedQuotes}
            timelineEntries={state.timelineEntries}
            onAnnotationsChange={(annotations: Annotation[]) => updateState({ annotations })}
            onAppend={handleAppend}
            onEdit={handleEditLatest}
            onPinnedQuotesChange={(pinnedQuotes: PinnedQuote[]) => updateState({ pinnedQuotes })}
            onSelectEntry={onSelectTimelineEntry}
          />
        </div>
      ) : null}

      {!state.analysisSubmittedAt ? (
        <div className="session-stage session-draft-stage">
          <div className="session-stage-head">
            <div>
              <div className="rs-eyebrow">CURRENT DRAFT</div>
              <div className="session-stage-title">
                {state.editingEntryId ? "正在编辑最近一段" : "当前补充内容"}
              </div>
            </div>
            <div className="session-stage-meta">
              {state.editingEntryId ? "修改后会覆盖最近一次提交" : "提交后会追加到时间线末尾"}
            </div>
          </div>
          {state.inputMode === "plain" ? (
            <PlainTextEditor
              autoFocusMode={returnToEditorMode}
              clientCode={clientCode}
              detectedSegments={detectedSegments}
              highlightAppend={highlightPlainAppend}
              plainText={state.plainText}
              showDetectionBanner={showDetectionBanner}
              onDetectedSegments={handleDetectedSegments}
              onDismissDetection={() => setShowDetectionBanner(false)}
              onPlainTextChange={handlePlainTextChange}
              onSwitchToSplit={switchToSplit}
            />
          ) : (
            <SpeakerSegmentEditor
              autoFocusMode={returnToEditorMode}
              highlightedSegmentId={highlightedSegmentId}
              segments={state.segments}
              onSegmentsChange={(segments) => updateState({ segments })}
            />
          )}
        </div>
      ) : null}

      {saveLabel ? <div className="autosave-indicator">{saveLabel}</div> : null}
    </section>
  );
}
