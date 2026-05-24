import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";

const fetchMock = vi.fn();

describe("client top search", () => {
  beforeEach(() => {
    cleanup();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("searches by numeric client code from the top bar and resets status filtering", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { client_code: "client_303", alias: "02", status: "待初评" },
          { client_code: "client_304", alias: "来访者001", status: "跟进中" },
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
      expect(screen.getByText("来访者001")).toBeInTheDocument();
    });

    await userEvent.click(screen.getAllByRole("button", { name: /初评/ })[0]);
    expect(screen.queryByText("来访者001")).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "搜索来访者" }), "304");
    await userEvent.click(screen.getByRole("button", { name: "搜索" }));

    await waitFor(() => {
      expect(screen.getByText("来访者001")).toBeInTheDocument();
      expect(screen.getByText("client_304")).toBeInTheDocument();
    });
  });
});
