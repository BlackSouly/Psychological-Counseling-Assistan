import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../App";

const fetchMock = vi.fn();

function createAnalysisResponse(overrides: Record<string, unknown> = {}) {
  return {
    session_id: "session_001",
    client_code: "client_001",
    created_at: "2026-05-06T12:00:00Z",
    source_text: "我最近一直很焦虑，总觉得事情会失控。",
    analysis: {
      emotion_labels: ["焦虑"],
      intensity: "高",
      cognitive_patterns: ["灾难化思维"],
      emotion_target: "自身",
      confidence: 0.91,
      risk_level: "none",
    },
    risk_alert: null,
    interpretation: "一、核心观察\n这是结构化详细版解读。",
    feedback: {
      notes: "",
      notes_color: "black",
      rating: null,
      disagreements: {},
      disagreement_colors: {},
    },
    ...overrides,
  };
}

describe("App", () => {
  beforeEach(() => {
    cleanup();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("在侧栏渲染来访者列表", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ client_code: "client_001", alias: "来访者001", status: "待初评" }]),
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
      expect(screen.getAllByText("来访者001").length).toBeGreaterThan(0);
    });
  });

  it("创建来访者时只提交显示代号并自动选中新记录", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ client_code: "client_001", alias: "新来访者", status: "待初评" }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ client_code: "client_001", alias: "新来访者", status: "待初评" }]),
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

    await userEvent.type(screen.getByRole("textbox", { name: "显示代号" }), "新来访者");
    await userEvent.click(screen.getByRole("button", { name: /\+ 新建来访者档案/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/clients",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ alias: "新来访者" }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("新来访者").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/client_001/).length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/已创建来访者.*新来访者.*。/)).toBeInTheDocument();
  });

  it("渲染本地存储与仅供参考提示", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/仅供参考/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/保存在当前设备本地/)).toBeInTheDocument();
  });

  it("提交分析后渲染结果内容", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ client_code: "client_001", alias: "来访者001", status: "待初评" }]),
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
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("来访者001").length).toBeGreaterThan(0);
    });

    await userEvent.type(
      screen.getByRole("textbox", { name: "会谈文本" }),
      "我最近一直很焦虑，总觉得事情会失控。",
    );
    await userEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(screen.getByText("核心观察")).toBeInTheDocument();
    });
  });

  it("分析请求进行中时禁用按钮并显示分析中状态", async () => {
    let resolveAnalyze!: (value: Response) => void;

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ client_code: "client_001", alias: "来访者001", status: "待初评" }]),
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
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("来访者001").length).toBeGreaterThan(0);
    });

    await userEvent.type(screen.getByRole("textbox", { name: "会谈文本" }), "我最近一直很焦虑。");
    await userEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "分析中..." })).toBeDisabled();
    });

    resolveAnalyze(
      new Response(JSON.stringify(createAnalysisResponse({ session_id: "session_loading" })), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /会谈文本/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /分析结果/ })).toBeInTheDocument();
    });
  });

  it("存在风险提醒时显示独立警示区", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ client_code: "client_001", alias: "来访者001", status: "待初评" }]),
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
            analysis: {
              emotion_labels: ["羞耻", "无望"],
              intensity: "高",
              cognitive_patterns: ["灾难化思维"],
              emotion_target: "自身",
              confidence: 0.91,
              risk_level: "urgent",
            },
            risk_alert: {
              level: "urgent",
              signals: ["无价值感", "孤立感"],
              summary: "需要优先进行风险复核",
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
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("来访者001").length).toBeGreaterThan(0);
    });

    await userEvent.type(
      screen.getByRole("textbox", { name: "会谈文本" }),
      "我今天又搞砸了，反正也没人会在乎。",
    );
    await userEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(screen.getAllByText("需要优先进行风险复核").length).toBeGreaterThan(0);
    });
  });

  it("保存反馈时提交评分范围与颜色字段", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ client_code: "client_001", alias: "来访者001", status: "待初评" }]),
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
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          createAnalysisResponse({
            feedback: {
              notes: "建议继续澄清自动化思维。",
              notes_color: "red",
              rating: 88,
              disagreements: {
                cognitive_patterns: "我认为更接近自我贬低而非单纯灾难化。",
              },
              disagreement_colors: {
                cognitive_patterns: "blue",
              },
            },
          }),
        ),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("来访者001").length).toBeGreaterThan(0);
    });

    await userEvent.type(screen.getByRole("textbox", { name: "会谈文本" }), "我最近一直很焦虑。");
    await userEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(screen.getByText("核心观察")).toBeInTheDocument();
    });

    await userEvent.click(screen.getAllByRole("button", { name: "红色" })[0]);
    await userEvent.type(
      screen.getByRole("textbox", { name: "批注说明" }),
      "建议继续澄清自动化思维。",
    );
    await userEvent.type(screen.getByRole("spinbutton", { name: "评分 (0-100)" }), "88");
    await userEvent.click(screen.getAllByRole("button", { name: "蓝色" })[1]);
    await userEvent.type(
      screen.getByRole("textbox", { name: "认知模式分歧" }),
      "我认为更接近自我贬低而非单纯灾难化。",
    );
    await userEvent.click(screen.getByRole("button", { name: "保存反馈" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sessions/session_001/feedback",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            notes: "建议继续澄清自动化思维。",
            notes_color: "red",
            rating: 88,
            disagreements: {
              cognitive_patterns: "我认为更接近自我贬低而非单纯灾难化。",
            },
            disagreement_colors: {
              cognitive_patterns: "blue",
            },
          }),
        }),
      );
    });

    expect(screen.getByText("专业反馈已保存。")).toBeInTheDocument();
  });
});
