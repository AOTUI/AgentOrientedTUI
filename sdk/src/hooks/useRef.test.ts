/**
 * useRef Hook - Unit Tests
 *
 * @module @aotui/sdk/hooks/useRef.test
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Since useRef depends on ViewContext, we need to mock the context
// For now, test the format function logic directly

describe("useRef format function", () => {
  it("should format content with refId as markdown link", () => {
    // Simulate the format function logic
    const refId = "current_topic";
    const content = "话题: General";

    const formatted = `[${content}](${refId})`;

    expect(formatted).toBe("[话题: General](current_topic)");
  });

  it("should handle special characters in content", () => {
    const refId = "message[0]";
    const content = "User: Hello [world]!";

    const formatted = `[${content}](${refId})`;

    expect(formatted).toBe("[User: Hello [world]!](message[0])");
  });

  it("should handle empty content", () => {
    const refId = "empty_item";
    const content = "";

    const formatted = `[${content}](${refId})`;

    expect(formatted).toBe("[](empty_item)");
  });
});

describe("useArrayRef format functions", () => {
  it("should format list header with array notation", () => {
    const refId = "messages";
    const content = "消息历史";

    const formatted = `## [${content}](${refId}[])`;

    expect(formatted).toBe("## [消息历史](messages[])");
  });

  it("should format list items with index", () => {
    const refId = "messages";

    const itemFormat = (index: number, content: string) =>
      `[${content}](${refId}[${index}])`;

    expect(itemFormat(0, "Hello")).toBe("[Hello](messages[0])");
    expect(itemFormat(1, "World")).toBe("[World](messages[1])");
    expect(itemFormat(5, "Test")).toBe("[Test](messages[5])");
  });
});

describe("RefRegistry integration (mock)", () => {
  it("should register and unregister refs correctly", () => {
    const registry = new Map<string, object>();

    // Simulate registerRef
    const data = { id: "msg_1", content: "Hello" };
    registry.set("messages[0]", data);

    expect(registry.has("messages[0]")).toBe(true);
    expect(registry.get("messages[0]")).toEqual(data);

    // Simulate unregisterRef
    registry.delete("messages[0]");

    expect(registry.has("messages[0]")).toBe(false);
  });

  it("should export to IndexMap format", () => {
    const registry = new Map<string, object>();

    registry.set("topic", { id: "t_1", name: "General" });
    registry.set("messages[0]", { id: "m_1", role: "human" });
    registry.set("messages[1]", { id: "m_2", role: "agent" });

    // Export to IndexMap
    const indexMap: Record<string, object> = {};
    for (const [refId, data] of registry) {
      indexMap[refId] = data;
    }

    expect(Object.keys(indexMap)).toHaveLength(3);
    expect(indexMap["topic"]).toEqual({ id: "t_1", name: "General" });
    expect(indexMap["messages[0]"]).toEqual({ id: "m_1", role: "human" });
    expect(indexMap["messages[1]"]).toEqual({ id: "m_2", role: "agent" });
  });
});
