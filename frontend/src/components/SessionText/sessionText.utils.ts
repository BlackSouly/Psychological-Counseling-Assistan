import type {
  InputMode,
  ParsedLine,
  SessionTextState,
  Speaker,
  SubmittedTranscriptEntry,
  TranscriptSegment,
} from "./sessionText.types";

const CLIENT_PREFIX = /^(来访者|来访|CP|C)\s*[:：]?\s*/i;
const THERAPIST_PREFIX = /^(咨询师|咨询|TP|T)\s*[:：]?\s*/i;

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
    timelineEntries: [],
    annotations: [],
    pinnedQuotes: [],
  };
}

type LegacySessionTextState = Omit<SessionTextState, "timelineEntries"> & {
  timelineEntries?: SubmittedTranscriptEntry[];
};

function migrateLegacySessionTextState(
  sessionId: string,
  candidate: LegacySessionTextState,
): SessionTextState {
  const baseState = createInitialSessionTextState(sessionId);
  const migratedTimelineEntries =
    candidate.timelineEntries && candidate.timelineEntries.length > 0
      ? candidate.timelineEntries
      : candidate.analysisSubmittedAt
        ? [
            createTimelineEntryFromDraft(
              {
                inputMode: candidate.inputMode ?? "plain",
                plainText: candidate.plainText ?? "",
                segments: Array.isArray(candidate.segments) ? candidate.segments : [],
              },
              candidate.analysisSubmittedAt,
            ),
          ].filter((entry) => entry.segments.length > 0)
        : [];

  const shouldKeepDraft =
    !candidate.analysisSubmittedAt &&
    (candidate.plainText?.trim() || candidate.segments?.some((segment) => segment.text?.trim()));

  return {
    ...baseState,
    ...candidate,
    sessionId,
    timelineEntries: migratedTimelineEntries,
    plainText: shouldKeepDraft ? candidate.plainText ?? "" : "",
    segments: shouldKeepDraft && Array.isArray(candidate.segments) ? candidate.segments : [],
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
    Array.isArray(candidate.timelineEntries) &&
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
  if (!parsed || typeof parsed !== "object") {
    return createInitialSessionTextState(sessionId);
  }
  const candidate = parsed as LegacySessionTextState;
  if (candidate.sessionId !== sessionId) {
    return createInitialSessionTextState(sessionId);
  }
  const migrated = migrateLegacySessionTextState(sessionId, candidate);
  if (!isSessionTextState(migrated)) {
    return createInitialSessionTextState(sessionId);
  }
  return migrated;
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
  const parsedLines = lines
    .map(detectSpeakerLine)
    .filter((line): line is ParsedLine => Boolean(line));
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

export function createTranscriptSegment(speaker: Speaker): TranscriptSegment {
  return {
    id: createId("segment"),
    speaker,
    text: "",
  };
}

export function cloneSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.map((segment) => ({ ...segment }));
}

export function nextAppendSpeaker(segments: TranscriptSegment[]): Speaker {
  const lastFilledSegment = [...segments].reverse().find((segment) => segment.text.trim());
  if (!lastFilledSegment) {
    return "client";
  }
  return lastFilledSegment.speaker === "client" ? "therapist" : "client";
}

export function normalizeDraftSegments(
  inputMode: InputMode,
  plainText: string,
  segments: TranscriptSegment[],
): TranscriptSegment[] {
  if (inputMode === "split") {
    return cloneSegments(segments.filter((segment) => segment.text.trim()));
  }
  const trimmed = plainText.trim();
  if (!trimmed) {
    return [];
  }
  return [
    {
      id: createId("segment"),
      speaker: "client",
      text: trimmed,
    },
  ];
}

export function createTimelineEntryFromDraft(
  state: Pick<SessionTextState, "inputMode" | "plainText" | "segments">,
  submittedAt: string,
  entryId = createId("timeline"),
): SubmittedTranscriptEntry {
  return {
    entryId,
    inputMode: state.inputMode,
    segments: normalizeDraftSegments(state.inputMode, state.plainText, state.segments),
    submittedAt,
  };
}

export function timelineEntryToDraft(
  entry: SubmittedTranscriptEntry,
): Pick<SessionTextState, "inputMode" | "plainText" | "segments"> {
  if (entry.inputMode === "plain") {
    return {
      inputMode: "plain",
      plainText: entry.segments.map((segment) => segment.text).join("\n"),
      segments: [],
    };
  }
  return {
    inputMode: "split",
    plainText: "",
    segments: cloneSegments(entry.segments),
  };
}

export function getTimelineSegments(entries: SubmittedTranscriptEntry[]): TranscriptSegment[] {
  return entries.flatMap((entry) => entry.segments);
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
  return segmentsToAnalysisText(normalizeDraftSegments(state.inputMode, state.plainText, state.segments));
}

export function hasSessionTextContent(state: SessionTextState): boolean {
  return normalizeDraftSegments(state.inputMode, state.plainText, state.segments).length > 0;
}

export function getTotalCharacterCount(state: SessionTextState): number {
  return normalizeDraftSegments(state.inputMode, state.plainText, state.segments).reduce(
    (total, segment) => total + segment.text.trim().length,
    0,
  );
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
