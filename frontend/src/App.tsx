import { useEffect, useState } from "react";

import {
  analyzeSession,
  createClient,
  fetchClients,
  fetchClientSessions,
  fetchSession,
  updateClientStatus,
  updateSessionFeedback,
} from "./api";
import { AnalysisResultPanel } from "./components/AnalysisResultPanel";
import { ClientSidebar } from "./components/ClientSidebar";
import { TextAnalysisForm } from "./components/TextAnalysisForm";
import { TimelinePanel } from "./components/TimelinePanel";
import type { ClientProfile, ClientStatus, CreateClientPayload, SessionRecord, SessionSummary } from "./types";

export default function App() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [activeClientCode, setActiveClientCode] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [result, setResult] = useState<SessionRecord | null>(null);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const activeClient = clients.find((client) => client.client_code === activeClientCode) ?? null;

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    if (!activeClientCode) {
      setSessions([]);
      return;
    }
    void loadSessions(activeClientCode);
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

  async function loadSessions(clientCode: string) {
    try {
      const nextSessions = await fetchClientSessions(clientCode);
      setSessions(nextSessions);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载历史记录失败。");
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
      setStatusMessage(`已创建来访者“${createdClient.alias}”。`);
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
      setStatusMessage(`已更新来访者“${updatedClient.alias}”的处理状态。`);
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "更新来访者处理状态失败。");
    }
  }

  async function handleSelectSession(sessionId: string) {
    try {
      setErrorMessage(null);
      const session = await fetchSession(sessionId);
      setResult(session);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取记录详情失败。");
    }
  }

  async function handleSaveFeedback(
    sessionId: string,
    feedback: SessionRecord["feedback"],
  ) {
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

  return (
    <div className="app-shell">
      <ClientSidebar
        activeClientCode={activeClientCode}
        activeClient={activeClient}
        clients={clients}
        isCreatingClient={isCreatingClient}
        onCreateClient={handleCreateClient}
        onSelectClient={setActiveClientCode}
        onUpdateClientStatus={handleUpdateClientStatus}
      />
      <main className="workspace">
        <section className="input-panel">
          <div className="panel-header">
            <div className="panel-kicker">会谈工作台</div>
            <h2>会谈文本</h2>
            <p className="policy-copy">
              本工具将会谈记录保存在当前设备本地，仅提供 AI 辅助分析结果供专业人员参考，不构成诊断结论。
            </p>
            <p className="panel-subcopy">请选择一位编号来访者，然后提交文本进行分析。</p>
          </div>
          {isLoadingClients ? <p>正在加载本地来访者记录...</p> : null}
          {statusMessage ? <p className="status-copy status-copy-success" role="status">{statusMessage}</p> : null}
          {errorMessage ? <p className="error-copy">{errorMessage}</p> : null}
          <TextAnalysisForm
            clientCode={activeClientCode}
            isAnalyzing={isAnalyzing}
            onAnalyze={handleAnalyze}
          />
        </section>
        <div className="result-column">
          <AnalysisResultPanel
            isSavingFeedback={isSavingFeedback}
            onSaveFeedback={handleSaveFeedback}
            result={result}
          />
          <TimelinePanel onSelectSession={handleSelectSession} sessions={sessions} />
        </div>
      </main>
    </div>
  );
}
