import { useEffect, useRef } from "react";

import { parseSpeakerPrefixedText, parsedLinesToSegments } from "./sessionText.utils";
import type { TranscriptSegment } from "./sessionText.types";

type PlainTextEditorProps = {
  autoFocusMode?: "edit" | "append";
  clientCode: string | null;
  detectedSegments: TranscriptSegment[];
  highlightAppend?: boolean;
  plainText: string;
  showDetectionBanner: boolean;
  onDismissDetection: () => void;
  onDetectedSegments: (segments: TranscriptSegment[]) => void;
  onPlainTextChange: (text: string) => void;
  onSwitchToSplit: (segments: TranscriptSegment[]) => void;
};

function autoResize(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

export function PlainTextEditor({
  autoFocusMode = "edit",
  clientCode,
  detectedSegments,
  highlightAppend = false,
  plainText,
  showDetectionBanner,
  onDismissDetection,
  onDetectedSegments,
  onPlainTextChange,
  onSwitchToSplit,
}: PlainTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }
    autoResize(textareaRef.current);
    if (autoFocusMode !== "append") {
      return;
    }
    textareaRef.current.focus();
    const end = textareaRef.current.value.length;
    textareaRef.current.setSelectionRange(end, end);
  }, [autoFocusMode, plainText]);

  function inspectText(text: string) {
    const parsed = parseSpeakerPrefixedText(text);
    if (parsed.shouldSuggestSplit) {
      onDetectedSegments(parsedLinesToSegments(parsed.parsedLines));
    }
  }

  return (
    <div className="editor-wrap plain-text-editor">
      {showDetectionBanner ? (
        <div className="risk-banner session-info-banner">
          <div className="row gap-sm">
            <span className="risk-icon">!</span>
            <div>
              <div className="risk-title">检测到角色前缀</div>
              <div className="risk-body">是否切换到分角色模式？</div>
            </div>
          </div>
          <div className="auto-detect-actions">
            <button className="btn ghost sm" onClick={() => onSwitchToSplit(detectedSegments)} type="button">
              切换
            </button>
            <button className="btn ghost sm" onClick={onDismissDetection} type="button">
              保持原样
            </button>
          </div>
        </div>
      ) : null}
      <div className="editor-toolbar">
        <span className="tool-meta">
          {clientCode ? `当前来访者：${clientCode}` : "请先创建或选择来访者"}
        </span>
        <div className="tool-grow" />
        <span className="tool-meta">{plainText.length} 字</span>
      </div>
      <textarea
        ref={textareaRef}
        aria-label="会谈文本"
        className={highlightAppend ? "editor editor-append-highlight" : "editor"}
        placeholder="输入本次会谈中的核心表达、关键片段或整理后的文本记录。"
        value={plainText}
        onChange={(event) => {
          onPlainTextChange(event.target.value);
          autoResize(event.currentTarget);
        }}
        onPaste={(event) => {
          const pastedText = event.clipboardData.getData("text");
          inspectText(pastedText);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              autoResize(textareaRef.current);
            }
          });
        }}
      />
      <div className="parse-hint-bar">
        系统会尝试自动识别说话人；如果需要精确区分，请使用“分角色输入”模式。
      </div>
    </div>
  );
}
