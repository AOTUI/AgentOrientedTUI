/** @jsxImportSource preact */
import renderToString from "preact-render-to-string";
import type { ComponentChildren } from "preact";
import { View } from "./View";
import type { ViewFragment } from "../../core/types";

export type RenderViewFragmentInput = {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly children?: ComponentChildren;
  readonly markup?: string;
};

export function renderViewFragment(
  input: RenderViewFragmentInput,
): ViewFragment {
  const content =
    input.markup !== undefined
      ? { dangerouslySetInnerHTML: { __html: input.markup } }
      : { children: input.children };

  return {
    id: input.id,
    type: input.type,
    name: input.name,
    markup: renderToString(
      <View id={input.id} type={input.type} name={input.name} {...content} />,
    ),
  };
}
