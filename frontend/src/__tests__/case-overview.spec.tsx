import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  buildCaseOverviewExportFileName,
  buildCaseOverviewMarkdown,
  CaseOverviewPanel,
} from "../components/CaseOverviewPanel";
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
            rebt_formulation: {
              activating_events: ["截稿压力"],
              beliefs: ["必须表现出色"],
              consequences: ["拖延和心慌"],
              disputes: ["是否一次失败就等于职业失败"],
              effective_beliefs: ["可以先完成一个可修改版本"],
              interventions: ["行为实验"],
            },
          }),
          session({
            session_id: "session_002",
            created_at: "2026-06-02T12:00:00Z",
            emotion_labels: ["羞耻"],
            intensity: "medium",
            cognitive_patterns: ["自我贬低"],
            risk_level: "none",
            rebt_formulation: {
              activating_events: ["收到负面反馈"],
              beliefs: ["必须表现出色"],
              consequences: ["羞耻和回避"],
              disputes: ["评价是否代表全部能力"],
              effective_beliefs: [],
              interventions: ["证据检验"],
            },
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
    expect(screen.getByText("阶段性 REBT formulation")).toBeInTheDocument();
    expect(screen.getByText("必须表现出色 · 2")).toBeInTheDocument();
    expect(screen.getByText("截稿压力 · 1")).toBeInTheDocument();
    expect(screen.getByText("行为实验 · 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "查看 06/03 的会谈分析" }));

    expect(onSelectSession).toHaveBeenCalledWith("session_003");

    await userEvent.click(screen.getByRole("button", { name: /我担心这件事会失控/ }));

    expect(onSelectSession).toHaveBeenCalledWith("session_003");
  });

  it("exports the case overview report as markdown", async () => {
    let downloadedName = "";
    const appendedLinks: HTMLAnchorElement[] = [];
    const createObjectURL = vi.fn(() => "blob:case-overview");
    const revokeObjectURL = vi.fn();
    const appendChild = vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) {
        appendedLinks.push(node);
      }
      return node;
    });
    const removeChild = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function click(this: HTMLAnchorElement) {
        downloadedName = this.download;
      });

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });

    render(
      <CaseOverviewPanel
        client={client}
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
            rebt_formulation: {
              activating_events: ["截稿压力"],
              beliefs: ["必须表现出色"],
              consequences: ["拖延和心慌"],
              disputes: ["是否一次失败就等于职业失败"],
              effective_beliefs: ["可以先完成一个可修改版本"],
              interventions: ["行为实验"],
            },
          }),
          session({
            session_id: "session_002",
            created_at: "2026-06-02T12:00:00Z",
            emotion_labels: ["羞耻"],
            intensity: "medium",
            cognitive_patterns: ["自我贬低"],
            risk_level: "none",
          }),
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "导出个案报告" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloadedName).toBe("来访者002个案报告.md");
    expect(appendedLinks[0]?.download).toBe("来访者002个案报告.md");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:case-overview");

    appendChild.mockRestore();
    removeChild.mockRestore();
    anchorClick.mockRestore();
  });

  it("builds a detailed case overview markdown export", () => {
    const markdown = buildCaseOverviewMarkdown(client, [
      session({
        session_id: "session_003",
        created_at: "2026-06-03T12:00:00Z",
        source_text: "我担心这件事会失控。",
        emotion_labels: ["焦虑"],
        intensity: "high",
        cognitive_patterns: ["灾难化思维"],
        risk_level: "review",
        has_rebt_worksheet: true,
        rebt_formulation: {
          activating_events: ["截稿压力"],
          beliefs: ["必须表现出色"],
          consequences: ["拖延和心慌"],
          disputes: ["是否一次失败就等于职业失败"],
          effective_beliefs: ["可以先完成一个可修改版本"],
          interventions: ["行为实验"],
        },
      }),
      session({
        session_id: "session_002",
        created_at: "2026-06-02T12:00:00Z",
        emotion_labels: ["羞耻"],
        intensity: "medium",
        cognitive_patterns: ["自我贬低"],
        risk_level: "none",
      }),
    ]);

    expect(buildCaseOverviewExportFileName(client)).toBe("来访者002个案报告.md");
    expect(markdown).toContain("# 个案报告");
    expect(markdown).toContain("## 阶段性 REBT formulation");
    expect(markdown).toContain("## 风险轨迹");
    expect(markdown).toContain("必须表现出色 · 1");
    expect(markdown).toContain("我担心这件事会失控。");
  });
});
