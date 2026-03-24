/** @jsxImportSource preact */
import { describe, expect, it } from "vitest";
import { renderTUI } from "../src/projection/tui/renderTUI";
import { useArrayRef } from "../src/ref/useArrayRef";
import { useDataRef } from "../src/ref/useDataRef";

describe("ref hooks", () => {
  it("useDataRef returns a formatter and registers serialized payload", () => {
    const message = { id: "m1", subject: "Welcome back" };

    function TestView() {
      const ref = useDataRef("message", message, "messages[0]");
      return <text>{ref("Pinned message")}</text>;
    }

    const bundle = renderTUI(<TestView />, { visibleTools: [] });

    expect(bundle.tui).toContain("(Pinned message)[message:messages[0]]");
    expect(bundle.refIndex["messages[0]"]).toEqual({
      type: "message",
      value: { id: "m1", subject: "Welcome back" },
    });
  });

  it("useArrayRef registers both list and item refs", () => {
    const messages = [{ id: "m1" }, { id: "m2" }];

    function TestView() {
      const [listRef, itemRef] = useArrayRef("message", messages, "messages");

      return (
        <screen>
          <text>{listRef("All messages")}</text>
          <text>{itemRef(1, "Second")}</text>
        </screen>
      );
    }

    const bundle = renderTUI(<TestView />, { visibleTools: [] });

    expect(bundle.refIndex["messages"]).toEqual({
      type: "message[]",
      value: [{ id: "m1" }, { id: "m2" }],
    });
    expect(bundle.refIndex["messages[1]"]).toEqual({
      type: "message",
      value: { id: "m2" },
    });
  });
});
