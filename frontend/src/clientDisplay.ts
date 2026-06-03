import type { ClientProfile } from "./types";

export function clientDisplayName(client: ClientProfile): string {
  return client.alias.trim() || client.client_code;
}

export function clientDisplayBadge(client: ClientProfile): string {
  const displayName = clientDisplayName(client);
  const aliasSuffix = displayName.match(/(\d+)$/)?.[1];

  if (aliasSuffix) {
    return aliasSuffix;
  }

  return client.client_code.replace(/^client_/, "");
}
