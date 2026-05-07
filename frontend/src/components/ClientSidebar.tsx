import { useState, type FormEvent } from "react";

import type { ClientProfile, ClientStatus, CreateClientPayload } from "../types";

type ClientSidebarProps = {
  clients: ClientProfile[];
  activeClient: ClientProfile | null;
  activeClientCode: string | null;
  isCreatingClient: boolean;
  onSelectClient: (clientCode: string) => void;
  onCreateClient: (payload: CreateClientPayload) => Promise<void>;
  onUpdateClientStatus: (status: ClientStatus) => Promise<void>;
};

const CLIENT_STATUSES: ClientStatus[] = ["待初评", "跟进中", "需风险复核", "已稳定", "已结案"];

export function ClientSidebar(props: ClientSidebarProps) {
  const [alias, setAlias] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await props.onCreateClient({ alias });
    setAlias("");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="panel-kicker">Clients</div>
        <h1>来访者</h1>
        <p>仅展示编号化来访者记录。</p>
      </div>

      <div className="sidebar-summary">
        <span className="sidebar-summary-label">当前档案数</span>
        <strong className="sidebar-summary-value">{props.clients.length}</strong>
      </div>

      <form className="client-form" onSubmit={handleSubmit}>
        <label>
          显示代号
          <input
            placeholder="例如：来访者A、初诊个案01"
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!alias.trim() || props.isCreatingClient}>
          {props.isCreatingClient ? "创建中..." : "创建来访者"}
        </button>
      </form>

      {props.activeClient ? (
        <section className="client-status-card">
          <div className="client-status-head">
            <span className="client-status-label">处理状态</span>
            <span className={`client-status-pill client-status-pill-${encodeStatusClassName(props.activeClient.status)}`}>
              {props.activeClient.status}
            </span>
          </div>
          <label className="client-status-field">
            处理状态
            <select
              aria-label="处理状态"
              value={props.activeClient.status}
              onChange={(event) => void props.onUpdateClientStatus(event.target.value as ClientStatus)}
            >
              {CLIENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      <div className="sidebar-list-header sidebar-list-header-three">
        <span>显示代号</span>
        <span>状态</span>
        <span>编号</span>
      </div>

      <ul className="client-list">
        {props.clients.map((client) => (
          <li key={client.client_code}>
            <button
              className={client.client_code === props.activeClientCode ? "client-button active" : "client-button"}
              onClick={() => props.onSelectClient(client.client_code)}
              type="button"
            >
              <div className="client-button-row">
                <strong>{client.alias}</strong>
                <span className="client-code-pill">{client.client_code}</span>
              </div>
              <div className="client-button-row client-button-row-meta">
                <span className={`client-status-pill client-status-pill-${encodeStatusClassName(client.status)}`}>
                  {client.status}
                </span>
                <span className="client-button-meta">本地编号档案</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function encodeStatusClassName(status: ClientStatus): string {
  switch (status) {
    case "待初评":
      return "intake";
    case "跟进中":
      return "active";
    case "需风险复核":
      return "review";
    case "已稳定":
      return "stable";
    case "已结案":
      return "closed";
  }
}
