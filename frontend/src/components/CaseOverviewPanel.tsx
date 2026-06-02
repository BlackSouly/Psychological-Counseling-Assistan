import type { ClientProfile, SessionSummary } from "../types";

type CaseOverviewPanelProps = {
  client: ClientProfile | null;
  sessions: SessionSummary[];
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
      return "需立即复核";
    case "review":
      return "需复核";
    case "none":
      return "无";
    default:
      return level;
  }
}

function topItems(values: string[], limit = 4): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function latestText(sessions: SessionSummary[]): string {
  const latest = sessions[0]?.source_text?.replace(/\s+/g, " ").trim();
  if (!latest) {
    return "暂无最近会谈摘要。";
  }
  return latest.length > 96 ? `${latest.slice(0, 96)}...` : latest;
}

export function CaseOverviewPanel({ client, sessions }: CaseOverviewPanelProps) {
  if (!client) {
    return (
      <div className="empty-state">
        <h3>暂无个案概览</h3>
        <p>请先选择一位来访者。</p>
      </div>
    );
  }

  const riskSessions = sessions.filter((session) => session.risk_level !== "none");
  const worksheetCount = sessions.filter((session) => session.has_rebt_worksheet).length;
  const topEmotions = topItems(sessions.flatMap((session) => session.emotion_labels));
  const topCognitions = topItems(sessions.flatMap((session) => session.cognitive_patterns));
  const latestRisk = sessions[0]?.risk_level ?? "none";
  const latestIntensity = localizeValue(sessions[0]?.intensity) || "暂无";

  return (
    <div className="case-overview fade-in">
      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">CASE</div>
          <div className="rs-title">个案概览</div>
        </div>
        <div className="overview-hero">
          <div>
            <div className="overview-name">{client.alias}</div>
            <div className="overview-meta">
              {client.client_code} · 当前状态：{client.status}
            </div>
          </div>
          <span className="pill accent">{sessions.length} 次会谈</span>
        </div>
      </div>

      <div className="overview-grid">
        <article className="overview-card">
          <span>风险会谈</span>
          <strong>{riskSessions.length}</strong>
          <p>最近风险：{localizeRiskLevel(latestRisk)}</p>
        </article>
        <article className="overview-card">
          <span>最新强度</span>
          <strong>{latestIntensity}</strong>
          <p>用于判断近期情绪波动。</p>
        </article>
        <article className="overview-card">
          <span>工作纸完成</span>
          <strong>{worksheetCount}</strong>
          <p>{sessions.length > 0 ? `完成率 ${Math.round((worksheetCount / sessions.length) * 100)}%` : "暂无记录"}</p>
        </article>
      </div>

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">PATTERNS</div>
          <div className="rs-title">高频情绪与认知模式</div>
        </div>
        <div className="overview-columns">
          <div className="overview-chip-group">
            <strong>情绪标签</strong>
            <div className="tag-list">
              {topEmotions.length > 0 ? (
                topEmotions.map((item) => (
                  <span key={item.label} className="tag warn">
                    {item.label} · {item.count}
                  </span>
                ))
              ) : (
                <span className="muted">暂无情绪标签</span>
              )}
            </div>
          </div>
          <div className="overview-chip-group">
            <strong>认知模式</strong>
            <div className="tag-list">
              {topCognitions.length > 0 ? (
                topCognitions.map((item) => (
                  <span key={item.label} className="tag accent">
                    {item.label} · {item.count}
                  </span>
                ))
              ) : (
                <span className="muted">暂无认知模式</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">NEXT</div>
          <div className="rs-title">下次会谈关注点</div>
        </div>
        <ul className="insight-list">
          <li>复盘最近一次会谈：{latestText(sessions)}</li>
          <li>优先追踪反复出现的认知模式，并检查是否已进入 REBT 工作纸练习。</li>
          <li>若风险会谈持续出现，先完成风险复核，再进入信念挑战。</li>
        </ul>
      </div>
    </div>
  );
}
