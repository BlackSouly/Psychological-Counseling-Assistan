import type {
  AnnotationFeedback,
  AppHealth,
  ClientProfile,
  CreateClientPayload,
  RebtWorksheet,
  SessionRecord,
  SessionSummary,
  UpdateClientStatusPayload,
} from "./types";

export class ApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError("无法连接到本地后端服务，请确认 8000 端口服务已启动。", null);
    }
    throw error;
  }
}

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

async function throwApiError(response: Response, fallbackMessage: string): Promise<never> {
  throw new ApiError(await extractErrorMessage(response, fallbackMessage), response.status);
}

export async function fetchClients(): Promise<ClientProfile[]> {
  const response = await request("/api/clients");
  if (!response.ok) {
    await throwApiError(response, "加载来访者列表失败。");
  }
  return (await response.json()) as ClientProfile[];
}

export async function fetchHealth(): Promise<AppHealth> {
  const response = await request("/api/health");
  if (!response.ok) {
    await throwApiError(response, "读取系统状态失败。");
  }
  return (await response.json()) as AppHealth;
}

export async function createClient(payload: CreateClientPayload): Promise<ClientProfile> {
  const response = await request("/api/clients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await throwApiError(response, "创建来访者失败。");
  }
  return (await response.json()) as ClientProfile;
}

export async function fetchClientSessions(clientCode: string): Promise<SessionSummary[]> {
  const response = await request(`/api/clients/${clientCode}/sessions`);
  if (!response.ok) {
    await throwApiError(response, "加载历史记录失败。");
  }
  return (await response.json()) as SessionSummary[];
}

export async function updateClientStatus(
  clientCode: string,
  payload: UpdateClientStatusPayload,
): Promise<ClientProfile> {
  const response = await request(`/api/clients/${clientCode}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await throwApiError(response, "更新来访者处理状态失败。");
  }
  return (await response.json()) as ClientProfile;
}

export async function deleteClient(clientCode: string): Promise<void> {
  const response = await request(`/api/clients/${clientCode}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    await throwApiError(response, "删除来访者失败。");
  }
}

export async function analyzeSession(
  clientCode: string,
  sourceText: string,
): Promise<SessionRecord> {
  const response = await request("/api/sessions/analyze", {
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
    await throwApiError(response, "分析文本失败。");
  }
  return (await response.json()) as SessionRecord;
}

export async function fetchSession(sessionId: string): Promise<SessionRecord> {
  const response = await request(`/api/sessions/${sessionId}`);
  if (!response.ok) {
    await throwApiError(response, "读取记录详情失败。");
  }
  return (await response.json()) as SessionRecord;
}

export async function regenerateSessionRebtPlan(sessionId: string): Promise<SessionRecord> {
  const response = await request(`/api/sessions/${sessionId}/rebt-plan`, {
    method: "POST",
  });
  if (!response.ok) {
    await throwApiError(response, "补生成 REBT 计划失败。");
  }
  return (await response.json()) as SessionRecord;
}

export async function updateSessionFeedback(
  sessionId: string,
  feedback: AnnotationFeedback,
): Promise<SessionRecord> {
  const response = await request(`/api/sessions/${sessionId}/feedback`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(feedback),
  });
  if (!response.ok) {
    await throwApiError(response, "保存反馈失败。");
  }
  return (await response.json()) as SessionRecord;
}

export async function updateSessionWorksheet(
  sessionId: string,
  worksheet: RebtWorksheet,
): Promise<SessionRecord> {
  const response = await request(`/api/sessions/${sessionId}/worksheet`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(worksheet),
  });
  if (!response.ok) {
    await throwApiError(response, "保存 REBT 工作纸失败。");
  }
  return (await response.json()) as SessionRecord;
}
