import { useEffect, useMemo, useState, type FormEvent } from "react";

import { clientDisplayBadge, clientDisplayName } from "../clientDisplay";
import type { ClientProfile, CreateClientPayload } from "../types";

type ClientSidebarProps = {
  clients: ClientProfile[];
  activeClientCode: string | null;
  emptyMessage?: string;
  isCreatingClient: boolean;
  resetFilterSignal?: number;
  onSelectClient: (clientCode: string) => void;
  onCreateClient: (payload: CreateClientPayload) => Promise<void>;
};

const FILTER_OPTIONS = [
  { id: "all", label: "全部" },
  { id: "需风险复核", label: "紧急" },
  { id: "跟进中", label: "待复核" },
  { id: "待初评", label: "初评" },
  { id: "已结案", label: "已结案" },
] as const;

type FilterId = (typeof FILTER_OPTIONS)[number]["id"];

export function ClientSidebar({
  clients,
  activeClientCode,
  emptyMessage,
  isCreatingClient,
  resetFilterSignal,
  onSelectClient,
  onCreateClient,
}: ClientSidebarProps) {
  const [alias, setAlias] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");

  useEffect(() => {
    setActiveFilter("all");
  }, [resetFilterSignal]);

  const visibleClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesFilter = activeFilter === "all" ? true : client.status === activeFilter;
      return matchesFilter;
    });
  }, [activeFilter, clients]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!alias.trim()) {
      return;
    }
    await onCreateClient({ alias });
    setAlias("");
  }

  return (
    <>
      <div className="pane-head">
        <div className="pane-eyebrow">CLIENTS</div>
        <div className="pane-title">来访者档案</div>
        <div className="pane-sub">仅展示编号化的来访者记录。</div>
      </div>

      <div className="filter-row">
        {FILTER_OPTIONS.map((option) => {
          const count =
            option.id === "all"
              ? clients.length
              : clients.filter((client) => client.status === option.id).length;
          return (
            <button
              key={option.id}
              className={activeFilter === option.id ? "chip is-on" : "chip"}
              onClick={() => setActiveFilter(option.id)}
              type="button"
            >
              <span>{option.label}</span>
              <span className="count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="clients-list">
        {visibleClients.length === 0 ? (
          <div className="client-empty">
            <strong>未找到匹配档案</strong>
            <span>{emptyMessage ?? "请调整筛选条件后再试。"}</span>
          </div>
        ) : null}
        {visibleClients.map((client) => {
          const suffix = clientDisplayBadge(client);
          const displayName = clientDisplayName(client);
          return (
            <button
              key={client.client_code}
              className={client.client_code === activeClientCode ? "client is-active" : "client"}
              onClick={() => onSelectClient(client.client_code)}
              type="button"
            >
              <div className="client-mono">{suffix}</div>
              <div className="client-meta">
                <div className="client-name">{displayName}</div>
                <span>{client.client_code}</span>
              </div>
              <div className="client-status">
                <span className={`pill ${statusPillClass(client.status)}`}>{client.status}</span>
              </div>
            </button>
          );
        })}
      </div>

      <form className="new-client" onSubmit={handleSubmit}>
        <label>
          <span>显示代号</span>
          <input
            aria-label="显示代号"
            placeholder="例如：来访者A、初诊个案01"
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
          />
        </label>
        <button className="btn" disabled={!alias.trim() || isCreatingClient} type="submit">
          {isCreatingClient ? "+ 创建中..." : "+ 新建来访者档案"}
        </button>
      </form>
    </>
  );
}

function statusPillClass(status: ClientProfile["status"]): string {
  switch (status) {
    case "待初评":
      return "muted";
    case "跟进中":
      return "warn";
    case "需风险复核":
      return "risk";
    case "已稳定":
      return "good";
    case "已结案":
      return "muted";
  }
}
