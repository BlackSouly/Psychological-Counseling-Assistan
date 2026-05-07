import type { SessionSummary } from "../types";

type TimelinePanelProps = {
  sessions: SessionSummary[];
  onSelectSession: (sessionId: string) => void;
};

export function TimelinePanel({ sessions, onSelectSession }: TimelinePanelProps) {
  return (
    <section className="timeline-panel">
      <div className="panel-header">
        <div className="panel-kicker">History</div>
        <h2>时间线</h2>
      </div>
      <div className="timeline-summary">
        <span className="timeline-summary-label">已保存记录</span>
        <strong className="timeline-summary-value">{sessions.length}</strong>
      </div>
      {sessions.length === 0 ? (
        <p>还没有保存的会谈记录。</p>
      ) : (
        <ul className="timeline-list">
          {sessions.map((session) => (
            <li key={session.session_id} className="timeline-item">
              <button className="timeline-button" onClick={() => onSelectSession(session.session_id)} type="button">
                <div className="timeline-row">
                  <p>{session.created_at}</p>
                  <span className={`timeline-risk timeline-risk-${session.risk_level}`}>{session.risk_level}</span>
                </div>
                <p>{session.source_text}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
