import type { SubmittedTranscriptEntry } from "./sessionText.types";
import { segmentsToAnalysisText } from "./sessionText.utils";

export type TimelineSessionCandidate = {
  session_id: string;
  source_text: string;
  created_at: string;
};

export type TimelineLinkResult = {
  entries: SubmittedTranscriptEntry[];
  changed: boolean;
};

function normalizeTranscriptText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTimestamp(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function assignSession(
  entries: SubmittedTranscriptEntry[],
  entryId: string,
  sessionId: string,
): SubmittedTranscriptEntry[] {
  return entries.map((entry) => (entry.entryId === entryId ? { ...entry, sessionId } : entry));
}

export function linkTimelineEntriesToSessions({
  entries,
  sessions,
  currentAnalysisSessionId,
  currentAnalyzedText,
}: {
  entries: SubmittedTranscriptEntry[];
  sessions: TimelineSessionCandidate[];
  currentAnalysisSessionId?: string | null;
  currentAnalyzedText?: string | null;
}): TimelineLinkResult {
  let nextEntries = entries;
  let changed = false;

  if (currentAnalysisSessionId && currentAnalyzedText?.trim()) {
    const normalizedCurrentText = normalizeTranscriptText(currentAnalyzedText);
    const matchedEntries = nextEntries.filter(
      (entry) => normalizeTranscriptText(segmentsToAnalysisText(entry.segments)) === normalizedCurrentText,
    );
    if (matchedEntries.length === 1 && matchedEntries[0].sessionId !== currentAnalysisSessionId) {
      nextEntries = assignSession(nextEntries, matchedEntries[0].entryId, currentAnalysisSessionId);
      changed = true;
    }
  }

  if (sessions.length === 0 || nextEntries.every((entry) => entry.sessionId)) {
    return { entries: nextEntries, changed };
  }

  const chronologicalSessions = [...sessions].sort((left, right) =>
    left.created_at.localeCompare(right.created_at),
  );
  const assignedSessionIds = new Set(
    nextEntries
      .map((entry) => entry.sessionId)
      .filter((sessionId): sessionId is string => Boolean(sessionId)),
  );
  let unresolvedSessions = chronologicalSessions.filter(
    (session) => !assignedSessionIds.has(session.session_id),
  );

  nextEntries = nextEntries.map((entry) => {
    if (entry.sessionId) {
      return entry;
    }

    const entrySubmittedAt = normalizeTimestamp(entry.submittedAt);
    if (entrySubmittedAt !== null) {
      const matchedBySubmittedAt = unresolvedSessions.filter(
        (session) => normalizeTimestamp(session.created_at) === entrySubmittedAt,
      );
      if (matchedBySubmittedAt.length === 1) {
        unresolvedSessions = unresolvedSessions.filter(
          (session) => session.session_id !== matchedBySubmittedAt[0].session_id,
        );
        changed = true;
        return { ...entry, sessionId: matchedBySubmittedAt[0].session_id };
      }
    }

    const normalizedEntryText = normalizeTranscriptText(segmentsToAnalysisText(entry.segments));
    if (!normalizedEntryText) {
      return entry;
    }

    const matchedSessions = unresolvedSessions.filter(
      (session) => normalizeTranscriptText(session.source_text) === normalizedEntryText,
    );
    if (matchedSessions.length !== 1) {
      return entry;
    }

    unresolvedSessions = unresolvedSessions.filter(
      (session) => session.session_id !== matchedSessions[0].session_id,
    );
    changed = true;
    return { ...entry, sessionId: matchedSessions[0].session_id };
  });

  const chronologicalUnresolvedEntries = nextEntries
    .filter((entry) => !entry.sessionId)
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
  const pairCount = Math.min(chronologicalUnresolvedEntries.length, unresolvedSessions.length);
  if (pairCount === 0) {
    return { entries: nextEntries, changed };
  }

  const entrySessionPairs = new Map<string, string>();
  for (let index = 0; index < pairCount; index += 1) {
    entrySessionPairs.set(chronologicalUnresolvedEntries[index].entryId, unresolvedSessions[index].session_id);
  }

  nextEntries = nextEntries.map((entry) => {
    const sessionId = entrySessionPairs.get(entry.entryId);
    if (!sessionId) {
      return entry;
    }
    changed = true;
    return { ...entry, sessionId };
  });

  return { entries: nextEntries, changed };
}
