import type {
  AnnotationFeedback,
  ClientProfile,
  CreateClientPayload,
  UpdateClientStatusPayload,
  SessionRecord,
  SessionSummary,
} from "./types";

export async function fetchClients(): Promise<ClientProfile[]> {
  const response = await fetch("/api/clients");
  if (!response.ok) {
    throw new Error("加载来访者列表失败。");
  }
  return (await response.json()) as ClientProfile[];
}

export async function createClient(payload: CreateClientPayload): Promise<ClientProfile> {
  const response = await fetch("/api/clients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("创建来访者失败。");
  }
  return (await response.json()) as ClientProfile;
}

export async function fetchClientSessions(clientCode: string): Promise<SessionSummary[]> {
  const response = await fetch(`/api/clients/${clientCode}/sessions`);
  if (!response.ok) {
    throw new Error("加载历史记录失败。");
  }
  return (await response.json()) as SessionSummary[];
}

export async function updateClientStatus(
  clientCode: string,
  payload: UpdateClientStatusPayload,
): Promise<ClientProfile> {
  const response = await fetch(`/api/clients/${clientCode}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("更新来访者处理状态失败。");
  }
  return (await response.json()) as ClientProfile;
}

export async function analyzeSession(
  clientCode: string,
  sourceText: string,
): Promise<SessionRecord> {
  const response = await fetch("/api/sessions/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_code: clientCode,
      source_text: sourceText
    })
  });
  if (!response.ok) {
    throw new Error("分析文本失败。");
  }
  return (await response.json()) as SessionRecord;
}

export async function fetchSession(sessionId: string): Promise<SessionRecord> {
  const response = await fetch(`/api/sessions/${sessionId}`);
  if (!response.ok) {
    throw new Error("读取记录详情失败。");
  }
  return (await response.json()) as SessionRecord;
}

export async function updateSessionFeedback(
  sessionId: string,
  feedback: AnnotationFeedback,
): Promise<SessionRecord> {
  const response = await fetch(`/api/sessions/${sessionId}/feedback`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(feedback)
  });
  if (!response.ok) {
    throw new Error("保存反馈失败。");
  }
  return (await response.json()) as SessionRecord;
}
