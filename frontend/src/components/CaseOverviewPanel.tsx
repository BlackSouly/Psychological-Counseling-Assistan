import type { ClientProfile, SessionSummary } from "../types";
import { clientDisplayName } from "../clientDisplay";

type CaseOverviewPanelProps = {
  client: ClientProfile | null;
  sessions: SessionSummary[];
  onSelectSession?: (sessionId: string) => void;
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

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function firstLabel(values: string[]): string {
  return values.find((value) => value.trim().length > 0) ?? "未标注";
}

function trendItems(sessions: SessionSummary[]): SessionSummary[] {
  return sessions.slice(0, 5).reverse();
}

const INTENSITY_SCORE: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  extreme: 4,
};

function intensityTrendLabel(sessions: SessionSummary[]): string {
  const recent = sessions.slice(0, 2);
  if (recent.length < 2) {
    return "至少需要两次会谈后判断强度变化。";
  }

  const latest = INTENSITY_SCORE[recent[0].intensity];
  const previous = INTENSITY_SCORE[recent[1].intensity];
  if (!latest || !previous) {
    return "最近两次强度标注不完整。";
  }

  if (latest > previous) {
    return `强度较上次上升：${localizeValue(recent[1].intensity)} → ${localizeValue(recent[0].intensity)}。`;
  }
  if (latest < previous) {
    return `强度较上次下降：${localizeValue(recent[1].intensity)} → ${localizeValue(recent[0].intensity)}。`;
  }
  return `强度与上次持平：${localizeValue(recent[0].intensity)}。`;
}

function riskContinuityLabel(sessions: SessionSummary[]): string {
  const recentRiskCount = sessions.slice(0, 3).filter((session) => session.risk_level !== "none").length;
  if (recentRiskCount === 0) {
    return "近三次暂无风险标记。";
  }
  if (recentRiskCount === Math.min(3, sessions.length)) {
    return `近 ${Math.min(3, sessions.length)} 次均有风险标记，建议优先复核。`;
  }
  return `近三次有 ${recentRiskCount} 次风险标记，需持续追踪。`;
}

function worksheetCoverageLabel(sessions: SessionSummary[], worksheetCount: number): string {
  if (sessions.length === 0) {
    return "暂无工作纸完成记录。";
  }

  const coverage = Math.round((worksheetCount / sessions.length) * 100);
  return `工作纸覆盖 ${worksheetCount} / ${sessions.length} 次，完成率 ${coverage}%。`;
}

function riskWindowLabel(sessions: SessionSummary[], windowSize: number): string {
  const windowSessions = sessions.slice(0, windowSize);
  const riskCount = windowSessions.filter((session) => session.risk_level !== "none").length;
  return `近 ${windowSize} 次出现 ${riskCount} 次`;
}

function riskExcerpt(session: SessionSummary): string {
  const normalized = session.source_text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "暂无会谈文本摘要。";
  }
  return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
}

export function CaseOverviewPanel({ client, sessions, onSelectSession }: CaseOverviewPanelProps) {
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
  const latestSession = sessions[0] ?? null;
  const recentTrend = trendItems(sessions);
  const latestEmotion = latestSession ? firstLabel(latestSession.emotion_labels) : "暂无";
  const latestCognition = latestSession ? firstLabel(latestSession.cognitive_patterns) : "暂无";
  const latestRiskSession = riskSessions[0] ?? null;
  const changeSignals = [
    intensityTrendLabel(sessions),
    riskContinuityLabel(sessions),
    worksheetCoverageLabel(sessions, worksheetCount),
  ];

  return (
    <div className="case-overview fade-in">
      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">CASE</div>
          <div className="rs-title">个案概览</div>
        </div>
        <div className="overview-hero">
          <div>
            <div className="overview-name">{clientDisplayName(client)}</div>
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
          <div className="rs-eyebrow">TRAJECTORY</div>
          <div className="rs-title">历次提交变化趋势</div>
        </div>
        <div className="overview-signal-list">
          {changeSignals.map((signal) => (
            <span key={signal} className="tag muted">
              {signal}
            </span>
          ))}
        </div>
        {recentTrend.length > 0 ? (
          <div className="overview-trend" aria-label="近五次会谈变化趋势">
            {recentTrend.map((session, index) => (
              <button
                key={session.session_id}
                aria-label={`查看 ${formatShortDate(session.created_at)} 的会谈分析`}
                className="overview-trend-item"
                onClick={() => onSelectSession?.(session.session_id)}
                type="button"
              >
                <div className="overview-trend-head">
                  <span>{formatShortDate(session.created_at)}</span>
                  <strong>近 {recentTrend.length - index}</strong>
                </div>
                <div className="overview-trend-body">
                  <span className="tag risk">强度：{localizeValue(session.intensity) || "暂无"}</span>
                  <span className={`pill ${session.risk_level === "none" ? "muted" : "risk"}`}>
                    {localizeRiskLevel(session.risk_level)}
                  </span>
                </div>
                <p>{firstLabel(session.emotion_labels)} · {firstLabel(session.cognitive_patterns)}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">暂无可用于趋势展示的会谈记录。</p>
        )}
      </div>

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">RISK</div>
          <div className="rs-title">风险轨迹</div>
        </div>
        <div className="risk-track-summary">
          <article>
            <span>最近风险</span>
            <strong>{latestRiskSession ? localizeRiskLevel(latestRiskSession.risk_level) : "无"}</strong>
            <p>
              {latestRiskSession
                ? `${formatShortDate(latestRiskSession.created_at)} · ${firstLabel(latestRiskSession.emotion_labels)}`
                : "当前会谈记录中暂无风险标记。"}
            </p>
          </article>
          <article>
            <span>近 3 次</span>
            <strong>{riskWindowLabel(sessions, 3)}</strong>
            <p>{riskContinuityLabel(sessions)}</p>
          </article>
          <article>
            <span>近 5 次</span>
            <strong>{riskWindowLabel(sessions, 5)}</strong>
            <p>用于观察风险是否在近期反复出现。</p>
          </article>
        </div>
        {riskSessions.length > 0 ? (
          <div className="risk-track-list">
            {riskSessions.slice(0, 5).map((session) => (
              <button
                key={session.session_id}
                className="risk-track-item"
                onClick={() => onSelectSession?.(session.session_id)}
                type="button"
              >
                <span className="pill risk">{localizeRiskLevel(session.risk_level)}</span>
                <div>
                  <strong>{formatShortDate(session.created_at)}</strong>
                  <p>{riskExcerpt(session)}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">暂无风险标记会谈。</p>
        )}
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
          <li>最近一次主要情绪为「{latestEmotion}」，主要认知模式为「{latestCognition}」，可优先核对其触发情境与信念链条。</li>
          <li>高频模式可作为本阶段 REBT 工作纸的主要追踪对象，已完成工作纸 {worksheetCount} / {sessions.length} 次。</li>
          <li>若风险会谈持续出现，先完成风险复核，再进入信念挑战。</li>
        </ul>
      </div>
    </div>
  );
}
