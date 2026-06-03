import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionTextPanel } from "../components/SessionText/SessionTextPanel";

function seedSplitSessionText() {
  window.localStorage.setItem(
    "sessionText:draft:client_101",
    JSON.stringify({
      sessionId: "draft:client_101",
      inputMode: "split",
      segments: [],
      plainText: "",
      timelineEntries: [
        {
          entryId: "timeline_1",
          inputMode: "split",
          submittedAt: "2026-06-03T10:00:00Z",
          segments: [
            {
              id: "segment_client_1",
              speaker: "client",
              text: "我这周一直很紧张。",
            },
            {
              id: "segment_therapist_1",
              speaker: "therapist",
              text: "最近最明显的触发点是什么？",
            },
          ],
        },
      ],
      annotations: [],
      pinnedQuotes: [],
      analysisSubmittedAt: "2026-06-03T10:00:00Z",
    }),
  );
}

function seedPlainSessionText() {
  window.localStorage.setItem(
    "sessionText:draft:client_102",
    JSON.stringify({
      sessionId: "draft:client_102",
      inputMode: "plain",
      segments: [],
      plainText: "",
      timelineEntries: [
        {
          entryId: "timeline_1",
          inputMode: "plain",
          submittedAt: "2026-06-03T10:00:00Z",
          segments: [
            {
              id: "segment_plain_1",
              speaker: "client",
              text: "第一段记录。\n第二段记录。",
            },
          ],
        },
      ],
      annotations: [],
      pinnedQuotes: [],
      analysisSubmittedAt: "2026-06-03T10:00:00Z",
    }),
  );
}

describe("SessionTextPanel", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("adds a new alternating speaker segment when appending in split mode", async () => {
    seedSplitSessionText();

    render(<SessionTextPanel clientCode="client_101" isAnalyzing={false} />);

    await userEvent.click(screen.getByRole("button", { name: "补充内容" }));

    const clientTextareas = screen.getAllByLabelText("来访者发言");
    expect(clientTextareas).toHaveLength(1);
    expect(screen.queryAllByLabelText("咨询师发言")).toHaveLength(0);
    const appendedInput = clientTextareas[0];
    expect(appendedInput).toHaveValue("");
    await waitFor(() => {
      expect(appendedInput).toHaveFocus();
    });
    expect(document.querySelector(".segment-row-appended")).not.toBeNull();
  });

  it("returns to the latest submitted split content without appending when re-editing", async () => {
    seedSplitSessionText();

    render(<SessionTextPanel clientCode="client_101" isAnalyzing={false} />);

    await userEvent.click(screen.getByRole("button", { name: "修订这一段" }));

    expect(screen.getAllByLabelText("来访者发言")).toHaveLength(1);
    expect(screen.getAllByLabelText("咨询师发言")).toHaveLength(1);
    expect(screen.getByDisplayValue("我这周一直很紧张。")).toBeInTheDocument();
    expect(document.querySelector(".segment-row-appended")).toBeNull();
  });

  it("opens a fresh plain-text draft when appending after a submitted entry", async () => {
    seedPlainSessionText();

    render(<SessionTextPanel clientCode="client_102" isAnalyzing={false} />);

    await userEvent.click(screen.getByRole("button", { name: "补充内容" }));

    const editor = screen.getByRole("textbox", { name: "会谈文本" });
    expect(editor).toHaveClass("editor-append-highlight");
    expect(editor).toHaveValue("");
    await waitFor(() => {
      expect(editor).toHaveFocus();
    });
  });

  it("migrates legacy submitted content into the timeline view", () => {
    window.localStorage.setItem(
      "sessionText:draft:client_103",
      JSON.stringify({
        sessionId: "draft:client_103",
        inputMode: "plain",
        segments: [],
        plainText: "这是一段旧版本里已经提交过的会谈文本。",
        annotations: [],
        pinnedQuotes: [],
        analysisSubmittedAt: "2026-06-03T10:00:00Z",
      }),
    );

    render(<SessionTextPanel clientCode="client_103" isAnalyzing={false} />);

    expect(screen.getByText("会谈时间线")).toBeInTheDocument();
    expect(screen.getByText("这是一段旧版本里已经提交过的会谈文本。")).toBeInTheDocument();
  });

  it("submits appended split content through the analyze callback", async () => {
    seedSplitSessionText();
    const onAnalyze = vi.fn().mockResolvedValue(undefined);

    render(
      <SessionTextPanel clientCode="client_101" isAnalyzing={false} onAnalyze={onAnalyze} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "补充内容" }));

    const appendedInput = screen.getAllByLabelText("来访者发言")[0];
    await userEvent.type(appendedInput, "我昨晚也开始失眠了。");
    await userEvent.click(screen.getByRole("button", { name: "开始分析" }));

    await waitFor(() => {
      expect(onAnalyze).toHaveBeenCalledTimes(1);
    });
    expect(onAnalyze).toHaveBeenCalledWith(expect.stringContaining("来访者：我昨晚也开始失眠了。"));
  });

  it("switches to the linked analysis when clicking a timeline entry", async () => {
    window.localStorage.setItem(
      "sessionText:draft:client_104",
      JSON.stringify({
        sessionId: "draft:client_104",
        inputMode: "plain",
        segments: [],
        plainText: "",
        timelineEntries: [
          {
            entryId: "timeline_1",
            inputMode: "plain",
            submittedAt: "2026-06-03T09:00:00Z",
            segments: [
              {
                id: "segment_plain_old",
                speaker: "client",
                text: "这是第一次会谈记录。",
              },
            ],
          },
          {
            entryId: "timeline_2",
            inputMode: "plain",
            sessionId: "session_current",
            submittedAt: "2026-06-03T10:00:00Z",
            segments: [
              {
                id: "segment_plain_current",
                speaker: "client",
                text: "这是当前正在查看的会谈记录。",
              },
            ],
          },
        ],
        annotations: [],
        pinnedQuotes: [],
        analysisSubmittedAt: "2026-06-03T10:00:00Z",
      }),
    );

    const onSelectTimelineEntry = vi.fn();

    render(
      <SessionTextPanel
        clientCode="client_104"
        currentAnalysisSessionId="session_current"
        currentAnalyzedText="这是当前正在查看的会谈记录。"
        isAnalyzing={false}
        onSelectTimelineEntry={onSelectTimelineEntry}
        timelineSessionCandidates={[
          {
            session_id: "session_older",
            created_at: "2026-06-03T09:00:00Z",
            source_text: "这是第一次会谈记录。",
          },
          {
            session_id: "session_current",
            created_at: "2026-06-03T10:00:00Z",
            source_text: "这是当前正在查看的会谈记录。",
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /查看这次分析/ }));

    expect(onSelectTimelineEntry).toHaveBeenCalledWith("session_older");
  });

  it("links older timeline entries by submitted time when the backend has extra sessions", async () => {
    window.localStorage.setItem(
      "sessionText:draft:client_105",
      JSON.stringify({
        sessionId: "draft:client_105",
        inputMode: "plain",
        segments: [],
        plainText: "",
        timelineEntries: [
          {
            entryId: "timeline_first",
            inputMode: "plain",
            submittedAt: "2026-06-02T14:47:03Z",
            segments: [
              {
                id: "segment_plain_first",
                speaker: "client",
                text: "这是最早一次提交。",
              },
            ],
          },
          {
            entryId: "timeline_current",
            inputMode: "plain",
            sessionId: "session_current",
            submittedAt: "2026-06-03T03:01:40Z",
            segments: [
              {
                id: "segment_plain_current",
                speaker: "client",
                text: "这是当前正在查看的提交。",
              },
            ],
          },
        ],
        annotations: [],
        pinnedQuotes: [],
        analysisSubmittedAt: "2026-06-03T03:01:40Z",
      }),
    );

    const onSelectTimelineEntry = vi.fn();

    render(
      <SessionTextPanel
        clientCode="client_105"
        currentAnalysisSessionId="session_current"
        currentAnalyzedText="这是当前正在查看的提交。"
        isAnalyzing={false}
        onSelectTimelineEntry={onSelectTimelineEntry}
        timelineSessionCandidates={[
          {
            session_id: "session_extra",
            created_at: "2026-06-02T15:29:55Z",
            source_text: "这是额外的后端历史记录。",
          },
          {
            session_id: "session_first",
            created_at: "2026-06-02T14:47:03Z",
            source_text: "后端文本不必完全相同。",
          },
          {
            session_id: "session_current",
            created_at: "2026-06-03T03:01:40Z",
            source_text: "这是当前正在查看的提交。",
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /查看这次分析/ }));

    expect(onSelectTimelineEntry).toHaveBeenCalledWith("session_first");
  });
});
