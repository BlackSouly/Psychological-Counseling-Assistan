import { useEffect, useMemo, useState } from "react";

import { ImportToolbar } from "./ImportToolbar";
import { PlainTextEditor } from "./PlainTextEditor";
import { SpeakerSegmentEditor } from "./SpeakerSegmentEditor";
import { TranscriptViewer } from "./TranscriptViewer";
import {
  buildSegmentChunks,
  createInitialSessionTextState,
  getAnalysisText,
  getTotalCharacterCount,
  hasSessionTextContent,
  loadSessionTextState,
  parseSpeakerPrefixedText,
  parsedLinesToSegments,
  saveSessionTextState,
  segmentsToAnalysisText,
} from "./sessionText.utils";
import type {
  Annotation,
  InputMode,
  PinnedQuote,
  SessionTextState,
  TranscriptSegment,
} from "./sessionText.types";

type SessionTextPanelProps = {
  clientCode: string | null;
  isAnalyzing: boolean;
  onAnalyze?: (sourceText: string) => Promise<void>;
  onPinnedQuotesChange?: (pinnedQuotes: PinnedQuote[]) => void;
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
  isAnalyzing,
  onAnalyze,
  onPinnedQuotesChange,
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

  useEffect(() => {
    setState(loadSessionTextState(sessionId));
    setDetectedSegments([]);
    setShowDetectionBanner(false);
    setReturnToEditorMode("edit");
  }, [sessionId]);

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
    state.inputMode,
    state.pinnedQuotes,
    state.plainText,
    state.segments,
    state.sessionId,
    state.analysisSubmittedAt,
  ]);

  useEffect(() => {
    if (!fileError) {
      return;
    }
    const timer = window.setTimeout(() => setFileError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [fileError]);

  const canSubmit = useMemo(() => hasSessionTextContent(state), [state]);
  const isLongText = getTotalCharacterCount(state) > MAX_CHUNK_LENGTH;

  function updateState(patch: Partial<SessionTextState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function handleModeChange(inputMode: InputMode) {
    updateState({ inputMode });
  }

  function handleImportedText(text: string) {
    const parsed = parseSpeakerPrefixedText(text);
    if (parsed.shouldSuggestSplit) {
      updateState({
        inputMode: "split",
        plainText: text,
        segments: parsedLinesToSegments(parsed.parsedLines),
      });
      setShowDetectionBanner(false);
      return;
    }
    updateState({ inputMode: "plain", plainText: text });
  }

  async function submitOneText(text: string, submittedState: SessionTextState) {
    if (onAnalyze) {
      await onAnalyze(text);
      return;
    }
    window.dispatchEvent(createSubmitEvent(submittedState));
  }

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    const submittedState = { ...state, analysisSubmittedAt: new Date().toISOString() };
    setState(submittedState);
    setFailedChunk(null);

    if (isLongText && state.inputMode === "split") {
      const chunks = buildSegmentChunks(state.segments, MAX_CHUNK_LENGTH);
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

    await submitOneText(getAnalysisText(submittedState), submittedState);
  }

  function handlePlainTextChange(plainText: string) {
    updateState({ plainText });
  }

  function handleDetectedSegments(segments: TranscriptSegment[]) {
    setDetectedSegments(segments);
    setShowDetectionBanner(true);
  }

  function switchToSplit(segments: TranscriptSegment[]) {
    updateState({ inputMode: "split", segments });
    setShowDetectionBanner(false);
  }

  function handleEdit() {
    setReturnToEditorMode("edit");
    updateState({ analysisSubmittedAt: undefined });
  }

  function handleAppend() {
    setReturnToEditorMode("append");
    updateState({ analysisSubmittedAt: undefined });
  }

  const viewerSegments =
    state.inputMode === "plain"
      ? [
          {
            id: "plain_text_segment",
            speaker: "client" as const,
            text: state.plainText,
          },
        ]
      : state.segments;

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
      {state.analysisSubmittedAt ? (
        <TranscriptViewer
          annotations={state.annotations}
          pinnedQuotes={state.pinnedQuotes}
          segments={viewerSegments}
          onAnnotationsChange={(annotations: Annotation[]) => updateState({ annotations })}
          onAppend={handleAppend}
          onEdit={handleEdit}
          onPinnedQuotesChange={(pinnedQuotes: PinnedQuote[]) => updateState({ pinnedQuotes })}
        />
      ) : state.inputMode === "plain" ? (
        <PlainTextEditor
          autoFocusMode={returnToEditorMode}
          clientCode={clientCode}
          detectedSegments={detectedSegments}
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
          segments={state.segments}
          onSegmentsChange={(segments) => updateState({ segments })}
        />
      )}
      {saveLabel ? <div className="autosave-indicator">{saveLabel}</div> : null}
    </section>
  );
}
