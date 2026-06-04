import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FeedbackPanel } from "../components/FeedbackPanel";
import type { AnnotationFeedback } from "../types";

const feedback: AnnotationFeedback = {
  notes: "当前批注",
  notes_color: "black",
  rating: 91,
  disagreements: {},
  disagreement_colors: {},
  history: [
    {
      saved_at: "2026-06-04T08-12-00Z",
      notes: "第一次批注",
      notes_color: "red",
      rating: 82,
      disagreements: {
        cognitive_patterns: "更像自我贬低。",
      },
      disagreement_colors: {
        cognitive_patterns: "blue",
      },
    },
    {
      saved_at: "2026-06-04T09-20-00Z",
      notes: "第二次批注",
      notes_color: "black",
      rating: 91,
      disagreements: {},
      disagreement_colors: {},
    },
  ],
};

describe("FeedbackPanel", () => {
  it("renders feedback history in newest-first order", async () => {
    render(<FeedbackPanel feedback={feedback} isSaving={false} onSave={vi.fn()} />);

    expect(screen.getByText("批注版本记录")).toBeInTheDocument();
    expect(screen.getByText("第 2 次修改")).toBeInTheDocument();
    expect(screen.getByText("91 分")).toBeInTheDocument();

    await userEvent.click(screen.getByText("第 1 次修改"));

    expect(screen.getByText("第一次批注")).toBeInTheDocument();
    expect(screen.getByText("认知模式分歧：更像自我贬低。")).toBeInTheDocument();
  });
});
