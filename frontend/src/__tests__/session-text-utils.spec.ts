import { describe, expect, it } from "vitest";

import {
  parseSpeakerPrefixedText,
  segmentsToAnalysisText,
  speakerLabel,
} from "../components/SessionText/sessionText.utils";

describe("sessionText utilities", () => {
  it("parses Chinese and shorthand speaker prefixes", () => {
    const result = parseSpeakerPrefixedText(
      [
        "来访者：我最近睡不着。",
        "咨询师: 这种情况从什么时候开始？",
        "C: 大概两周前。",
        "T：那两周前发生了什么？",
        "CP: 工作压力突然变大。",
        "TP：我们先把触发事件梳理清楚。",
      ].join("\n"),
    );

    expect(result.shouldSuggestSplit).toBe(true);
    expect(result.parsedLines).toEqual([
      { speaker: "client", text: "我最近睡不着。" },
      { speaker: "therapist", text: "这种情况从什么时候开始？" },
      { speaker: "client", text: "大概两周前。" },
      { speaker: "therapist", text: "那两周前发生了什么？" },
      { speaker: "client", text: "工作压力突然变大。" },
      { speaker: "therapist", text: "我们先把触发事件梳理清楚。" },
    ]);
  });

  it("formats transcript segments as readable Chinese analysis text", () => {
    const text = segmentsToAnalysisText([
      {
        id: "segment_1",
        speaker: "client",
        timestamp: "00:01",
        text: "我觉得自己撑不住了。",
      },
      {
        id: "segment_2",
        speaker: "therapist",
        text: "我们先看看这个想法出现的场景。",
      },
    ]);

    expect(text).toBe("来访者 00:01：我觉得自己撑不住了。\n咨询师：我们先看看这个想法出现的场景。");
  });

  it("returns readable Chinese speaker labels", () => {
    expect(speakerLabel("client")).toBe("来访者");
    expect(speakerLabel("therapist")).toBe("咨询师");
  });
});
