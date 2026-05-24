import type { SessionSummary } from "../types";

type TimelinePanelProps = {
  sessions: SessionSummary[];
  onSelectSession: (sessionId: string) => void;
};

const TEXT_MAP: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  extreme: "极高",
};

function localizeValue(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return TEXT_MAP[value] ?? value;
}

function localizeRiskLevel(level: string): string {
  switch (level) {
    case "urgent":
      return "需复核";
    case "review":
      return "需复核";
    case "none":
      return "无";
    default:
      return level;
  }
}

function riskPillClass(level: string): string {
  if (level === "urgent" || level === "review" || level === "需复核") {
    return "risk";
  }
  return "muted";
}

function formatDate(value: string): string {
  return value.replace("T", " ").replace(/-/g, ":").replace(/Z$/, "");
}

function excerpt(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 64) {
    return normalized || "暂无会谈文本摘要";
  }
  return `${normalized.slice(0, 64)}...`;
}

export function TimelinePanel({ sessions, onSelectSession }: TimelinePanelProps) {
  const sessionsWithRisk = sessions.filter((s) => s.risk_level !== "none").length;
  const sessionsWithWorksheet = sessions.filter((s) => s.has_rebt_worksheet).length;

  return (
    <div className="fade-in">
      <div className="fb-eyebrow" style={{ marginBottom: 10 }}>TIMELINE</div>

      <div className="tl-stat">
        <div className="cell">
          <span className="v">{sessions.length}</span>
          <span className="l">会谈总数</span>
        </div>
        <div className="cell">
          <span className="v">{sessionsWithRisk}</span>
          <span className="l">需复核</span>
        </div>
        <div className="cell">
          <span className="v">{sessionsWithWorksheet}</span>
          <span className="l">工作纸</span>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, textAlign: "center", padding: "16px 0" }}>
          还没有保存的会谈记录。
        </p>
      ) : (
        <ul className="tl-list">
          {sessions.map((session) => (
            <li key={session.session_id}>
              <div
                className="tl-item"
                onClick={() => onSelectSession(session.session_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSelectSession(session.session_id);
                }}
              >
                <div className="tl-meta">
                  <span>{formatDate(session.created_at)}</span>
                  <span className={`pill ${riskPillClass(session.risk_level)}`}>
                    {localizeRiskLevel(session.risk_level)}
                  </span>
                </div>
                <div className="tl-snippet">{excerpt(session.source_text)}</div>
                <div className="tl-foot">
                  {session.intensity ? (
                    <span className="tag risk">强度：{localizeValue(session.intensity)}</span>
                  ) : null}
                  {session.emotion_labels.slice(0, 1).map((label) => (
                    <span key={label} className="tag warn">{label}</span>
                  ))}
                  {session.cognitive_patterns.slice(0, 1).map((pattern) => (
                    <span key={pattern} className="tag accent">{pattern}</span>
                  ))}
                  <span className={session.has_rebt_worksheet ? "tag good" : "tag muted"}>
                    {session.has_rebt_worksheet ? "已填工作纸" : "未填工作纸"}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
