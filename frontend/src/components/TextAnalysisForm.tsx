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
    <form className="analysis-form" onSubmit={handleSubmit}>
      <div className="analysis-toolbar">
        <span className="analysis-status">
          {clientCode ? `当前来访者：${clientCode}` : "请先创建或选择来访者"}
        </span>
      </div>
      <label>
        会谈文本
        <textarea
          name="sourceText"
          placeholder="输入本次会谈中的核心表达、关键片段或整理后的文本记录。"
          rows={14}
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
        />
      </label>
      <div className="analysis-footer">
        <p className="helper">
          AI 输出仅供参考，不能替代专业判断。
        </p>
        <button type="submit" disabled={!clientCode || !sourceText.trim() || isAnalyzing}>
          {isAnalyzing ? "分析中..." : "开始分析"}
        </button>
      </div>
    </form>
  );
}
