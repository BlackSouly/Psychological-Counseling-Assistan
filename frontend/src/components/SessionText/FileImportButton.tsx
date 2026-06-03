import { useRef } from "react";

type FileImportButtonProps = {
  disabled?: boolean;
  onImportedText: (text: string) => void;
  onError: (message: string) => void;
};

async function readDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function readUtf8Text(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const text = decoder.decode(buffer);
  return text.replace(/^\uFEFF/, "");
}

export function FileImportButton({
  disabled = false,
  onImportedText,
  onError,
}: FileImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".txt")) {
        onImportedText(await readUtf8Text(file));
        return;
      }
      if (lowerName.endsWith(".docx")) {
        onImportedText(await readDocx(file));
        return;
      }
      onError("仅支持导入 .txt 或 .docx 文件。");
    } catch {
      onError("文件读取失败，请使用 UTF-8 编码的 .txt 或标准 .docx 文件。");
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <>
      <button
        className="btn ghost sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        导入文件
      </button>
      <input
        ref={inputRef}
        accept=".txt,.docx"
        className="sr-only"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFile(file);
          }
        }}
      />
    </>
  );
}
