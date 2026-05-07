import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../App";

const fetchMock = vi.fn();

describe("client status workflow", () => {
  beforeEach(() => {
    cleanup();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders client statuses and lets the user update the active client status", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ client_code: "client_001", alias: "来访者001", status: "待初评" }]), {
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
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ client_code: "client_001", alias: "来访者001", status: "需风险复核" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("来访者001")).toBeInTheDocument();
    });

    expect(screen.getAllByText("待初评").length).toBeGreaterThan(0);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "处理状态" }), "需风险复核");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/clients/client_001",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "需风险复核" }),
        }),
      );
    });

    expect(screen.getAllByText("需风险复核").length).toBeGreaterThan(0);
  });
});
