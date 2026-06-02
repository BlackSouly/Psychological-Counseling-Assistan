import type { Annotation, AnnotationColor } from "./sessionText.types";

type AnnotationLayerProps = {
  annotations: Annotation[];
  segmentId: string;
  text: string;
  onAnnotationClick: (annotation: Annotation) => void;
};

type TextPart =
  | { type: "text"; key: string; text: string }
  | { type: "annotation"; annotation: Annotation; key: string; text: string };

function annotationOrder(a: Annotation, b: Annotation): number {
  return a.startOffset - b.startOffset || a.endOffset - b.endOffset;
}

export function AnnotationLayer({
  annotations,
  segmentId,
  text,
  onAnnotationClick,
}: AnnotationLayerProps) {
  const segmentAnnotations = annotations
    .filter((annotation) => annotation.segmentId === segmentId)
    .filter((annotation) => annotation.startOffset >= 0 && annotation.endOffset <= text.length)
    .sort(annotationOrder);
  const parts: TextPart[] = [];
  let cursor = 0;

  segmentAnnotations.forEach((annotation) => {
    if (annotation.startOffset < cursor) {
      return;
    }
    if (annotation.startOffset > cursor) {
      parts.push({
        type: "text",
        key: `text_${cursor}_${annotation.startOffset}`,
        text: text.slice(cursor, annotation.startOffset),
      });
    }
    parts.push({
      type: "annotation",
      annotation,
      key: annotation.id,
      text: text.slice(annotation.startOffset, annotation.endOffset),
    });
    cursor = annotation.endOffset;
  });

  if (cursor < text.length) {
    parts.push({ type: "text", key: `text_${cursor}_end`, text: text.slice(cursor) });
  }

  if (parts.length === 0) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part) => {
        if (part.type === "text") {
          return <span key={part.key}>{part.text}</span>;
        }
        return (
          <button
            key={part.key}
            className={`annotation-highlight ${part.annotation.color}`}
            onClick={() => onAnnotationClick(part.annotation)}
            type="button"
          >
            {part.text}
          </button>
        );
      })}
    </>
  );
}

export const ANNOTATION_COLORS: AnnotationColor[] = ["black", "red", "blue"];
