import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CaseOverviewPanel } from "../components/CaseOverviewPanel";
import type { ClientProfile, SessionSummary } from "../types";

const client: ClientProfile = {
  client_code: "client_305",
  alias: "来访者002",
  status: "待初评",
};

function session(overrides: Partial<SessionSummary>): SessionSummary {
  return {
    session_id: "session_001",
    created_at: "2026-06-03T10:00:00Z",
    updated_at: "2026-06-03T10:00:00Z",
    source_text: "最近一次会谈内容。",
    emotion_labels: ["焦虑"],
    intensity: "high",
    cognitive_patterns: ["灾难化思维"],
    risk_level: "none",
    has_rebt_worksheet: false,
    ...overrides,
  };
}

describe("CaseOverviewPanel", () => {
  it("renders the visitor alias and recent trajectory", async () => {
    const onSelectSession = vi.fn();

    render(
      <CaseOverviewPanel
        client={client}
        onSelectSession={onSelectSession}
        sessions={[
          session({
            session_id: "session_003",
            created_at: "2026-06-03T12:00:00Z",
            source_text: "我担心这件事会失控。",
            emotion_labels: ["焦虑"],
            intensity: "high",
            cognitive_patterns: ["灾难化思维"],
            risk_level: "review",
            has_rebt_worksheet: true,
          }),
          session({
            session_id: "session_002",
            created_at: "2026-06-02T12:00:00Z",
            emotion_labels: ["羞耻"],
            intensity: "medium",
            cognitive_patterns: ["自我贬低"],
            risk_level: "none",
          }),
          session({
            session_id: "session_001",
            created_at: "2026-06-01T12:00:00Z",
            emotion_labels: ["焦虑"],
            intensity: "low",
            cognitive_patterns: ["灾难化思维"],
            risk_level: "none",
          }),
        ]}
      />,
    );

    expect(screen.getByText("来访者002")).toBeInTheDocument();
    expect(screen.getByText("历次提交变化趋势")).toBeInTheDocument();
    expect(screen.getByText("强度：高")).toBeInTheDocument();
    expect(screen.getAllByText("需复核").length).toBeGreaterThan(0);
    expect(screen.getAllByText("焦虑 · 灾难化思维").length).toBeGreaterThan(0);
    expect(screen.getByText("强度较上次上升：中 → 高。")).toBeInTheDocument();
    expect(screen.getAllByText("近三次有 1 次风险标记，需持续追踪。").length).toBeGreaterThan(0);
    expect(screen.getByText("高频模式可作为本阶段 REBT 工作纸的主要追踪对象，已完成工作纸 1 / 3 次。")).toBeInTheDocument();
    expect(screen.getByText("风险轨迹")).toBeInTheDocument();
    expect(screen.getByText("近 3 次出现 1 次")).toBeInTheDocument();
    expect(screen.getByText("近 5 次出现 1 次")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "查看 06/03 的会谈分析" }));

    expect(onSelectSession).toHaveBeenCalledWith("session_003");

    await userEvent.click(screen.getByRole("button", { name: /我担心这件事会失控/ }));

    expect(onSelectSession).toHaveBeenCalledWith("session_003");
  });
});
