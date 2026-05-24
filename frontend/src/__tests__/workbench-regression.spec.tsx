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
    source_text: "我今天又搞砸了，反正也没人会在乎。",
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
  source_text: "我今天又搞砸了，反正也没人会在乎。",
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

async function renderWithLatestSession() {
  fetchMock.mockResolvedValueOnce(
    jsonResponse([{ client_code: "client_101", alias: "Demo Client 101", status: "需风险复核" }]),
  );
  fetchMock.mockResolvedValueOnce(jsonResponse([sessionSummary]));
  fetchMock.mockResolvedValueOnce(jsonResponse(createSessionRecord()));

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText("核心观察")).toBeInTheDocument();
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

    await userEvent.clear(screen.getByDisplayValue(/围绕来访者表述/));
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
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sessions/session_001/worksheet",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(savedWorksheet),
        }),
      );
    });

    expect(screen.getByText("REBT 工作纸已保存。")).toBeInTheDocument();
  });

  it("keeps the breadcrumb aligned with the case overview tab", async () => {
    await renderWithLatestSession();

    await userEvent.click(screen.getByRole("button", { name: /个案概览/ }));

    const crumbs = document.querySelector(".crumbs");
    expect(crumbs).not.toBeNull();
    expect(within(crumbs as HTMLElement).getByText("个案概览")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /个案概览/ })).toHaveClass("is-on");
  });
});
