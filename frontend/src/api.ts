import type {
  AnnotationFeedback,
  ClientProfile,
  CreateClientPayload,
  RebtWorksheet,
  SessionRecord,
  SessionSummary,
  UpdateClientStatusPayload,
} from "./types";

async function extractErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as { detail?: unknown; message?: unknown };
      if (typeof payload.detail === "string" && payload.detail.trim()) {
        return payload.detail;
      }
      if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message;
      }
    } catch {
      // Ignore JSON parse errors and fall back to text or the default message.
    }
  }

  try {
    const text = (await response.text()).trim();
    if (text) {
      return text;
    }
  } catch {
    // Ignore body read errors and fall back to the default message.
  }

  return fallbackMessage;
}

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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("更新来访者处理状态失败。");
  }
  return (await response.json()) as ClientProfile;
}

export async function deleteClient(clientCode: string): Promise<void> {
  const response = await fetch(`/api/clients/${clientCode}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("删除来访者失败。");
  }
}

export async function analyzeSession(
  clientCode: string,
  sourceText: string,
): Promise<SessionRecord> {
  const response = await fetch("/api/sessions/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_code: clientCode,
      source_text: sourceText,
    }),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "分析文本失败。"));
  }
  return (await response.json()) as SessionRecord;
}

export async function fetchSession(sessionId: string): Promise<SessionRecord> {
  const response = await fetch(`/api/sessions/${sessionId}`);
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "读取记录详情失败。"));
  }
  return (await response.json()) as SessionRecord;
}

export async function regenerateSessionRebtPlan(sessionId: string): Promise<SessionRecord> {
  const response = await fetch(`/api/sessions/${sessionId}/rebt-plan`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "补生成 REBT 计划失败。"));
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(feedback),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "保存反馈失败。"));
  }
  return (await response.json()) as SessionRecord;
}

export async function updateSessionWorksheet(
  sessionId: string,
  worksheet: RebtWorksheet,
): Promise<SessionRecord> {
  const response = await fetch(`/api/sessions/${sessionId}/worksheet`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(worksheet),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "保存 REBT 工作纸失败。"));
  }
  return (await response.json()) as SessionRecord;
}
