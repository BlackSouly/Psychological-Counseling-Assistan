import { useState, type FormEvent } from "react";

type TextAnalysisFormProps = {
  clientCode: string | null;
  isAnalyzing: boolean;
  onAnalyze: (sourceText: string) => Promise<void>;
};

export function TextAnalysisForm({ clientCode, isAnalyzing, onAnalyze }: TextAnalysisFormProps) {
  const [sourceText, setSourceText] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onAnalyze(sourceText);
  }

  return (
    <form className="editor-wrap" onSubmit={handleSubmit}>
      <div className="editor-toolbar">
        <span className="tool-meta">
          {clientCode ? `当前来访者：${clientCode}` : "请先创建或选择来访者"}
        </span>
        <div className="tool-grow" />
        <span className="tool-meta">{sourceText.length} 字</span>
      </div>

      <textarea
        aria-label="会谈文本"
        className="editor"
        name="sourceText"
        placeholder="输入本次会谈中的核心表达、关键片段或整理后的文本记录。"
        rows={14}
        value={sourceText}
        onChange={(event) => setSourceText(event.target.value)}
      />

      <div className="editor-foot">
        <div className="foot-meta">
          <span className="item">AI 输出仅供参考</span>
        </div>
        <div className="foot-grow" />
        <button
          className="btn primary"
          disabled={!clientCode || !sourceText.trim() || isAnalyzing}
          type="submit"
        >
          {isAnalyzing ? "分析中..." : "开始分析"}
        </button>
      </div>
    </form>
  );
}
