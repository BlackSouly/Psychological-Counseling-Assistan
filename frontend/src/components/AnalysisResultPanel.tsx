import { useEffect, useState } from "react";

import type { SessionRecord } from "../types";
import { FeedbackPanel } from "./FeedbackPanel";

type AnalysisResultPanelProps = {
  isSavingFeedback: boolean;
  isSavingWorksheet: boolean;
  showFeedback?: boolean;
  result: SessionRecord | null;
  onSaveFeedback: (sessionId: string, feedback: SessionRecord["feedback"]) => Promise<void>;
  onSaveWorksheet: (sessionId: string, worksheet: SessionRecord["rebt_worksheet"]) => Promise<void>;
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

function localizeList(values: string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }
  return values.map((value) => localizeValue(value));
}

function localizeRiskLevel(level: string | undefined): string {
  switch (level) {
    case "urgent":
      return "需复核";
    case "review":
      return "需复核";
    case "none":
      return "无";
    default:
      return level ?? "";
  }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function intensityPercent(value: string | undefined): number | null {
  switch (value) {
    case "low":
    case "低":
      return 25;
    case "medium":
    case "中":
      return 50;
    case "high":
    case "高":
      return 75;
    case "extreme":
    case "极高":
      return 100;
    default:
      return null;
  }
}

function confidencePercent(value: number | undefined): number | null {
  if (value === undefined || Number.isNaN(value)) {
    return null;
  }
  return clampPercent(value * 100);
}

function riskPercent(level: string | undefined): number | null {
  switch (level) {
    case "none":
    case "无":
      return 0;
    case "review":
    case "需复核":
      return 70;
    case "urgent":
    case "紧急":
      return 100;
    default:
      return null;
  }
}

function MetricBar({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return <div className="metric-note">类别字段，不作程度估计</div>;
  }

  const percent = clampPercent(value);

  return (
    <div
      className="metric-bar"
      aria-label={`${label}：${Math.round(percent)}%`}
      role="img"
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join("、") : "暂无明确标签";
}

function buildSessionSummary(result: SessionRecord): string[] {
  const analysis = result.analysis;
  if (!analysis) {
    return ["当前记录尚无结构化分析结果。"];
  }

  const emotions = localizeList(analysis.emotion_labels);
  const cognition = localizeList(analysis.cognitive_patterns);
  const riskLevel = localizeRiskLevel(analysis.risk_level);
  const confidenceText = Number.isFinite(analysis.confidence)
    ? `${Math.round(analysis.confidence * 100)}%`
    : "未提供";

  return [
    `主要情绪：${formatList(emotions)}；强度为${localizeValue(analysis.intensity) || "未知"}。`,
    `主要认知模式：${formatList(cognition)}。`,
    `情绪指向：${localizeValue(analysis.emotion_target) || "未知"}；模型置信度：${confidenceText}。`,
    `风险级别：${riskLevel || "未知"}。`,
  ];
}

function buildRiskReviewSuggestions(result: SessionRecord): string[] {
  const riskLevel = result.risk_alert?.level ?? result.analysis?.risk_level ?? "none";
  const riskSignals = result.risk_alert?.signals ?? [];
  const hasClinicalRisk = riskLevel === "urgent" || riskLevel === "review" || riskLevel === "需复核";

  if (!hasClinicalRisk) {
    return [
      "继续记录后续会谈中的情绪强度、睡眠/食欲变化和社会支持变化。",
      "若后续文本出现放弃、绝望、自伤或伤人相关表达，再启动风险复核流程。",
      "将 AI 结果作为辅助线索，仍以专业访谈和机构流程为准。",
    ];
  }

  const signalText = riskSignals.length > 0 ? `已识别信号：${riskSignals.join("、")}。` : null;
  return [
    signalText,
    "优先澄清是否存在自伤、伤人、具体计划、可获得手段和近期触发事件。",
    "确认来访者当前支持系统、独处状态与可联系的紧急支持对象。",
    "如风险持续或升级，按机构安全协议进行督导复核、危机干预或转介。",
  ].filter((item): item is string => Boolean(item));
}

function buildRebtInterventionSuggestions(result: SessionRecord): string[] {
  const analysis = result.analysis;
  if (!analysis) {
    return ["当前记录尚无结构化分析结果，暂不生成 REBT 干预建议。"];
  }

  const cognition = localizeList(analysis.cognitive_patterns);
  const target = localizeValue(analysis.emotion_target);
  const intensity = localizeValue(analysis.intensity);
  const emotions = localizeList(analysis.emotion_labels);
  const cognitionText = cognition.length > 0 ? cognition.join("、") : "尚未识别出明确认知模式";
  const emotionText = emotions.length > 0 ? emotions.join("、") : "尚未识别出明确情绪标签";

  const suggestions = [
    `A 触发事件：请先让来访者把“发生了什么”讲成可观察事实，避免一开始就进入“我不行、没人关心、完了”等评价性语言。`,
    `B 信念假设：围绕当前识别到的情绪“${emotionText}”和认知模式“${cognitionText}”，追问背后的必须化、灾难化、低挫折耐受或全局自我评价。`,
    `C 情绪与行为后果：情绪强度${intensity ? `为“${intensity}”` : "暂不明确"}，可区分健康负性情绪与非健康负性情绪，例如遗憾/难过 vs 羞耻/绝望/自我攻击。`,
    target
      ? `情绪指向“${target}”时，建议进一步澄清：这是对自己的全局否定、对他人的读心推断，还是对情境后果的灾难化预期。`
      : null,
    `D 反驳提问：可以使用三类问题推进：证据问题“有什么证据说明一定如此？”；逻辑问题“失败是否等于整个人没有价值？”；实用问题“继续这样想会帮助你解决问题吗？”`,
    `E 新有效信念：将“我必须做好，否则我就是失败者”改写为“我希望做好，但一次失败不能定义我；我可以承担后果并继续调整”。`,
    `会谈操作顺序：先共情和命名情绪，再共同画出 A-B-C 链条；来访者稳定后再进入 D 的挑战，避免过早辩论造成防御。`,
    `家庭练习：请来访者记录 1 个触发事件，分别写下自动想法、情绪强度、支持/反对证据，以及一个更灵活的新信念。`,
    `下次会谈追踪：复盘新信念是否降低情绪强度、是否增加行动可能性，并观察旧信念在哪些场景最容易复燃。`,
  ];

  return suggestions.filter((item): item is string => Boolean(item));
}

function hasSavedWorksheet(result: SessionRecord): boolean {
  return Object.values(result.rebt_worksheet ?? {}).some((value) => value.trim().length > 0);
}

function RebtWorksheet({
  isSaving,
  result,
  onSave,
}: {
  isSaving: boolean;
  result: SessionRecord;
  onSave: (worksheet: SessionRecord["rebt_worksheet"]) => Promise<void>;
}) {
  const [event, setEvent] = useState("");
  const [belief, setBelief] = useState("");
  const [consequence, setConsequence] = useState("");
  const [dispute, setDispute] = useState("");
  const [effectiveBelief, setEffectiveBelief] = useState("");
  const [homework, setHomework] = useState("");
  const [followUp, setFollowUp] = useState("");

  useEffect(() => {
    if (hasSavedWorksheet(result)) {
      setEvent(result.rebt_worksheet.activating_event);
      setBelief(result.rebt_worksheet.belief);
      setConsequence(result.rebt_worksheet.consequence);
      setDispute(result.rebt_worksheet.dispute);
      setEffectiveBelief(result.rebt_worksheet.effective_belief);
      setHomework(result.rebt_worksheet.homework);
      setFollowUp(result.rebt_worksheet.follow_up);
      return;
    }

    const analysis = result.analysis;
    const emotions = localizeList(analysis?.emotion_labels);
    const cognition = localizeList(analysis?.cognitive_patterns);
    const sourcePreview = result.source_text.trim().slice(0, 80);

    setEvent(sourcePreview ? `围绕来访者表述：“${sourcePreview}${result.source_text.length > 80 ? "..." : ""}”梳理具体触发事件。` : "");
    setBelief(cognition.length > 0 ? `重点探索：${cognition.join("、")}背后的必须化、灾难化或自我评价。` : "");
    setConsequence(
      emotions.length > 0
        ? `情绪后果：${emotions.join("、")}；强度：${localizeValue(analysis?.intensity) || "未知"}。`
        : "",
    );
    setDispute("证据问题：一定如此吗？逻辑问题：失败是否等于整个人没有价值？实用问题：继续这样想有帮助吗？");
    setEffectiveBelief("我希望事情做好，但一次挫折不能定义我；我可以承担后果，并继续寻找可调整的下一步。");
    setHomework("记录 1 个触发事件，写下自动想法、情绪强度、支持/反对证据，以及一个更灵活的新信念。");
    setFollowUp("下次复盘新信念是否降低情绪强度、是否增加行动可能性，以及旧信念在哪些场景复燃。");
  }, [result]);

  async function handleSave() {
    await onSave({
      activating_event: event,
      belief,
      consequence,
      dispute,
      effective_belief: effectiveBelief,
      homework,
      follow_up: followUp,
    });
  }

  return (
    <div className="worksheet">
      <div className="worksheet-grid">
        <label className="worksheet-field">
          <span>A 触发事件</span>
          <textarea disabled={isSaving} value={event} onChange={(event) => setEvent(event.target.value)} />
        </label>
        <label className="worksheet-field">
          <span>B 信念/解释</span>
          <textarea disabled={isSaving} value={belief} onChange={(event) => setBelief(event.target.value)} />
        </label>
        <label className="worksheet-field">
          <span>C 情绪与行为后果</span>
          <textarea disabled={isSaving} value={consequence} onChange={(event) => setConsequence(event.target.value)} />
        </label>
        <label className="worksheet-field">
          <span>D 反驳问题</span>
          <textarea disabled={isSaving} value={dispute} onChange={(event) => setDispute(event.target.value)} />
        </label>
        <label className="worksheet-field">
          <span>E 新有效信念</span>
          <textarea disabled={isSaving} value={effectiveBelief} onChange={(event) => setEffectiveBelief(event.target.value)} />
        </label>
        <label className="worksheet-field">
          <span>家庭练习</span>
          <textarea disabled={isSaving} value={homework} onChange={(event) => setHomework(event.target.value)} />
        </label>
        <label className="worksheet-field worksheet-wide">
          <span>下次会谈追踪</span>
          <textarea disabled={isSaving} value={followUp} onChange={(event) => setFollowUp(event.target.value)} />
        </label>
      </div>
      <div className="worksheet-actions">
        <span>{hasSavedWorksheet(result) ? "已保存到当前会谈记录。" : "当前为自动预填草稿，保存后会随历史记录恢复。"}</span>
        <button className="btn primary" disabled={isSaving} onClick={handleSave} type="button">
          {isSaving ? "保存中..." : "保存工作纸"}
        </button>
      </div>
    </div>
  );
}

function splitInterpretation(interpretation: string): Array<{ index: number; title: string; body: string }> {
  const normalized = interpretation.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const matches = Array.from(normalized.matchAll(/(^|\n)([一二三四五六七八九十\d]+、[^\n]+)/g));
  if (matches.length === 0) {
    return [{ index: 1, title: "核心观察", body: normalized }];
  }

  return matches.map((match, idx) => {
    const titleRaw = match[2].trim();
    const title = titleRaw.replace(/^[一二三四五六七八九十\d]+、/, "");
    const sectionStart = (match.index ?? 0) + match[1].length + titleRaw.length;
    const nextMatch = matches[idx + 1];
    const sectionEnd = nextMatch?.index ?? normalized.length;
    const body = normalized.slice(sectionStart, sectionEnd).trim();
    return { index: idx + 1, title, body };
  });
}

export function AnalysisResultPanel({
  isSavingFeedback,
  isSavingWorksheet,
  showFeedback = true,
  result,
  onSaveFeedback,
  onSaveWorksheet,
}: AnalysisResultPanelProps) {
  if (!result) {
    return (
      <div className="empty-state">
        <h3>暂无分析结果</h3>
        <p>提交文本分析后，这里会显示结构化结果和 REBT 解读。</p>
      </div>
    );
  }

  const emotions = localizeList(result.analysis?.emotion_labels);
  const cognition = localizeList(result.analysis?.cognitive_patterns);
  const sections = splitInterpretation(result.interpretation);
  const intensityProgress = intensityPercent(result.analysis?.intensity);
  const confidenceProgress = confidencePercent(result.analysis?.confidence);
  const riskProgress = riskPercent(result.analysis?.risk_level);
  const sessionSummary = buildSessionSummary(result);
  const riskReviewSuggestions = buildRiskReviewSuggestions(result);
  const rebtInterventionSuggestions = buildRebtInterventionSuggestions(result);

  return (
    <div className="result-section fade-in">
      {result.risk_alert && result.risk_alert.level !== "none" ? (
        <div className="risk-banner high" role="alert">
          <div className="row gap-sm" style={{ marginBottom: 8 }}>
            <span className="risk-icon">!</span>
            <div>
              <div className="risk-title">需要优先进行风险复核</div>
              <div className="risk-body">{result.risk_alert.summary}</div>
            </div>
            <span className="pill risk">{localizeRiskLevel(result.risk_alert.level)}</span>
          </div>
          <div className="risk-tags">
            {result.risk_alert.signals.map((signal) => (
              <span key={signal} className="tag risk">
                {signal}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">SUMMARY</div>
          <div className="rs-title">会谈摘要</div>
        </div>
        <ul className="insight-list">
          {sessionSummary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">REVIEW</div>
          <div className="rs-title">风险复核建议</div>
        </div>
        <ul className="insight-list">
          {riskReviewSuggestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">REBT PLAN</div>
          <div className="rs-title">REBT 干预建议</div>
        </div>
        <ul className="insight-list">
          {rebtInterventionSuggestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">WORKSHEET</div>
          <div className="rs-title">REBT 工作纸</div>
        </div>
        <RebtWorksheet
          isSaving={isSavingWorksheet}
          result={result}
          onSave={(worksheet) => onSaveWorksheet(result.session_id, worksheet)}
        />
      </div>

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">METRICS</div>
          <div className="rs-title">情绪度量</div>
        </div>

        <div className="metrics">
          <article className="metric">
            <div className="metric-label">INTENSITY</div>
            <div className="metric-value">情绪强度 · {localizeValue(result.analysis?.intensity)}</div>
            <MetricBar value={intensityProgress} label="情绪强度" />
          </article>
          <article className="metric">
            <div className="metric-label">CONFIDENCE</div>
            <div className="metric-value">置信度 · {result.analysis?.confidence}</div>
            <MetricBar value={confidenceProgress} label="置信度" />
          </article>
          <article className="metric">
            <div className="metric-label">ORIENTATION</div>
            <div className="metric-value">情绪指向 · {localizeValue(result.analysis?.emotion_target)}</div>
            <MetricBar value={null} label="情绪指向" />
          </article>
          <article className="metric">
            <div className="metric-label">RISK</div>
            <div className="metric-value">风险级别 · {localizeRiskLevel(result.analysis?.risk_level)}</div>
            <MetricBar value={riskProgress} label="风险级别" />
          </article>
        </div>
      </div>

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">TAGS</div>
          <div className="rs-title">情绪与认知标签</div>
        </div>

        <div className="tag-row">
          <span>EMOTION</span>
          <div className="tag-list">
            {emotions.map((item) => (
              <span key={item} className="tag warn">{item}</span>
            ))}
          </div>
        </div>
        <div className="tag-row">
          <span>COGNITION</span>
          <div className="tag-list">
            {cognition.map((item) => (
              <span key={item} className="tag accent">{item}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">REBT</div>
          <div className="rs-title">REBT 解读</div>
        </div>
        <div className="rebt">
          {sections.map((section) => (
            <article key={`${section.index}-${section.title}`} className="rebt-card">
              <div className="rebt-num">
                <span className="n">{section.index}</span>
              </div>
              <div className="rebt-text">
                <strong>{section.title}</strong>
                <p>{section.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {showFeedback ? (
        <div className="fb-card">
          <FeedbackPanel
            feedback={result.feedback}
            isSaving={isSavingFeedback}
            onSave={(feedback) => onSaveFeedback(result.session_id, feedback)}
          />
        </div>
      ) : null}
    </div>
  );
}
