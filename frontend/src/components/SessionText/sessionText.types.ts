export type Speaker = "client" | "therapist";

export interface TranscriptSegment {
  id: string;
  speaker: Speaker;
  text: string;
  timestamp?: string;
}

export type AnnotationColor = "black" | "red" | "blue";

export interface Annotation {
  id: string;
  segmentId: string;
  startOffset: number;
  endOffset: number;
  color: AnnotationColor;
  note?: string;
  createdAt: string;
}

export interface PinnedQuote {
  id: string;
  segmentId: string;
  text: string;
  speaker: Speaker;
  pinnedAt: string;
  linkedTagIds?: string[];
}

export type InputMode = "split" | "plain";

export interface SubmittedTranscriptEntry {
  entryId: string;
  inputMode: InputMode;
  segments: TranscriptSegment[];
  submittedAt: string;
  sessionId?: string;
}

export interface SessionTextState {
  sessionId: string;
  inputMode: InputMode;
  segments: TranscriptSegment[];
  plainText: string;
  timelineEntries: SubmittedTranscriptEntry[];
  annotations: Annotation[];
  pinnedQuotes: PinnedQuote[];
  editingEntryId?: string;
  lastSavedAt?: string;
  analysisSubmittedAt?: string;
}

export type ParsedLine = {
  speaker: Speaker;
  text: string;
};
