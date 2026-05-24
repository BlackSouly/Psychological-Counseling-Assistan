import { useEffect, useMemo, useRef, useState } from "react";

import {
  analyzeSession,
  createClient,
  deleteClient,
  fetchClients,
  fetchClientSessions,
  fetchSession,
  updateClientStatus,
  updateSessionFeedback,
  updateSessionWorksheet,
} from "./api";
import { AnalysisResultPanel } from "./components/AnalysisResultPanel";
import { CaseOverviewPanel } from "./components/CaseOverviewPanel";
import { ClientSidebar } from "./components/ClientSidebar";
import { FeedbackPanel } from "./components/FeedbackPanel";
import { TextAnalysisForm } from "./components/TextAnalysisForm";
import { TimelinePanel } from "./components/TimelinePanel";
import type {
  ClientProfile,
  ClientStatus,
  CreateClientPayload,
  RebtWorksheet,
  SessionRecord,
  SessionSummary,
} from "./types";

type WorkbenchTab = "input" | "analysis" | "feedback" | "overview";
type InspectorTab = "feedback" | "timeline" | "supervise" | "plan";

const WORKBENCH_TAB_LABELS: Record<WorkbenchTab, string> = {
  input: "会谈文本",
  analysis: "会谈分析",
  feedback: "批注与评分",
  overview: "个案概览",
};

const CLIENT_STATUSES: ClientStatus[] = [
  "待初评",
  "跟进中",
  "需风险复核",
  "已稳定",
  "已结案",
];

const SUPERVISION_ITEMS = [
  {
    period: "本周 \u00b7 2026 W19",
    body: "布置睡眠日记 + 三栏思维记录，识别\u201c反正...\u201d句式的触发情境。",
  },
  {
    period: "下周 \u00b7 2026 W20",
    body: "行为实验：尝试主动邀请 1 位朋友进行一次 30 分钟交流，并记录预期 vs 实际感受。",
  },
  {
    period: "长期",
    body: "围绕\u201c我必须做好所有事\u201d展开苏格拉底式提问，松动绝对化标签。",
  },
];

const PLAN_ITEMS = [
  {
    period: "本周 \u00b7 2026 W19",
    body: "布置睡眠日记 + 三栏思维记录，识别\u201c反正...\u201d句式的触发情境。",
  },
  {
    period: "下周 \u00b7 2026 W20",
    body: "行为实验：尝试主动邀请 1 位朋友进行一次 30 分钟交流，并记录预期 vs 实际感受。",
  },
  {
    period: "长期",
    body: "围绕\u201c我必须做好所有事\u201d展开苏格拉底式提问，松动绝对化标签。",
  },
];

export default function App() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [activeClientCode, setActiveClientCode] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [result, setResult] = useState<SessionRecord | null>(null);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);
  const [isSavingWorksheet, setIsSavingWorksheet] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>("input");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("feedback");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [clientSearchDraft, setClientSearchDraft] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientSearchResetSignal, setClientSearchResetSignal] = useState(0);
  const topSearchInputRef = useRef<HTMLInputElement>(null);

  const activeClient = clients.find((client) => client.client_code === activeClientCode) ?? null;

  const activeSessionBadge = useMemo(() => {
    if (!result) {
      return null;
    }
    const sessionIndex = sessions.findIndex((session) => session.session_id === result.session_id);
    if (sessionIndex === -1) {
      return "当前会话";
    }
    return `会话 ${String(sessionIndex + 1).padStart(2, "0")}`;
  }, [result, sessions]);

  const searchedClients = useMemo(() => {
    const query = clientSearchQuery.trim().toLowerCase();
    if (!query) {
      return clients;
    }
    return clients.filter((client) => {
      const searchableText = `${client.alias} ${client.client_code} ${client.status}`.toLowerCase();
      return searchableText.includes(query);
    });
  }, [clients, clientSearchQuery]);
  const hasActiveClientSearch = clientSearchQuery.trim().length > 0;

  function submitClientSearch() {
    setClientSearchQuery(clientSearchDraft);
    setClientSearchResetSignal((signal) => signal + 1);
  }

  function clearClientSearch() {
    setClientSearchDraft("");
    setClientSearchQuery("");
    setClientSearchResetSignal((signal) => signal + 1);
    topSearchInputRef.current?.focus();
  }

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        topSearchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!activeClientCode) {
      setResult(null);
      setSessions([]);
      setWorkbenchTab("input");
      return;
    }

    let isCurrentClient = true;
    setResult(null);
    setWorkbenchTab("input");

    void (async () => {
      const nextSessions = await loadSessions(activeClientCode);
      if (!isCurrentClient || nextSessions.length === 0) {
        return;
      }

      try {
        const latestSession = await fetchSession(nextSessions[0].session_id);
        if (!isCurrentClient) {
          return;
        }
        setResult(latestSession);
        setWorkbenchTab("analysis");
        setInspectorTab("feedback");
      } catch (error) {
        if (isCurrentClient) {
          setErrorMessage(error instanceof Error ? error.message : "读取记录详情失败。");
        }
      }
    })();

    return () => {
      isCurrentClient = false;
    };
  }, [activeClientCode]);

  async function loadClients() {
    setIsLoadingClients(true);
    setErrorMessage(null);
    try {
      const nextClients = await fetchClients();
      setClients(nextClients);
      setActiveClientCode((current) => current ?? nextClients[0]?.client_code ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载来访者列表失败。");
    } finally {
      setIsLoadingClients(false);
    }
  }

  async function loadSessions(clientCode: string): Promise<SessionSummary[]> {
    try {
      const nextSessions = await fetchClientSessions(clientCode);
      setSessions(nextSessions);
      return nextSessions;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载历史记录失败。");
      return [];
    }
  }

  async function handleCreateClient(payload: CreateClientPayload) {
    try {
      setIsCreatingClient(true);
      setErrorMessage(null);
      setStatusMessage(null);

      const createdClient = await createClient(payload);
      await loadClients();
      setActiveClientCode(createdClient.client_code);
      setStatusMessage(`已创建来访者"${createdClient.alias}"。`);
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "创建来访者失败。");
    } finally {
      setIsCreatingClient(false);
    }
  }

  async function handleAnalyze(sourceText: string) {
    if (!activeClientCode || isAnalyzing) {
      return;
    }

    try {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setStatusMessage(null);

      const nextResult = await analyzeSession(activeClientCode, sourceText);
      setResult(nextResult);
      setWorkbenchTab("analysis");
      setInspectorTab("feedback");
      await loadSessions(activeClientCode);
      setStatusMessage("分析已完成，已生成结构化结果。");
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "分析文本失败。");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleUpdateClientStatus(status: ClientStatus) {
    if (!activeClientCode) {
      return;
    }

    try {
      setErrorMessage(null);
      setStatusMessage(null);

      const updatedClient = await updateClientStatus(activeClientCode, { status });
      setClients((current) =>
        current.map((client) =>
          client.client_code === updatedClient.client_code ? updatedClient : client,
        ),
      );
      setStatusMessage(`已更新来访者"${updatedClient.alias}"的处理状态。`);
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "更新来访者处理状态失败。");
    }
  }

  async function handleDeleteClient() {
    if (!activeClient) {
      return;
    }

    const confirmed = window.confirm(
      `确定删除来访者"${activeClient.alias}"及其全部本地记录吗？此操作不可撤销。`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setErrorMessage(null);
      setStatusMessage(null);

      const deletedClient = activeClient;
      const remainingClients = clients.filter(
        (client) => client.client_code !== deletedClient.client_code,
      );
      const nextActiveClientCode = remainingClients[0]?.client_code ?? null;

      await deleteClient(deletedClient.client_code);

      setClients(remainingClients);
      setActiveClientCode(nextActiveClientCode);
      setResult((current) =>
        current?.client_code === deletedClient.client_code ? null : current,
      );
      setWorkbenchTab("input");
      if (!nextActiveClientCode) {
        setSessions([]);
      }
      setStatusMessage(`已删除来访者"${deletedClient.alias}"。`);
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "删除来访者失败。");
    }
  }

  async function handleSelectSession(sessionId: string) {
    try {
      setErrorMessage(null);
      const session = await fetchSession(sessionId);
      setResult(session);
      setWorkbenchTab("analysis");
      setInspectorTab("feedback");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取记录详情失败。");
    }
  }

  async function handleSaveFeedback(sessionId: string, feedback: SessionRecord["feedback"]) {
    try {
      setIsSavingFeedback(true);
      setErrorMessage(null);
      setStatusMessage(null);
      const updated = await updateSessionFeedback(sessionId, feedback);
      setResult(updated);
      setStatusMessage("专业反馈已保存。");
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "保存反馈失败。");
    } finally {
      setIsSavingFeedback(false);
    }
  }

  async function handleSaveWorksheet(sessionId: string, worksheet: RebtWorksheet) {
    try {
      setIsSavingWorksheet(true);
      setErrorMessage(null);
      setStatusMessage(null);
      const updated = await updateSessionWorksheet(sessionId, worksheet);
      setResult(updated);
      setStatusMessage("REBT 工作纸已保存。");
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "保存 REBT 工作纸失败。");
    } finally {
      setIsSavingWorksheet(false);
    }
  }

  function renderWorkbenchBody() {
    if (workbenchTab === "input") {
      return (
        <>
          <TextAnalysisForm
            clientCode={activeClientCode}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyze}
          />
          <div className="disclaim">
            <span className="dot">!</span>
            <span>
              AI 输出仅供参考，不能替代专业判断。涉及风险信号时请遵循机构安全协议进行复核与转介。
            </span>
          </div>
        </>
      );
    }

    if (workbenchTab === "feedback") {
      if (!result) {
        return (
          <div className="empty-state">
            <h3>暂无专业反馈对象</h3>
            <p>请先选择一条历史记录，或先完成一次新的分析。</p>
          </div>
        );
      }

      return (
        <div className="fb-card fade-in">
          <div className="fb-eyebrow">FEEDBACK</div>
          <span className="pill muted">{activeSessionBadge ?? "SESSION"}</span>
          <FeedbackPanel
            feedback={result.feedback}
            isSaving={isSavingFeedback}
            onSave={(feedback) => handleSaveFeedback(result.session_id, feedback)}
          />
        </div>
      );
    }

    if (workbenchTab === "overview") {
      return <CaseOverviewPanel client={activeClient} sessions={sessions} />;
    }

    return (
      <AnalysisResultPanel
        isSavingFeedback={isSavingFeedback}
        isSavingWorksheet={isSavingWorksheet}
        onSaveFeedback={handleSaveFeedback}
        onSaveWorksheet={handleSaveWorksheet}
        result={result}
        showFeedback={false}
      />
    );
  }

  const clientIndexSuffix = activeClient
    ? activeClient.client_code.replace("client_", "")
    : "";

  return (
    <div className="app" data-theme={theme}>
      {/* ——— TopBar ——— */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">心</div>
          <div>
            <strong>心理分析辅助评估</strong>
            <span>REBT Workbench</span>
          </div>
        </div>

        <div className="crumbs">
          <span>工作台</span>
          <span className="sep">/</span>
          <span className="now">{activeClient ? activeClient.alias : "编号档案"}</span>
          <span className="sep">/</span>
          <span className="now">{WORKBENCH_TAB_LABELS[workbenchTab]}</span>
          {isAnalyzing ? <span className="sep">/</span> : null}
          {isAnalyzing ? <span className="now">分析中...</span> : null}
        </div>

        <div className="top-actions">
          <form
            className="top-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              submitClientSearch();
            }}
          >
            <span className="search-icon">⌕</span>
            <input
              aria-label="搜索来访者"
              placeholder="搜索编号 / 标签..."
              ref={topSearchInputRef}
              value={clientSearchDraft}
              onChange={(event) => setClientSearchDraft(event.target.value)}
            />
            <span className="search-shortcut">快捷搜索</span>
            {clientSearchQuery || clientSearchDraft ? (
              <button
                aria-label="清空搜索"
                className="top-search-clear"
                onClick={clearClientSearch}
                type="button"
              >
                ×
              </button>
            ) : null}
            <button className="top-search-submit" type="submit">
              搜索
            </button>
          </form>
          <button
            aria-label={theme === "dark" ? "切换为日间模式" : "切换为夜间模式"}
            aria-pressed={theme === "dark"}
            className="icon-btn"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            type="button"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button aria-label="设置" className="icon-btn" type="button">
            ⚙
          </button>
        </div>
      </header>

      {/* ——— Panes ——— */}
      <div className="panes">
        {/* ClientsPane (left) */}
        <div className="pane">
          <ClientSidebar
            activeClientCode={activeClientCode}
            clients={searchedClients}
            emptyMessage={
              hasActiveClientSearch
                ? `没有找到包含“${clientSearchQuery.trim()}”的来访者档案。`
                : undefined
            }
            isCreatingClient={isCreatingClient}
            resetFilterSignal={clientSearchResetSignal}
            onCreateClient={handleCreateClient}
            onSelectClient={setActiveClientCode}
          />
        </div>

        {/* Workbench (center) */}
        <div className="workbench">
          <div className="wb-head">
            <div className="pane-eyebrow">WORKBENCH</div>
            <div className="pane-title">会谈分析</div>
            <div className="pane-sub">
              本工具将记录保存在当前设备本地，仅提供 AI 辅助分析结果供专业人员参考，不构成诊断结论。
            </div>
          </div>

          <div className="wb-tabs">
            <button
              className={workbenchTab === "input" ? "tab is-on" : "tab"}
              onClick={() => setWorkbenchTab("input")}
              type="button"
            >
              <span>会谈文本</span>
              <span className="num">01</span>
            </button>
            <button
              className={workbenchTab === "analysis" ? "tab is-on" : "tab"}
              onClick={() => setWorkbenchTab("analysis")}
              type="button"
            >
              <span>分析结果</span>
              <span className="num">02</span>
            </button>
            <button
              className={workbenchTab === "feedback" ? "tab is-on" : "tab"}
              onClick={() => {
                setWorkbenchTab("feedback");
                setInspectorTab("feedback");
              }}
              type="button"
            >
              <span>批注与评分</span>
              <span className="num">03</span>
            </button>
            <button
              className={workbenchTab === "overview" ? "tab is-on" : "tab"}
              onClick={() => setWorkbenchTab("overview")}
              type="button"
            >
              <span>个案概览</span>
              <span className="num">04</span>
            </button>
          </div>

          <div className="wb-body">
            {activeClient ? (
              <div className="client-banner">
                <div className="row gap-sm">
                  <div className="banner-av">{clientIndexSuffix}</div>
                  <div className="banner-info">
                    <div className="banner-name">
                      编号档案 · {clientIndexSuffix}
                    </div>
                    <div className="banner-meta">
                      {activeClient.client_code} · {sessions.length} 次会谈 · 状态：{activeClient.status}
                    </div>
                  </div>
                </div>
                <div className="banner-actions">
                  <span className={`pill ${statusPillClass(activeClient.status)}`}>
                    {activeClient.status}
                  </span>
                  <label className="sr-only">处理状态</label>
                  <select
                    aria-label="处理状态"
                    value={activeClient.status}
                    onChange={(event) => void handleUpdateClientStatus(event.target.value as ClientStatus)}
                  >
                    {CLIENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <span className="history-chip">历史</span>
                  <button className="danger-btn" onClick={() => void handleDeleteClient()} type="button">
                    删除来访者
                  </button>
                </div>
              </div>
            ) : null}

            {isLoadingClients ? <div className="progress fade-in"><span /></div> : null}
            {statusMessage ? <p className="status-banner fade-in" role="status">{statusMessage}</p> : null}
            {errorMessage ? <p className="error-banner fade-in">{errorMessage}</p> : null}

            {renderWorkbenchBody()}
          </div>
        </div>

        {/* RightPane */}
        <aside className="right-pane">
          <div className="pane-head">
            <div className="pane-eyebrow">INSPECTOR</div>
            <div className="pane-title">检视与反馈</div>
          </div>

          <div className="right-tabs">
            <button
              className={inspectorTab === "feedback" ? "tab is-on" : "tab"}
              onClick={() => setInspectorTab("feedback")}
              type="button"
            >
              专业反馈
            </button>
            <button
              className={inspectorTab === "timeline" ? "tab is-on" : "tab"}
              onClick={() => setInspectorTab("timeline")}
              type="button"
            >
              时间线
            </button>
            <button
              className={inspectorTab === "supervise" ? "tab is-on" : "tab"}
              onClick={() => setInspectorTab("supervise")}
              type="button"
            >
              督导
            </button>
            <button
              className={inspectorTab === "plan" ? "tab is-on" : "tab"}
              onClick={() => setInspectorTab("plan")}
              type="button"
            >
              计划
            </button>
          </div>

          <div className="right-body">
            {inspectorTab === "feedback" ? (
              result ? (
                <div className="fb-card fade-in">
                  <div className="fb-eyebrow">FEEDBACK</div>
                  <span className="pill muted">{activeSessionBadge ?? "SESSION"}</span>
                  <FeedbackPanel
                    feedback={result.feedback}
                    isSaving={isSavingFeedback}
                    onSave={(feedback) => handleSaveFeedback(result.session_id, feedback)}
                  />
                </div>
              ) : (
                <div className="empty-state">
                  <h3>暂无专业反馈对象</h3>
                  <p>请先选择一条历史记录，或先完成一次新的分析。</p>
                </div>
              )
            ) : inspectorTab === "timeline" ? (
              <TimelinePanel onSelectSession={handleSelectSession} sessions={sessions} />
            ) : inspectorTab === "supervise" ? (
              <div className="result-section">
                {SUPERVISION_ITEMS.map((item) => (
                  <article key={item.period} className="tl-item">
                    <div className="tl-meta">
                      <span>{item.period}</span>
                    </div>
                    <p className="tl-snippet" style={{ whiteSpace: "normal", overflow: "visible" }}>
                      {item.body}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="result-section">
                {PLAN_ITEMS.map((item) => (
                  <article key={item.period} className="tl-item">
                    <div className="tl-meta">
                      <span>{item.period}</span>
                    </div>
                    <p className="tl-snippet" style={{ whiteSpace: "normal", overflow: "visible" }}>
                      {item.body}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ——— StatusBar ——— */}
      <footer className="statusbar">
        <div className="grow">
          <span className="dot" />
          <span>本地存储</span>
          <span>&middot;</span>
          <span>已加密</span>
          <span>&middot;</span>
          <span>模型 &middot; clinical-7b</span>
          <span>&middot;</span>
          <span>仅辅助参考</span>
        </div>
        <div>v1.4.0 &middot; build 2026.05.08</div>
      </footer>
    </div>
  );
}

function statusPillClass(status: ClientStatus): string {
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
