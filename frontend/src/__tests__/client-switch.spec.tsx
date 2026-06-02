import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../App";

const fetchMock = vi.fn();

describe("client switch workflow", () => {
  beforeEach(() => {
    cleanup();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("clears the previous analysis result when switching to a different client", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { client_code: "client_001", alias: "来访者001", status: "待初评" },
          { client_code: "client_002", alias: "来访者002", status: "跟进中" },
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
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session_id: "session_001",
          client_code: "client_001",
          created_at: "2026-05-08T10:00:00Z",
          source_text: "我最近一直很焦虑。",
          analysis: {
            emotion_labels: ["焦虑"],
            intensity: "高",
            cognitive_patterns: ["灾难化思维"],
            emotion_target: "自身",
            confidence: 0.91,
            risk_level: "none",
          },
          risk_alert: null,
          interpretation: "一、核心观察\n这是第一位来访者的结果。",
          rebt_plan: { items: [] },
          feedback: {
            notes: "",
            notes_color: "black",
            rating: null,
            disagreements: {},
            disagreement_colors: {},
          },
        }),
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
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /来访者001/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /来访者002/ })).toBeInTheDocument();
    });

    await userEvent.type(screen.getByRole("textbox", { name: "会谈文本" }), "我最近一直很焦虑。");
    await userEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(screen.getByText("这是第一位来访者的结果。")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /来访者002/ }));

    await waitFor(() => {
      expect(screen.getByText("当前来访者：client_002")).toBeInTheDocument();
    });

    expect(screen.queryByText("这是第一位来访者的结果。")).not.toBeInTheDocument();
  });
});
