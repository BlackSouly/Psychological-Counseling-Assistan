import { FeedbackPanel } from "./FeedbackPanel";
import type { SessionRecord } from "../types";

type AnalysisResultPanelProps = {
  isSavingFeedback: boolean;
  result: SessionRecord | null;
  onSaveFeedback: (sessionId: string, feedback: SessionRecord["feedback"]) => Promise<void>;
};

const TEXT_MAP: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  extreme: "极高",
  self: "自身",
  other: "他人",
  situation: "情境",
  mixed: "混合",
  unknown: "未知",
  anxiety: "焦虑",
  despair: "绝望",
  shame: "羞耻",
  hopelessness: "无望",
  resignation: "放弃",
  loneliness: "孤独",
  confusion: "困惑",
  frustration: "挫败",
  anger: "愤怒",
  catastrophizing: "灾难化思维",
  "all-or-nothing thinking": "非黑即白思维",
  "mind reading": "读心式推断",
  rumination: "反刍思维",
  perseveration: "持续纠结",
  "information overload": "信息过载",
  "hopelessness thinking": "绝望化思维",
};

function localizeValue(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return TEXT_MAP[value] ?? value;
}

function localizeList(values: string[] | undefined): string {
  if (!values || values.length === 0) {
    return "";
  }
  return values.map((value) => localizeValue(value)).join("、");
}

function localizeRiskLevel(level: string | undefined): string {
  switch (level) {
    case "urgent":
      return "高优先级";
    case "review":
      return "需复核";
    case "none":
      return "无";
    default:
      return level ?? "";
  }
}

function parseInterpretationSections(interpretation: string): Array<{ title: string; body: string }> {
  const normalized = interpretation.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const matches = Array.from(normalized.matchAll(/(^|\n)([一二三四]、[^\n]+)/g));
  if (matches.length === 0) {
    return [{ title: "辅助解读", body: normalized }];
  }

  return matches.map((match, index) => {
    const title = match[2].trim();
    const sectionStart = match.index === undefined ? 0 : match.index + match[1].length + title.length;
    const nextMatch = matches[index + 1];
    const sectionEnd = nextMatch?.index ?? normalized.length;
    const body = normalized.slice(sectionStart, sectionEnd).trim();
    return { title, body };
  });
}

export function AnalysisResultPanel({ isSavingFeedback, result, onSaveFeedback }: AnalysisResultPanelProps) {
  if (!result) {
    return (
      <section className="result-panel">
        <div className="panel-header">
          <div className="panel-kicker">Inspector</div>
          <h2>分析结果</h2>
          <p className="panel-subcopy">提交文本分析后，这里会显示结构化结果和 REBT 解读。</p>
        </div>
      </section>
    );
  }

  const interpretationSections = parseInterpretationSections(result.interpretation);

  return (
    <section className="result-panel">
      <div className="panel-header">
        <div className="panel-kicker">Inspector</div>
        <div className="panel-heading-row">
          <div>
            <h2>分析结果</h2>
            <p className="panel-subcopy">AI 输出仅供参考，不能替代专业判断。</p>
          </div>
          <div className="result-meta">
            <span className="result-meta-label">来访者</span>
            <span className="result-meta-value">{result.client_code}</span>
          </div>
        </div>
      </div>
      {result.risk_alert && result.risk_alert.level !== "none" ? (
        <section className="risk-banner" role="alert">
          <div className="risk-banner-head">
            <div>
              <h3>需要优先进行风险复核</h3>
              <p className="risk-banner-caption">当前文本中存在需要临床留意的风险信号。</p>
            </div>
            <span className={`risk-pill risk-pill-${result.risk_alert.level}`}>
              {localizeRiskLevel(result.risk_alert.level)}
            </span>
          </div>
          <p className="risk-summary">{result.risk_alert.summary}</p>
          {result.risk_alert.signals.length > 0 ? (
            <div className="risk-signals">
              {result.risk_alert.signals.map((signal) => (
                <span key={signal} className="risk-signal-chip">
                  {signal}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      <dl className="result-grid">
        <div>
          <dt>情绪标签</dt>
          <dd>{localizeList(result.analysis?.emotion_labels)}</dd>
        </div>
        <div>
          <dt>强度</dt>
          <dd>{localizeValue(result.analysis?.intensity)}</dd>
        </div>
        <div>
          <dt>认知模式</dt>
          <dd>{localizeList(result.analysis?.cognitive_patterns)}</dd>
        </div>
        <div>
          <dt>情绪指向</dt>
          <dd>{localizeValue(result.analysis?.emotion_target)}</dd>
        </div>
        <div>
          <dt>置信度</dt>
          <dd>{result.analysis?.confidence}</dd>
        </div>
      </dl>
      <div className="interpretation-block">
        <div className="interpretation-header">
          <div>
            <h3>REBT解读</h3>
            <p className="interpretation-caption">以下内容按专业阅读顺序整理，便于快速判断与继续干预。</p>
          </div>
        </div>
        <div className="interpretation-sections">
          {interpretationSections.map((section) => (
            <section key={section.title} className="interpretation-section">
              <h4>{section.title}</h4>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </div>
      <FeedbackPanel
        feedback={result.feedback}
        isSaving={isSavingFeedback}
        onSave={(feedback) => onSaveFeedback(result.session_id, feedback)}
      />
    </section>
  );
}
