import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import type { SessionRecord, SessionSummary } from "../types";

const fetchMock = vi.fn();

const emptyWorksheet = {
  activating_event: "",
  belief: "",
  consequence: "",
  dispute: "",
  effective_belief: "",
  homework: "",
  follow_up: "",
};

function createSessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    session_id: "session_001",
    client_code: "client_101",
    created_at: "2026-05-08T10:00:00Z",
    updated_at: "2026-05-08T10:00:00Z",
    source_text: "我今天又搞砸了，反正也没人在乎。",
    analysis: {
      emotion_labels: ["羞耻", "沮丧"],
      intensity: "high",
      cognitive_patterns: ["过度概括"],
      emotion_target: "self",
      confidence: 0.95,
      risk_level: "review",
    },
    risk_alert: {
      level: "review",
      signals: ["自我贬低"],
      summary: "需要进一步风险复核。",
    },
    interpretation: "一、核心观察\n来访者出现明显自我贬低。\n二、干预建议\n优先稳定情绪后再进入信念挑战。",
    rebt_plan: { items: [] },
    feedback: {
      notes: "",
      notes_color: "black",
      rating: null,
      disagreements: {},
      disagreement_colors: {},
    },
    rebt_worksheet: emptyWorksheet,
    ...overrides,
  };
}

const sessionSummary: SessionSummary = {
  session_id: "session_001",
  created_at: "2026-05-08T10:00:00Z",
  updated_at: "2026-05-08T10:00:00Z",
  source_text: "我今天又搞砸了，反正也没人在乎。",
  emotion_labels: ["羞耻"],
  intensity: "high",
  cognitive_patterns: ["过度概括"],
  risk_level: "review",
  has_rebt_worksheet: false,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function renderWithLatestSession(record = createSessionRecord(), waitForText = "核心观察") {
  fetchMock.mockResolvedValueOnce(
    jsonResponse([{ client_code: "client_101", alias: "Demo Client 101", status: "需风险复核" }]),
  );
  fetchMock.mockResolvedValueOnce(jsonResponse([sessionSummary]));
  fetchMock.mockResolvedValueOnce(jsonResponse(record));

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText(waitForText)).toBeInTheDocument();
  });
}

describe("workbench regression coverage", () => {
  beforeEach(() => {
    cleanup();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("saves the REBT worksheet with all structured fields", async () => {
    const savedWorksheet = {
      activating_event: "来访者描述今天工作失误。",
      belief: "我必须做好，否则我就是失败者。",
      consequence: "羞耻、回避与自我否定。",
      dispute: "一次失误是否等于整个人没有价值？",
      effective_belief: "我希望做好，但失误不定义我。",
      homework: "记录一次触发事件和替代信念。",
      follow_up: "下次复盘替代信念是否降低情绪强度。",
    };

    await renderWithLatestSession();

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        createSessionRecord({
          rebt_worksheet: savedWorksheet,
        }),
      ),
    );

    await userEvent.clear(screen.getByLabelText("A 触发事件"));
    await userEvent.type(screen.getByLabelText("A 触发事件"), savedWorksheet.activating_event);
    await userEvent.clear(screen.getByLabelText("B 信念/解释"));
    await userEvent.type(screen.getByLabelText("B 信念/解释"), savedWorksheet.belief);
    await userEvent.clear(screen.getByLabelText("C 情绪与行为后果"));
    await userEvent.type(screen.getByLabelText("C 情绪与行为后果"), savedWorksheet.consequence);
    await userEvent.clear(screen.getByLabelText("D 反驳问题"));
    await userEvent.type(screen.getByLabelText("D 反驳问题"), savedWorksheet.dispute);
    await userEvent.clear(screen.getByLabelText("E 新有效信念"));
    await userEvent.type(screen.getByLabelText("E 新有效信念"), savedWorksheet.effective_belief);
    await userEvent.clear(screen.getByLabelText("家庭练习"));
    await userEvent.type(screen.getByLabelText("家庭练习"), savedWorksheet.homework);
    await userEvent.clear(screen.getByLabelText("下次会谈追踪"));
    await userEvent.type(screen.getByLabelText("下次会谈追踪"), savedWorksheet.follow_up);

    await userEvent.click(screen.getByRole("button", { name: "保存工作纸" }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[0]).toBe("/api/sessions/session_001/worksheet");
      expect(lastCall?.[1]).toEqual(expect.objectContaining({ method: "PATCH" }));
      const payload = JSON.parse(String(lastCall?.[1]?.body ?? "{}"));
      expect(payload).toMatchObject({
        belief: savedWorksheet.belief,
        consequence: savedWorksheet.consequence,
        dispute: savedWorksheet.dispute,
        effective_belief: savedWorksheet.effective_belief,
        homework: savedWorksheet.homework,
        follow_up: savedWorksheet.follow_up,
      });
      expect(payload.activating_event).toContain(savedWorksheet.activating_event);
    });

    expect(screen.getByText("REBT 工作纸已保存到当前会谈记录。")).toBeInTheDocument();
  });

  it("renders line-by-line REBT interpretation and uses the worksheet draft", async () => {
    const worksheetDraft = {
      activating_event: "来访者说今天又搞砸了。",
      belief: "一次失败说明我整体不行。",
      consequence: "羞耻、沮丧，并倾向于放弃求助。",
      dispute: "一次失败是否足以证明整个人没有价值？",
      effective_belief: "我这次表现不理想，但这不等于我整个人失败。",
      homework: "记录一次失败事件，并写出行为评价与自我评价的区别。",
      follow_up: "下次复盘新信念是否降低羞耻强度。",
    };

    await renderWithLatestSession(
      createSessionRecord({
        rebt_plan: {
          line_interpretations: [
            {
              source_quote: "我今天又搞砸了",
              rebt_step: "A/B 链条",
              activating_event: "来访者报告一次失败体验。",
              belief: "把一次失败扩大为整体失败。",
              consequence: "羞耻和自我否定升高。",
              dispute_direction: "区分具体行为失误与整体自我价值。",
              intervention_question: "这次搞砸具体指哪一件事？",
              risk_note: "关注是否伴随放弃或自我忽视。",
            },
          ],
          items: [
            {
              title: "D 辩论：区分行为与自我",
              detail: "围绕原句追问具体失败事件，并检验是否能推出整体自我否定。",
              source_quote: "我今天又搞砸了",
            },
          ],
          worksheet_draft: worksheetDraft,
        },
      }),
    );

    expect(screen.getByText("关键句逐句解读")).toBeInTheDocument();
    expect(screen.getByText("重点")).toBeInTheDocument();
    expect(screen.getByText("环节 · A/B 链条")).toBeInTheDocument();
    expect(screen.getByText("信念靶点")).toBeInTheDocument();
    expect(screen.getByText("后果证据")).toBeInTheDocument();
    expect(screen.getByText("可辩论")).toBeInTheDocument();
    expect(screen.getAllByText("需复核").length).toBeGreaterThan(0);
    expect(screen.getByText("A/B 链条")).toBeInTheDocument();
    expect(screen.getAllByText("“我今天又搞砸了”").length).toBeGreaterThan(0);
    expect(screen.getByText("D 辩论：区分行为与自我")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("A 触发事件")).toHaveValue(worksheetDraft.activating_event);
      expect(screen.getByLabelText("B 信念/解释")).toHaveValue(worksheetDraft.belief);
      expect(screen.getByLabelText("D 反驳问题")).toHaveValue(worksheetDraft.dispute);
      expect(screen.getByLabelText("家庭练习")).toHaveValue(worksheetDraft.homework);
    });
    expect(screen.getByText("来自逐句解读 · A 触发事件")).toBeInTheDocument();
    expect(screen.getByText("来自逐句解读 · B 信念靶点")).toBeInTheDocument();
    expect(screen.getByText("来自逐句解读 · C 后果证据")).toBeInTheDocument();
    expect(screen.getByText("来自逐句解读 · D 辩论方向")).toBeInTheDocument();
    expect(screen.getByText("来自工作纸草案 · E 新信念")).toBeInTheDocument();
    expect(screen.getByText("来自工作纸草案 · 家庭练习")).toBeInTheDocument();
    expect(screen.getByText("来自工作纸草案 · 下次追踪")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "来自逐句解读 · B 信念靶点" }));
    expect(document.getElementById("line-rebt-card-0")).toHaveClass("line-rebt-card-highlight");
  });

  it("renders the new REBT conceptualization as layered sections", async () => {
    await renderWithLatestSession(
      createSessionRecord({
        interpretation:
          "一、核心概念化\n来访者把一次工作失误等同于自我价值失败。\n二、维持机制\n反复自责和回避让羞耻感继续升高。\n三、风险与边界\n需要先复核功能受损和安全风险，再进入信念挑战。\n四、干预优先级\n先稳定情绪，再澄清 A-B-C，随后进入 D/E。",
      }),
      "核心概念化",
    );

    expect(screen.getByText("FORMULATION")).toBeInTheDocument();
    expect(screen.getByText("MAINTENANCE")).toBeInTheDocument();
    expect(screen.getByText("BOUNDARY")).toBeInTheDocument();
    expect(screen.getByText("SEQUENCE")).toBeInTheDocument();
    expect(screen.getByText("核心概念化").closest(".rebt-layer-card")).not.toBeNull();
    expect(screen.getByText("维持机制").closest(".rebt-layer-card")).not.toBeNull();
    expect(screen.getByText("风险与边界").closest(".rebt-layer-card")).not.toBeNull();
    expect(screen.getByText("干预优先级").closest(".rebt-layer-card")).not.toBeNull();
  });

  it("keeps the breadcrumb aligned with the case overview tab", async () => {
    await renderWithLatestSession();

    await userEvent.click(screen.getByRole("button", { name: /个案概览/ }));

    const crumbs = document.querySelector(".crumbs");
    expect(crumbs).not.toBeNull();
    expect(within(crumbs as HTMLElement).getByText("个案概览")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /个案概览/ })).toHaveClass("is-on");
  });

  it("regenerates a missing REBT plan for a legacy session", async () => {
    await renderWithLatestSession();

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        createSessionRecord({
          interpretation: "一、核心观察\n这是新的结构化解读。",
          rebt_plan: {
            items: [
              {
                title: "澄清失控预期",
                detail: "围绕原句追问证据与可控部分。",
                source_quote: "事情会失控",
              },
            ],
          },
        }),
      ),
    );

    await userEvent.click(screen.getByRole("button", { name: "重新生成" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sessions/session_001/rebt-plan",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("澄清失控预期")).toBeInTheDocument();
    });
  });

  it("shows progress copy while regenerating detailed REBT content", async () => {
    let resolveRegeneration!: (value: Response) => void;

    await renderWithLatestSession();

    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRegeneration = resolve;
        }),
    );

    await userEvent.click(screen.getByRole("button", { name: "重新生成" }));

    expect(
      screen.getByText("正在重新生成逐句 REBT 解读、干预建议和工作纸草案，可能需要 1-2 分钟。"),
    ).toBeInTheDocument();

    resolveRegeneration(
      jsonResponse(
        createSessionRecord({
          interpretation: "一、核心观察\n这是新的结构化解读。",
          rebt_plan: {
            items: [
              {
                title: "澄清失控预期",
                detail: "围绕原句追问证据与可控部分。",
                source_quote: "事情会失控",
              },
            ],
          },
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText("澄清失控预期")).toBeInTheDocument();
    });
  });
});
