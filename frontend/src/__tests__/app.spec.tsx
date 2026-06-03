import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { buildMarkdownExport, buildMarkdownExportFileName } from "../components/AnalysisResultPanel";
import type { SessionRecord } from "../types";

const fetchMock = vi.fn();

function createAnalysisResponse(overrides: Record<string, unknown> = {}) {
  return {
    session_id: "session_001",
    client_code: "client_001",
    created_at: "2026-05-06T12:00:00Z",
    updated_at: "2026-05-06T12:00:00Z",
    source_text: "我最近一直很焦虑，总觉得事情会失控。",
    analysis: {
      emotion_labels: ["anxiety"],
      intensity: "high",
      cognitive_patterns: ["catastrophizing"],
      emotion_target: "self",
      confidence: 0.91,
      risk_level: "none",
    },
    risk_alert: null,
    interpretation: "一、核心观察\n这是结构化详细版解读。",
    rebt_plan: {
      items: [
        {
          title: "澄清失控预期",
          detail: "围绕“事情会失控”追问具体证据、可控部分与最小下一步。",
          source_quote: "事情会失控",
        },
      ],
    },
    feedback: {
      notes: "",
      notes_color: "black",
      rating: null,
      disagreements: {},
      disagreement_colors: {},
    },
    rebt_worksheet: {
      activating_event: "",
      belief: "",
      consequence: "",
      dispute: "",
      effective_belief: "",
      homework: "",
      follow_up: "",
    },
    ...overrides,
  };
}

function createSessionSummary(overrides: Record<string, unknown> = {}) {
  return {
    session_id: "session_001",
    created_at: "2026-05-06T12:00:00Z",
    updated_at: "2026-05-06T12:00:00Z",
    source_text: "我最近一直很焦虑，总觉得事情会失控。",
    emotion_labels: ["焦虑"],
    intensity: "high",
    cognitive_patterns: ["灾难化思维"],
    risk_level: "none",
    has_rebt_worksheet: false,
    ...overrides,
  };
}

describe("App", () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("refreshes back to the previously selected client when it still exists", async () => {
    window.localStorage.setItem("workbench:active-client-code", "client_002");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { client_code: "client_001", alias: "来访者 1", status: "待初评" },
          { client_code: "client_002", alias: "来访者 2", status: "跟进中" },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/clients/client_002/sessions", undefined);
    });
    expect(window.localStorage.getItem("workbench:active-client-code")).toBe("client_002");
  });

  it("submits analysis and renders the current submission label", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ client_code: "client_001", alias: "来访者 01", status: "待初评" }]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(createAnalysisResponse()), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([createSessionSummary()]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("来访者 01").length).toBeGreaterThan(0);
    });

    await userEvent.type(
      screen.getByRole("textbox", { name: "会谈文本" }),
      "我最近一直很焦虑，总觉得事情会失控。",
    );
    await userEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(screen.getByText("核心观察")).toBeInTheDocument();
    });
    expect(screen.getByText("对应 第 1 次提交")).toBeInTheDocument();
    expect(screen.getByText("澄清失控预期")).toBeInTheDocument();
  });

  it("exports the current analysis as Markdown", async () => {
    let exportedBlob: Blob | null = null;
    let downloadedName = "";
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        exportedBlob = blob;
        return "blob:rebt-export";
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadedName = this.download;
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ client_code: "client_001", alias: "来访者 01", status: "待初评" }]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(createAnalysisResponse()), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([createSessionSummary()]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("来访者 01").length).toBeGreaterThan(0);
    });
    await userEvent.type(screen.getByRole("textbox", { name: "会谈文本" }), "我最近一直很焦虑，总觉得事情会失控。");
    await userEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(screen.getByText("导出 Markdown")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: "导出 Markdown" }));

    expect(exportedBlob).toBeInstanceOf(Blob);
    expect(downloadedName).toBe("来访者001第一次提交内容.md");
    const markdown = buildMarkdownExport(createAnalysisResponse() as SessionRecord, "第 1 次提交");
    expect(markdown).toContain("# REBT 会谈分析记录");
    expect(markdown).toContain("## 会谈文本");
    expect(markdown).toContain("## REBT 干预建议");
    expect(markdown).toContain("澄清失控预期");
    expect(buildMarkdownExportFileName(createAnalysisResponse({ client_code: "client_002" }) as SessionRecord, "第 4 次提交")).toBe(
      "来访者002第四次提交内容.md",
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:rebt-export");
  });

  it("disables the analyze button and shows the analyzing state while the request is in flight", async () => {
    let resolveAnalyze!: (value: Response) => void;

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ client_code: "client_001", alias: "来访者 01", status: "待初评" }]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAnalyze = resolve;
        }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([createSessionSummary()]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("来访者 01").length).toBeGreaterThan(0);
    });

    await userEvent.type(screen.getByRole("textbox", { name: "会谈文本" }), "需要分析的文本");
    const button = screen.getByRole("button", { name: "开始分析" });
    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.getAllByText("生成中...").length).toBeGreaterThan(0);
    expect(
      screen.getByText("正在生成结构化分析、逐句 REBT 解读和工作纸草案，可能需要 1-2 分钟。"),
    ).toBeInTheDocument();

    resolveAnalyze(
      new Response(JSON.stringify(createAnalysisResponse()), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("澄清失控预期")).toBeInTheDocument();
    });
  });

  it("shows a backend connection message when the local API is unreachable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("无法连接到本地后端服务，请确认 8000 端口服务已启动。")).toBeInTheDocument();
    });
  });

  it("shows an upstream model message when analysis receives a 502 response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ client_code: "client_001", alias: "来访者 01", status: "待初评" }]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "上游模型服务返回 401，请检查 API 配置是否有效。" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("来访者 01").length).toBeGreaterThan(0);
    });

    await userEvent.type(screen.getByRole("textbox", { name: "会谈文本" }), "需要分析的文本");
    await userEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(
        screen.getByText("上游模型服务异常：上游模型服务返回 401，请检查 API 配置是否有效。"),
      ).toBeInTheDocument();
    });
  });

  it("renders the dedicated risk alert section when a risk alert is present", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ client_code: "client_001", alias: "来访者 01", status: "待初评" }]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          createAnalysisResponse({
            risk_alert: {
              level: "review",
              signals: ["反复提到不想活了"],
              summary: "需要进一步澄清是否存在具体风险计划。",
            },
          }),
        ),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([createSessionSummary({ risk_level: "review" })]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("来访者 01").length).toBeGreaterThan(0);
    });

    await userEvent.type(screen.getByRole("textbox", { name: "会谈文本" }), "我最近不想活了。");
    await userEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(screen.getByText("需要进一步澄清是否存在具体风险计划。")).toBeInTheDocument();
    });
    expect(screen.getByText("反复提到不想活了")).toBeInTheDocument();
  });
});
