import { describe, expect, it } from "vitest";

import type { SubmittedTranscriptEntry, TranscriptSegment } from "../components/SessionText/sessionText.types";
import { segmentsToAnalysisText } from "../components/SessionText/sessionText.utils";
import {
  linkTimelineEntriesToSessions,
  type TimelineSessionCandidate,
} from "../components/SessionText/timelineLinking";

function segment(id: string, text: string): TranscriptSegment {
  return {
    id,
    speaker: "client",
    text,
  };
}

function entry(
  entryId: string,
  text: string,
  submittedAt: string,
  sessionId?: string,
): SubmittedTranscriptEntry {
  return {
    entryId,
    inputMode: "plain",
    segments: [segment(`${entryId}_segment`, text)],
    submittedAt,
    sessionId,
  };
}

function session(
  session_id: string,
  source_text: string,
  created_at: string,
): TimelineSessionCandidate {
  return {
    session_id,
    source_text,
    created_at,
  };
}

describe("linkTimelineEntriesToSessions", () => {
  it("keeps existing timeline links unchanged", () => {
    const entries = [entry("entry_1", "already linked", "2026-06-03T10:00:00Z", "session_1")];

    const result = linkTimelineEntriesToSessions({
      entries,
      sessions: [session("session_1", "different backend text", "2026-06-03T10:00:00Z")],
    });

    expect(result.changed).toBe(false);
    expect(result.entries).toBe(entries);
  });

  it("links the current analysis session to the uniquely matching timeline entry", () => {
    const entries = [
      entry("entry_1", "older content", "2026-06-03T09:00:00Z"),
      entry("entry_2", "current content", "2026-06-03T10:00:00Z"),
    ];
    const currentText = segmentsToAnalysisText(entries[1].segments);

    const result = linkTimelineEntriesToSessions({
      entries,
      sessions: [],
      currentAnalysisSessionId: "session_current",
      currentAnalyzedText: currentText,
    });

    expect(result.changed).toBe(true);
    expect(result.entries[0].sessionId).toBeUndefined();
    expect(result.entries[1].sessionId).toBe("session_current");
  });

  it("links unresolved entries by exact submitted timestamp", () => {
    const entries = [entry("entry_1", "local text", "2026-06-03T10:00:00Z")];

    const result = linkTimelineEntriesToSessions({
      entries,
      sessions: [session("session_1", "backend text can differ", "2026-06-03T10:00:00.000Z")],
    });

    expect(result.changed).toBe(true);
    expect(result.entries[0].sessionId).toBe("session_1");
  });

  it("links unresolved entries by uniquely matching normalized transcript text", () => {
    const entries = [entry("entry_1", "same transcript text", "2026-06-03T09:00:00Z")];

    const result = linkTimelineEntriesToSessions({
      entries,
      sessions: [
        session("session_1", segmentsToAnalysisText(entries[0].segments), "2026-06-03T10:00:00Z"),
      ],
    });

    expect(result.changed).toBe(true);
    expect(result.entries[0].sessionId).toBe("session_1");
  });

  it("reconciles legacy local timelines chronologically when backend has extra sessions", () => {
    const entries = [
      entry("entry_first", "old local text", "2026-06-02T14:47:03Z"),
      entry("entry_current", "current text", "2026-06-03T03:01:40Z", "session_current"),
    ];

    const result = linkTimelineEntriesToSessions({
      entries,
      sessions: [
        session("session_extra", "extra backend record", "2026-06-02T15:29:55Z"),
        session("session_first", "backend text differs", "2026-06-02T14:47:03Z"),
        session("session_current", "current backend record", "2026-06-03T03:01:40Z"),
      ],
    });

    expect(result.changed).toBe(true);
    expect(result.entries[0].sessionId).toBe("session_first");
    expect(result.entries[1].sessionId).toBe("session_current");
  });
});
