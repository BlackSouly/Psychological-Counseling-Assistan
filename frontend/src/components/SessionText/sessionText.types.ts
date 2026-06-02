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

export interface SessionTextState {
  sessionId: string;
  inputMode: InputMode;
  segments: TranscriptSegment[];
  plainText: string;
  annotations: Annotation[];
  pinnedQuotes: PinnedQuote[];
  lastSavedAt?: string;
  analysisSubmittedAt?: string;
}

export type ParsedLine = {
  speaker: Speaker;
  text: string;
};
