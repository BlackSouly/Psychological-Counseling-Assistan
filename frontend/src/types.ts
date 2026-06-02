export type ClientStatus = "待初评" | "跟进中" | "需风险复核" | "已稳定" | "已结案";

export type ClientProfile = {
  client_code: string;
  alias: string;
  status: ClientStatus;
};

export type CreateClientPayload = {
  alias: string;
};

export type UpdateClientStatusPayload = {
  status: ClientStatus;
};

export type SessionSummary = {
  session_id: string;
  created_at: string;
  source_text: string;
  emotion_labels: string[];
  intensity: string;
  cognitive_patterns: string[];
  risk_level: string;
  has_rebt_worksheet: boolean;
};

export type StructuredAnalysis = {
  emotion_labels: string[];
  intensity: string;
  cognitive_patterns: string[];
  emotion_target: string;
  confidence: number;
  risk_level: string;
};

export type RiskAlert = {
  level: string;
  signals: string[];
  summary: string;
};

export type FeedbackColor = "black" | "red" | "blue";

export type AnnotationFeedback = {
  notes: string;
  notes_color: FeedbackColor;
  rating: number | null;
  disagreements: Record<string, string>;
  disagreement_colors: Record<string, FeedbackColor>;
};

export type RebtWorksheet = {
  activating_event: string;
  belief: string;
  consequence: string;
  dispute: string;
  effective_belief: string;
  homework: string;
  follow_up: string;
};

export type RebtPlanItem = {
  title: string;
  detail: string;
  source_quote: string;
};

export type RebtPlan = {
  items: RebtPlanItem[];
};

export type SessionRecord = {
  session_id: string;
  client_code: string;
  created_at: string;
  source_text: string;
  analysis: StructuredAnalysis | null;
  risk_alert: RiskAlert | null;
  interpretation: string;
  rebt_plan: RebtPlan;
  feedback: AnnotationFeedback;
  rebt_worksheet: RebtWorksheet;
};
