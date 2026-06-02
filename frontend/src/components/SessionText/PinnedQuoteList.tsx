import { useState } from "react";

import { speakerLabel } from "./sessionText.utils";
import type { PinnedQuote } from "./sessionText.types";

type PinnedQuoteListProps = {
  pinnedQuotes: PinnedQuote[];
  onUnpin: (quoteId: string) => void;
};

export function PinnedQuoteList({ pinnedQuotes, onUnpin }: PinnedQuoteListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (pinnedQuotes.length === 0) {
    return null;
  }

  function toggle(quoteId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(quoteId)) {
        next.delete(quoteId);
      } else {
        next.add(quoteId);
      }
      return next;
    });
  }

  return (
    <section className="rs-body pinned-quote-list">
      <div className="rs-head pinned-quote-head">
        <div className="rs-eyebrow">PINNED QUOTES</div>
        <div className="rs-title">关键句</div>
        <span className="pill accent">{pinnedQuotes.length}</span>
      </div>
      <ul className="insight-list pinned-quote-items">
        {pinnedQuotes.map((quote) => (
          <li key={quote.id} className="pinned-quote-row">
            <span className={quote.speaker === "client" ? "pill warn speaker-badge" : "pill muted speaker-badge"}>
              {quote.speaker === "client" ? "来" : "咨"}
            </span>
            <button
              className={expandedIds.has(quote.id) ? "pinned-quote-text expanded" : "pinned-quote-text"}
              onClick={() => toggle(quote.id)}
              type="button"
            >
              <span className="sr-only">{speakerLabel(quote.speaker)}</span>
              {quote.text}
            </button>
            {quote.linkedTagIds?.length ? (
              <div className="pinned-quote-tags">
                {quote.linkedTagIds.map((tagId) => (
                  <span key={tagId} className="tag accent">
                    {tagId}
                  </span>
                ))}
              </div>
            ) : null}
            <button
              aria-label="取消固定"
              className="history-chip pinned-quote-remove"
              onClick={() => onUnpin(quote.id)}
              type="button"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
