import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../App";

const fetchMock = vi.fn();

describe("client delete workflow", () => {
  beforeEach(() => {
    cleanup();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn());
  });

  it("deletes the active client after confirmation and selects the next client", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);

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
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
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

    await userEvent.click(screen.getByRole("button", { name: "删除来访者" }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/clients/client_001",
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    expect(screen.queryByRole("button", { name: /来访者001/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /来访者002/ })).toBeInTheDocument();
    expect(screen.getByText(/已删除来访者.*来访者001.*。/)).toBeInTheDocument();
  });

  it("does not delete the client when confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);

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
      expect(screen.getByRole("button", { name: /来访者001/ })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "删除来访者" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/clients/client_001",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
    expect(screen.getByRole("button", { name: /来访者001/ })).toBeInTheDocument();
  });
});
