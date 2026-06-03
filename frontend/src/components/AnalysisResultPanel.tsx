import { useEffect, useState } from "react";

import type { RebtLineInterpretation, SessionRecord } from "../types";
import { FeedbackPanel } from "./FeedbackPanel";
import type { PinnedQuote } from "./SessionText/sessionText.types";

type AnalysisResultPanelProps = {
  currentSubmissionLabel?: string | null;
  isRegeneratingRebtPlan: boolean;
  isSavingFeedback: boolean;
  isSavingWorksheet: boolean;
  rebtPlanErrorMessage?: string | null;
  rebtPlanStatusMessage?: string | null;
  showFeedback?: boolean;
  result: SessionRecord | null;
  pinnedQuotes?: PinnedQuote[];
  worksheetErrorMessage?: string | null;
  worksheetStatusMessage?: string | null;
  onRegenerateRebtPlan: (sessionId: string) => Promise<void>;
  onSaveFeedback: (sessionId: string, feedback: SessionRecord["feedback"]) => Promise<void>;
  onSaveWorksheet: (
    sessionId: string,
    worksheet: SessionRecord["rebt_worksheet"],
  ) => Promise<void>;
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
      return "需立即复核";
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
    case "需立即复核":
      return 100;
    default:
      return null;
  }
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join("、") : "暂无明确标签";
}

function buildSessionSummary(result: SessionRecord): string[] {
  const analysis = result.analysis;
  if (!analysis) {
    return ["当前记录暂无结构化分析结果。"];
  }

  const emotions = localizeList(analysis.emotion_labels);
  const cognition = localizeList(analysis.cognitive_patterns);
  const confidenceText = Number.isFinite(analysis.confidence)
    ? `${Math.round(analysis.confidence * 100)}%`
    : "未提供";

  return [
    `主要情绪：${formatList(emotions)}；强度为 ${localizeValue(analysis.intensity) || "未知"}。`,
    `主要认知模式：${formatList(cognition)}。`,
    `情绪指向：${localizeValue(analysis.emotion_target) || "未知"}；模型置信度：${confidenceText}。`,
    `风险级别：${localizeRiskLevel(result.risk_alert?.level ?? analysis.risk_level) || "未知"}。`,
  ];
}

function buildRiskReviewSuggestions(result: SessionRecord): string[] {
  const riskLevel = result.risk_alert?.level ?? result.analysis?.risk_level ?? "none";
  const riskSignals = result.risk_alert?.signals ?? [];
  const hasClinicalRisk =
    riskLevel === "urgent" || riskLevel === "review" || riskLevel === "需复核";

  if (!hasClinicalRisk) {
    return [
      "继续记录后续会谈中的情绪强度、睡眠、食欲和社会支持变化。",
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

function hasSavedWorksheet(result: SessionRecord): boolean {
  return Object.values(result.rebt_worksheet ?? {}).some((value) => value.trim().length > 0);
}

function shouldOfferRebtRegeneration(result: SessionRecord): boolean {
  return Boolean(
    result.analysis && result.interpretation.trim() && result.rebt_plan.items.length === 0,
  );
}

function markdownText(value: string | null | undefined): string {
  return value?.trim() || "未提供";
}

function markdownList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- 未提供";
}

function markdownSection(title: string, body: string): string {
  return `## ${title}\n\n${body.trim() || "未提供"}`;
}

function displayWorksheet(result: SessionRecord): SessionRecord["rebt_worksheet"] {
  if (hasSavedWorksheet(result)) {
    return result.rebt_worksheet;
  }

  const worksheetDraft = result.rebt_plan?.worksheet_draft;
  if (worksheetDraft && Object.values(worksheetDraft).some((value) => value.trim().length > 0)) {
    return worksheetDraft;
  }

  return result.rebt_worksheet;
}

export function buildMarkdownExport(result: SessionRecord, currentSubmissionLabel?: string | null): string {
  const sessionSummary = buildSessionSummary(result);
  const riskReviewSuggestions = buildRiskReviewSuggestions(result);
  const lineInterpretations = result.rebt_plan?.line_interpretations ?? [];
  const rebtItems = result.rebt_plan?.items ?? [];
  const worksheet = displayWorksheet(result);
  const sections = splitInterpretation(result.interpretation);
  const feedback = result.feedback;

  const parts = [
    `# REBT 会谈分析记录`,
    [
      `- 来访者编号：${result.client_code}`,
      `- 会谈记录：${currentSubmissionLabel ?? result.session_id}`,
      `- 创建时间：${result.created_at}`,
      `- 更新时间：${result.updated_at || "未提供"}`,
      `- 风险级别：${localizeRiskLevel(result.risk_alert?.level ?? result.analysis?.risk_level) || "未知"}`,
    ].join("\n"),
    markdownSection("会谈文本", markdownText(result.source_text)),
    markdownSection("会谈摘要", markdownList(sessionSummary)),
    markdownSection("风险复核建议", markdownList(riskReviewSuggestions)),
    markdownSection(
      "关键句逐句解读",
      lineInterpretations.length > 0
        ? lineInterpretations
            .map((item, index) =>
              [
                `### ${index + 1}. ${markdownText(item.rebt_step || "REBT 片段")}`,
                item.source_quote ? `> ${item.source_quote}` : null,
                item.activating_event ? `- A 触发事件：${item.activating_event}` : null,
                item.belief ? `- B 信念：${item.belief}` : null,
                item.consequence ? `- C 后果：${item.consequence}` : null,
                item.dispute_direction ? `- D 辩论方向：${item.dispute_direction}` : null,
                item.intervention_question ? `- 咨询追问：${item.intervention_question}` : null,
                item.risk_note ? `- 风险/边界：${item.risk_note}` : null,
              ]
                .filter((line): line is string => Boolean(line))
                .join("\n"),
            )
            .join("\n\n")
        : "未提供",
    ),
    markdownSection(
      "REBT 解读",
      sections.length > 0
        ? sections.map((section) => `### ${section.title}\n\n${markdownText(section.body)}`).join("\n\n")
        : markdownText(result.interpretation),
    ),
    markdownSection(
      "REBT 干预建议",
      rebtItems.length > 0
        ? rebtItems
            .map((item, index) =>
              [
                `${index + 1}. ${item.title}`,
                item.source_quote ? `   - 原文依据：${item.source_quote}` : null,
                `   - 建议：${item.detail}`,
              ]
                .filter((line): line is string => Boolean(line))
                .join("\n"),
            )
            .join("\n")
        : "未提供",
    ),
    markdownSection(
      "REBT 工作纸",
      [
        `- A 触发事件：${markdownText(worksheet.activating_event)}`,
        `- B 信念/解释：${markdownText(worksheet.belief)}`,
        `- C 情绪与行为后果：${markdownText(worksheet.consequence)}`,
        `- D 反驳问题：${markdownText(worksheet.dispute)}`,
        `- E 新有效信念：${markdownText(worksheet.effective_belief)}`,
        `- 家庭练习：${markdownText(worksheet.homework)}`,
        `- 下次会谈追踪：${markdownText(worksheet.follow_up)}`,
      ].join("\n"),
    ),
    markdownSection(
      "专业反馈",
      [
        `- 批注说明：${markdownText(feedback.notes)}`,
        `- 评分：${feedback.rating === null ? "未评分" : feedback.rating}`,
      ].join("\n"),
    ),
  ];

  return `${parts.join("\n\n")}\n`;
}

function toChineseOrdinal(value: number): string {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

  if (!Number.isInteger(value) || value <= 0) {
    return String(value);
  }

  if (value < 10) {
    return digits[value];
  }

  if (value === 10) {
    return "十";
  }

  if (value < 20) {
    return `十${digits[value % 10]}`;
  }

  if (value < 100) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${digits[tens]}十${ones === 0 ? "" : digits[ones]}`;
  }

  return String(value);
}

function clientExportName(clientCode: string): string {
  const suffix = clientCode.match(/(\d+)$/)?.[1];
  return suffix ? `来访者${suffix}` : `来访者${clientCode}`;
}

function sanitizeExportFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").replace(/\s+/g, "").slice(0, 120);
}

export function buildMarkdownExportFileName(
  result: SessionRecord,
  currentSubmissionLabel?: string | null,
): string {
  const submissionIndex = currentSubmissionLabel?.match(/第\s*(\d+)\s*次/)?.[1];
  const submissionName = submissionIndex
    ? `第${toChineseOrdinal(Number(submissionIndex))}次提交内容`
    : "会谈分析内容";

  return `${sanitizeExportFileName(`${clientExportName(result.client_code)}${submissionName}`)}.md`;
}

function exportMarkdown(result: SessionRecord, currentSubmissionLabel?: string | null) {
  const markdown = buildMarkdownExport(result, currentSubmissionLabel);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildMarkdownExportFileName(result, currentSubmissionLabel);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function splitInterpretation(
  interpretation: string,
): Array<{ index: number; title: string; body: string }> {
  const normalized = interpretation.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const matches = Array.from(
    normalized.matchAll(/(^|\n)([一二三四五六七八九十\d]+[、.．][^\n]+)/g),
  );
  if (matches.length === 0) {
    return [{ index: 1, title: "核心观察", body: normalized }];
  }

  return matches.map((match, index) => {
    const titleRaw = match[2].trim();
    const title = titleRaw.replace(/^[一二三四五六七八九十\d]+[、.．]/, "").trim();
    const sectionStart = (match.index ?? 0) + match[1].length + titleRaw.length;
    const nextMatch = matches[index + 1];
    const sectionEnd = nextMatch?.index ?? normalized.length;
    const body = normalized.slice(sectionStart, sectionEnd).trim();
    return {
      index: index + 1,
      title,
      body,
    };
  });
}

const rebtConceptSectionMeta = [
  { title: "核心概念化", eyebrow: "FORMULATION" },
  { title: "维持机制", eyebrow: "MAINTENANCE" },
  { title: "风险与边界", eyebrow: "BOUNDARY" },
  { title: "干预优先级", eyebrow: "SEQUENCE" },
] as const;

type RebtConceptSection = {
  index: number;
  title: string;
  body: string;
  eyebrow: string;
};

function splitRebtConceptualization(
  interpretation: string,
): RebtConceptSection[] {
  const sections = splitInterpretation(interpretation);
  const conceptSections: Array<RebtConceptSection | null> = rebtConceptSectionMeta.map((meta, index) => {
    const section = sections.find((item) => item.title === meta.title);
    return section
      ? {
          index: index + 1,
          title: section.title,
          body: section.body,
          eyebrow: meta.eyebrow,
        }
      : null;
  });

  if (conceptSections.some((section) => section === null)) {
    return [];
  }

  return conceptSections.filter((section): section is RebtConceptSection => section !== null);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

type LineRebtFocusBadge = {
  label: string;
  tone: "muted" | "warn" | "accent" | "good" | "risk";
};

function buildLineRebtFocusBadges(item: RebtLineInterpretation): LineRebtFocusBadge[] {
  return [
    item.rebt_step ? { label: `环节 · ${item.rebt_step}`, tone: "muted" } : null,
    item.belief ? { label: "信念靶点", tone: "warn" } : null,
    item.consequence ? { label: "后果证据", tone: "accent" } : null,
    item.dispute_direction || item.intervention_question ? { label: "可辩论", tone: "good" } : null,
    item.risk_note ? { label: "需复核", tone: "risk" } : null,
  ].filter((badge): badge is LineRebtFocusBadge => badge !== null);
}

type WorksheetEvidence = {
  label: string;
  detail: string;
  quote?: string;
  targetId?: string;
};

type LineEvidenceField =
  | "activating_event"
  | "belief"
  | "consequence"
  | "dispute_direction"
  | "intervention_question";

const lineEvidenceLabels: Record<LineEvidenceField, string> = {
  activating_event: "来自逐句解读 · A 触发事件",
  belief: "来自逐句解读 · B 信念靶点",
  consequence: "来自逐句解读 · C 后果证据",
  dispute_direction: "来自逐句解读 · D 辩论方向",
  intervention_question: "来自逐句解读 · 咨询追问",
};

function lineRebtTargetId(index: number): string {
  return `line-rebt-card-${index}`;
}

function findLineEvidence(result: SessionRecord, field: LineEvidenceField): WorksheetEvidence | null {
  const lineIndex = (result.rebt_plan?.line_interpretations ?? []).findIndex((item) =>
    item[field].trim(),
  );
  if (lineIndex === -1) {
    return null;
  }
  const line = result.rebt_plan?.line_interpretations?.[lineIndex];
  if (!line) {
    return null;
  }

  return {
    label: lineEvidenceLabels[field],
    detail: line[field],
    quote: line.source_quote,
    targetId: lineRebtTargetId(lineIndex),
  };
}

function worksheetDraftEvidence(result: SessionRecord, label: string, detail: string): WorksheetEvidence | null {
  const worksheetDraft = result.rebt_plan?.worksheet_draft;
  if (!worksheetDraft || !detail.trim()) {
    return null;
  }

  return {
    label,
    detail,
  };
}

function WorksheetEvidenceNote({
  evidence,
  onJumpToSource,
}: {
  evidence: WorksheetEvidence | null;
  onJumpToSource?: (targetId: string) => void;
}) {
  if (!evidence) {
    return null;
  }
  const canJump = Boolean(evidence.targetId && onJumpToSource);

  return (
    <div className="worksheet-evidence">
      {canJump ? (
        <button
          className="worksheet-evidence-label worksheet-evidence-link"
          onClick={() => onJumpToSource?.(evidence.targetId ?? "")}
          type="button"
        >
          {evidence.label}
        </button>
      ) : (
        <span className="worksheet-evidence-label">{evidence.label}</span>
      )}
      {evidence.quote ? <q>{evidence.quote}</q> : null}
      <p>{evidence.detail}</p>
    </div>
  );
}

function MetricBar({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return <div className="metric-note">该字段为分类标签，不显示进度条。</div>;
  }

  const percent = clampPercent(value);
  return (
    <div aria-label={`${label}，${Math.round(percent)}%`} className="metric-bar" role="img">
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function RebtWorksheet({
  isSaving,
  onJumpToSource,
  result,
  onSave,
}: {
  isSaving: boolean;
  onJumpToSource?: (targetId: string) => void;
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

    const worksheetDraft = result.rebt_plan?.worksheet_draft;
    if (worksheetDraft && Object.values(worksheetDraft).some((value) => value.trim().length > 0)) {
      setEvent(worksheetDraft.activating_event);
      setBelief(worksheetDraft.belief);
      setConsequence(worksheetDraft.consequence);
      setDispute(worksheetDraft.dispute);
      setEffectiveBelief(worksheetDraft.effective_belief);
      setHomework(worksheetDraft.homework);
      setFollowUp(worksheetDraft.follow_up);
      return;
    }

    const analysis = result.analysis;
    const emotions = localizeList(analysis?.emotion_labels);
    const cognition = localizeList(analysis?.cognitive_patterns);
    const sourcePreview = result.source_text.trim().slice(0, 80);

    setEvent(
      sourcePreview
        ? `围绕来访者表述“${sourcePreview}${result.source_text.length > 80 ? "..." : ""}”梳理具体触发事件。`
        : "",
    );
    setBelief(
      cognition.length > 0
        ? `重点探索：${cognition.join("、")}背后的必须化、灾难化或自我评价。`
        : "",
    );
    setConsequence(
      emotions.length > 0
        ? `情绪后果：${emotions.join("、")}；强度：${localizeValue(analysis?.intensity) || "未知"}。`
        : "",
    );
    setDispute(
      "证据问题：一定如此吗？逻辑问题：失败是否等于整个人没有价值？实用问题：继续这样想有帮助吗？",
    );
    setEffectiveBelief(
      "我希望事情做好，但一次挫折不能定义我；我可以承担后果，并继续寻找可调整的下一步。",
    );
    setHomework(
      "记录 1 个触发事件，写下自动想法、情绪强度、支持/反对证据，以及一个更灵活的新信念。",
    );
    setFollowUp(
      "下次复盘新信念是否降低情绪强度、是否增加行动可能性，以及旧信念在哪些场景复燃。",
    );
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

  const eventEvidence = findLineEvidence(result, "activating_event");
  const beliefEvidence = findLineEvidence(result, "belief");
  const consequenceEvidence = findLineEvidence(result, "consequence");
  const disputeEvidence =
    findLineEvidence(result, "dispute_direction") ?? findLineEvidence(result, "intervention_question");
  const effectiveBeliefEvidence = worksheetDraftEvidence(result, "来自工作纸草案 · E 新信念", effectiveBelief);
  const homeworkEvidence = worksheetDraftEvidence(result, "来自工作纸草案 · 家庭练习", homework);
  const followUpEvidence = worksheetDraftEvidence(result, "来自工作纸草案 · 下次追踪", followUp);

  return (
    <div className="worksheet">
      <div className="worksheet-grid">
        <div className="worksheet-field">
          <label htmlFor="worksheet-activating-event">A 触发事件</label>
          <textarea
            aria-label="A 触发事件"
            disabled={isSaving}
            id="worksheet-activating-event"
            value={event}
            onChange={(event) => setEvent(event.target.value)}
          />
          <WorksheetEvidenceNote evidence={eventEvidence} onJumpToSource={onJumpToSource} />
        </div>
        <div className="worksheet-field">
          <label htmlFor="worksheet-belief">B 信念/解释</label>
          <textarea
            aria-label="B 信念/解释"
            disabled={isSaving}
            id="worksheet-belief"
            value={belief}
            onChange={(event) => setBelief(event.target.value)}
          />
          <WorksheetEvidenceNote evidence={beliefEvidence} onJumpToSource={onJumpToSource} />
        </div>
        <div className="worksheet-field">
          <label htmlFor="worksheet-consequence">C 情绪与行为后果</label>
          <textarea
            aria-label="C 情绪与行为后果"
            disabled={isSaving}
            id="worksheet-consequence"
            value={consequence}
            onChange={(event) => setConsequence(event.target.value)}
          />
          <WorksheetEvidenceNote evidence={consequenceEvidence} onJumpToSource={onJumpToSource} />
        </div>
        <div className="worksheet-field">
          <label htmlFor="worksheet-dispute">D 反驳问题</label>
          <textarea
            aria-label="D 反驳问题"
            disabled={isSaving}
            id="worksheet-dispute"
            value={dispute}
            onChange={(event) => setDispute(event.target.value)}
          />
          <WorksheetEvidenceNote evidence={disputeEvidence} onJumpToSource={onJumpToSource} />
        </div>
        <div className="worksheet-field">
          <label htmlFor="worksheet-effective-belief">E 新有效信念</label>
          <textarea
            aria-label="E 新有效信念"
            disabled={isSaving}
            id="worksheet-effective-belief"
            value={effectiveBelief}
            onChange={(event) => setEffectiveBelief(event.target.value)}
          />
          <WorksheetEvidenceNote evidence={effectiveBeliefEvidence} />
        </div>
        <div className="worksheet-field">
          <label htmlFor="worksheet-homework">家庭练习</label>
          <textarea
            aria-label="家庭练习"
            disabled={isSaving}
            id="worksheet-homework"
            value={homework}
            onChange={(event) => setHomework(event.target.value)}
          />
          <WorksheetEvidenceNote evidence={homeworkEvidence} />
        </div>
        <div className="worksheet-field worksheet-wide">
          <label htmlFor="worksheet-follow-up">下次会谈追踪</label>
          <textarea
            aria-label="下次会谈追踪"
            disabled={isSaving}
            id="worksheet-follow-up"
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
          />
          <WorksheetEvidenceNote evidence={followUpEvidence} />
        </div>
      </div>
      <div className="worksheet-actions">
        <span className="worksheet-status">
          {hasSavedWorksheet(result)
            ? "已保存到当前会谈记录。"
            : "当前为自动预填草稿，保存后会随历史记录一起恢复。"}
        </span>
        <button
          className="btn primary worksheet-save-btn"
          disabled={isSaving}
          onClick={() => void handleSave()}
          type="button"
        >
          {isSaving ? "保存中..." : "保存工作纸"}
        </button>
      </div>
    </div>
  );
}

export function AnalysisResultPanel({
  currentSubmissionLabel,
  isRegeneratingRebtPlan,
  isSavingFeedback,
  isSavingWorksheet,
  pinnedQuotes = [],
  rebtPlanErrorMessage,
  rebtPlanStatusMessage,
  showFeedback = true,
  result,
  worksheetErrorMessage,
  worksheetStatusMessage,
  onRegenerateRebtPlan,
  onSaveFeedback,
  onSaveWorksheet,
}: AnalysisResultPanelProps) {
  const [highlightedLineRebtId, setHighlightedLineRebtId] = useState<string | null>(null);

  function handleJumpToLineRebt(targetId: string) {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }
    target.scrollIntoView?.({ behavior: "smooth", block: "center" });
    setHighlightedLineRebtId(targetId);
    window.setTimeout(() => {
      setHighlightedLineRebtId((current) => (current === targetId ? null : current));
    }, 1800);
  }

  if (!result) {
    return (
      <div className="empty-state">
        <h3>暂无分析结果</h3>
        <p>先提交会谈文本，这里会显示结构化分析、REBT 计划和工作纸。</p>
      </div>
    );
  }

  const emotions = localizeList(result.analysis?.emotion_labels);
  const cognition = localizeList(result.analysis?.cognitive_patterns);
  const sections = splitInterpretation(result.interpretation);
  const rebtConceptSections = splitRebtConceptualization(result.interpretation);
  const intensityProgress = intensityPercent(result.analysis?.intensity);
  const confidenceProgress = confidencePercent(result.analysis?.confidence);
  const riskProgress = riskPercent(result.analysis?.risk_level);
  const sessionSummary = buildSessionSummary(result);
  const riskReviewSuggestions = buildRiskReviewSuggestions(result);
  const lineInterpretations = result.rebt_plan?.line_interpretations ?? [];
  const rebtPlanItems = result.rebt_plan?.items ?? [];
  const canRegenerateRebtPlan = shouldOfferRebtRegeneration(result);

  return (
    <div className="result-section fade-in">
      <div className="result-actions">
        <button
          className="btn ghost sm"
          onClick={() => exportMarkdown(result, currentSubmissionLabel)}
          type="button"
        >
          导出 Markdown
        </button>
      </div>

      {pinnedQuotes.length > 0 ? (
        <div className="rs-body">
          <div className="rs-head">
            <div className="rs-eyebrow">ANNOTATIONS</div>
            <div className="rs-title">来自文本标注</div>
          </div>
          <ul className="insight-list">
            {pinnedQuotes.map((quote) => (
              <li key={quote.id}>
                {quote.speaker === "client" ? "来访者" : "咨询师"}：{quote.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
          {currentSubmissionLabel ? <div className="rs-submeta">对应 {currentSubmissionLabel}</div> : null}
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

      {lineInterpretations.length > 0 ? (
        <div className="rs-body">
          <div className="rs-head">
            <div className="rs-eyebrow">LINE REBT</div>
            <div className="rs-title">关键句逐句解读</div>
          </div>
          <div className="rebt">
            {lineInterpretations.map((item, index) => {
              const focusBadges = buildLineRebtFocusBadges(item);
              return (
                <article
                  id={lineRebtTargetId(index)}
                  key={`${item.source_quote}-${index}`}
                  className={`rebt-card line-rebt-card${
                    highlightedLineRebtId === lineRebtTargetId(index) ? " line-rebt-card-highlight" : ""
                  }`}
                >
                  <div className="rebt-num">
                    <span className="n">{index + 1}</span>
                  </div>
                  <div className="rebt-text line-rebt-text">
                    <div className="line-rebt-head">
                      <strong>{item.rebt_step || "REBT 片段"}</strong>
                      {focusBadges.length > 0 ? (
                        <div className="line-rebt-focus" aria-label="关键句重点标识">
                          <span className="line-rebt-focus-label">重点</span>
                          {focusBadges.map((badge) => (
                            <span key={`${badge.label}-${badge.tone}`} className={`pill ${badge.tone}`}>
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {item.source_quote ? <p className="line-rebt-quote">“{item.source_quote}”</p> : null}
                    </div>
                    <div className="line-rebt-grid">
                      {item.activating_event ? (
                        <div className="line-rebt-point">
                          <span className="pill muted">A</span>
                          <p>{item.activating_event}</p>
                        </div>
                      ) : null}
                      {item.belief ? (
                        <div className="line-rebt-point">
                          <span className="pill warn">B</span>
                          <p>{item.belief}</p>
                        </div>
                      ) : null}
                      {item.consequence ? (
                        <div className="line-rebt-point">
                          <span className="pill accent">C</span>
                          <p>{item.consequence}</p>
                        </div>
                      ) : null}
                      {item.dispute_direction ? (
                        <div className="line-rebt-point">
                          <span className="pill good">D</span>
                          <p>{item.dispute_direction}</p>
                        </div>
                      ) : null}
                      {item.intervention_question ? (
                        <div className="line-rebt-point line-rebt-point-wide">
                          <span className="pill muted">追问</span>
                          <p>{item.intervention_question}</p>
                        </div>
                      ) : null}
                      {item.risk_note ? (
                        <div className="line-rebt-point line-rebt-point-wide">
                          <span className="pill risk">风险</span>
                          <p>{item.risk_note}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rs-body">
        <div className="rs-head">
          <div>
            <div className="rs-eyebrow">REBT PLAN</div>
            <div className="rs-title">REBT 干预建议</div>
          </div>
          {canRegenerateRebtPlan ? (
            <button
              className="history-chip"
              disabled={isRegeneratingRebtPlan}
              onClick={() => void onRegenerateRebtPlan(result.session_id)}
              type="button"
            >
              {isRegeneratingRebtPlan ? "生成中..." : "重新生成"}
            </button>
          ) : null}
        </div>
        {rebtPlanStatusMessage ? (
          <p className="status-banner section-banner" role="status">
            {rebtPlanStatusMessage}
          </p>
        ) : null}
        {rebtPlanErrorMessage ? (
          <p className="error-banner section-banner" role="alert">
            {rebtPlanErrorMessage}
          </p>
        ) : null}
        {rebtPlanItems.length > 0 ? (
          <ul className="insight-list rebt-plan-list">
            {rebtPlanItems.map((item) => (
              <li key={`${item.title}-${item.source_quote}`} className="rebt-plan-item">
                <strong>{item.title}</strong>
                {item.source_quote ? <span className="anno-quote">“{item.source_quote}”</span> : null}
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">
            {canRegenerateRebtPlan
              ? "当前记录缺少结构化 REBT 计划，可直接重新生成。"
              : "当前记录暂无模型生成的 REBT 干预建议。"}
          </p>
        )}
      </div>

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">WORKSHEET</div>
          <div className="rs-title">REBT 工作纸</div>
        </div>
        {worksheetStatusMessage ? (
          <p className="status-banner section-banner" role="status">
            {worksheetStatusMessage}
          </p>
        ) : null}
        {worksheetErrorMessage ? (
          <p className="error-banner section-banner" role="alert">
            {worksheetErrorMessage}
          </p>
        ) : null}
        <RebtWorksheet
          isSaving={isSavingWorksheet}
          onJumpToSource={handleJumpToLineRebt}
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
            <div className="metric-value">
              置信度 ·
              {result.analysis?.confidence !== undefined
                ? ` ${Math.round(result.analysis.confidence * 100)}%`
                : " 未提供"}
            </div>
            <MetricBar value={confidenceProgress} label="置信度" />
          </article>
          <article className="metric">
            <div className="metric-label">ORIENTATION</div>
            <div className="metric-value">情绪指向 · {localizeValue(result.analysis?.emotion_target)}</div>
            <MetricBar value={null} label="情绪指向" />
          </article>
          <article className="metric">
            <div className="metric-label">RISK</div>
            <div className="metric-value">
              风险级别 · {localizeRiskLevel(result.risk_alert?.level ?? result.analysis?.risk_level)}
            </div>
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
              <span key={item} className="tag warn">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="tag-row">
          <span>COGNITION</span>
          <div className="tag-list">
            {cognition.map((item) => (
              <span key={item} className="tag accent">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="rs-body">
        <div className="rs-head">
          <div className="rs-eyebrow">REBT</div>
          <div className="rs-title">REBT 解读</div>
        </div>
        {rebtConceptSections.length > 0 ? (
          <div className="rebt-layer-list">
            {rebtConceptSections.map((section) => (
              <article key={section.title} className="rebt-layer-card">
                <div className="rebt-layer-head">
                  <span className="rebt-layer-index">{section.index}</span>
                  <div>
                    <div className="rs-eyebrow">{section.eyebrow}</div>
                    <strong>{section.title}</strong>
                  </div>
                </div>
                <div className="rebt-layer-body">
                  {splitParagraphs(section.body).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : sections.length > 0 ? (
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
        ) : (
          <p className="hint">当前记录暂无 REBT 解读内容。</p>
        )}
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
