import { FileImportButton } from "./FileImportButton";
import type { InputMode } from "./sessionText.types";

type ImportToolbarProps = {
  canSubmit: boolean;
  disabled?: boolean;
  inputMode: InputMode;
  onImportedText: (text: string) => void;
  onImportError: (message: string) => void;
  onModeChange: (mode: InputMode) => void;
  onSubmit: () => void;
};

export function ImportToolbar({
  canSubmit,
  disabled = false,
  inputMode,
  onImportedText,
  onImportError,
  onModeChange,
  onSubmit,
}: ImportToolbarProps) {
  return (
    <div className="import-toolbar">
      <div className="import-toolbar-left">
        <button
          className={inputMode === "split" ? "tab is-on session-mode-tab" : "tab session-mode-tab"}
          onClick={() => onModeChange("split")}
          type="button"
        >
          分角色输入
        </button>
        <button
          className={inputMode === "plain" ? "tab is-on session-mode-tab" : "tab session-mode-tab"}
          onClick={() => onModeChange("plain")}
          type="button"
        >
          纯文本粘贴
        </button>
      </div>
      <div className="import-toolbar-right">
        <FileImportButton
          disabled={disabled}
          onError={onImportError}
          onImportedText={onImportedText}
        />
        <button
          aria-label={disabled ? "分析中..." : "开始分析"}
          className="btn primary"
          disabled={!canSubmit || disabled}
          onClick={onSubmit}
          type="button"
        >
          {disabled ? "分析中..." : "提交分析"}
        </button>
      </div>
    </div>
  );
}
