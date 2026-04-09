import { h } from "preact";
import type { ComponentChildren, JSX } from "preact";

export type ViewProps = {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly children?: ComponentChildren;
} & JSX.HTMLAttributes<HTMLElement>;

export function View(props: ViewProps): JSX.Element {
  const { children, ...rest } = props;
  return h("View", rest, children);
}
