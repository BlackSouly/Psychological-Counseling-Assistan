import { describe, expect, it } from "vitest";

import { clientDisplayBadge, clientDisplayName } from "../clientDisplay";
import type { ClientProfile } from "../types";

describe("client display identity", () => {
  it("uses the visitor alias as the visible identity and badge source", () => {
    const client: ClientProfile = {
      client_code: "client_305",
      alias: "来访者002",
      status: "待初评",
    };

    expect(clientDisplayName(client)).toBe("来访者002");
    expect(clientDisplayBadge(client)).toBe("002");
  });

  it("keeps the internal code as a badge source when no alias number exists", () => {
    const client: ClientProfile = {
      client_code: "client_305",
      alias: "Demo Client",
      status: "待初评",
    };

    expect(clientDisplayName(client)).toBe("Demo Client");
    expect(clientDisplayBadge(client)).toBe("305");
  });
});
