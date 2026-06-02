import type { ParsedLine, SessionTextState, Speaker, TranscriptSegment } from "./sessionText.types";

const CLIENT_PREFIX = /^(来访者|C|CP)\s*[:：]\s*/i;
const THERAPIST_PREFIX = /^(咨询师|T|TP)\s*[:：]\s*/i;

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function storageKey(sessionId: string): string {
  return `sessionText:${sessionId}`;
}

export function createInitialSessionTextState(sessionId: string): SessionTextState {
  return {
    sessionId,
    inputMode: "plain",
    segments: [],
    plainText: "",
    annotations: [],
    pinnedQuotes: [],
  };
}

export function isSessionTextState(value: unknown): value is SessionTextState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<SessionTextState>;
  return (
    typeof candidate.sessionId === "string" &&
    (candidate.inputMode === "split" || candidate.inputMode === "plain") &&
    Array.isArray(candidate.segments) &&
    typeof candidate.plainText === "string" &&
    Array.isArray(candidate.annotations) &&
    Array.isArray(candidate.pinnedQuotes)
  );
}

export function loadSessionTextState(sessionId: string): SessionTextState {
  const stored = window.localStorage.getItem(storageKey(sessionId));
  if (!stored) {
    return createInitialSessionTextState(sessionId);
  }
  const parsed = JSON.parse(stored) as unknown;
  if (!isSessionTextState(parsed) || parsed.sessionId !== sessionId) {
    return createInitialSessionTextState(sessionId);
  }
  return parsed;
}

export function saveSessionTextState(state: SessionTextState): void {
  window.localStorage.setItem(storageKey(state.sessionId), JSON.stringify(state));
}

export function detectSpeakerLine(line: string): ParsedLine | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  if (CLIENT_PREFIX.test(trimmed)) {
    return { speaker: "client", text: trimmed.replace(CLIENT_PREFIX, "").trim() };
  }
  if (THERAPIST_PREFIX.test(trimmed)) {
    return { speaker: "therapist", text: trimmed.replace(THERAPIST_PREFIX, "").trim() };
  }
  return null;
}

export function parseSpeakerPrefixedText(text: string): {
  shouldSuggestSplit: boolean;
  parsedLines: ParsedLine[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { shouldSuggestSplit: false, parsedLines: [] };
  }
  const parsedLines = lines.map(detectSpeakerLine).filter((line): line is ParsedLine => Boolean(line));
  return {
    shouldSuggestSplit: parsedLines.length / lines.length >= 0.3,
    parsedLines,
  };
}

export function parsedLinesToSegments(parsedLines: ParsedLine[]): TranscriptSegment[] {
  return parsedLines.map((line) => ({
    id: createId("segment"),
    speaker: line.speaker,
    text: line.text,
  }));
}

export function segmentsToAnalysisText(segments: TranscriptSegment[]): string {
  return segments
    .filter((segment) => segment.text.trim())
    .map((segment) => {
      const speaker = segment.speaker === "client" ? "来访者" : "咨询师";
      const time = segment.timestamp?.trim() ? ` ${segment.timestamp.trim()}` : "";
      return `${speaker}${time}：${segment.text.trim()}`;
    })
    .join("\n");
}

export function getAnalysisText(state: SessionTextState): string {
  if (state.inputMode === "plain") {
    return state.plainText.trim();
  }
  return segmentsToAnalysisText(state.segments);
}

export function hasSessionTextContent(state: SessionTextState): boolean {
  return state.plainText.trim().length > 0 || state.segments.some((segment) => segment.text.trim());
}

export function getTotalCharacterCount(state: SessionTextState): number {
  if (state.inputMode === "plain") {
    return state.plainText.trim().length;
  }
  return state.segments.reduce((total, segment) => total + segment.text.trim().length, 0);
}

export function buildSegmentChunks(
  segments: TranscriptSegment[],
  maxCharacters: number,
): TranscriptSegment[][] {
  const chunks: TranscriptSegment[][] = [];
  let current: TranscriptSegment[] = [];
  let currentLength = 0;

  segments
    .filter((segment) => segment.text.trim())
    .forEach((segment) => {
      const length = segment.text.trim().length;
      if (current.length > 0 && currentLength + length > maxCharacters) {
        chunks.push(current);
        current = [];
        currentLength = 0;
      }
      current.push(segment);
      currentLength += length;
    });

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export function speakerLabel(speaker: Speaker): string {
  return speaker === "client" ? "来访者" : "咨询师";
}
