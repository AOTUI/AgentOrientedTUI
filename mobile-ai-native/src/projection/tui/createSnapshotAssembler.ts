import { createSnapshotBundle } from "../../core/snapshot/createSnapshotBundle";
import type {
  SnapshotAssemblerInput,
  SnapshotBundle,
} from "../../core/types";
import { renderSnapshotDocument } from "./renderSnapshotDocument";

export function createSnapshotAssembler<State>(
  input: SnapshotAssemblerInput<State>,
): SnapshotBundle {
  const views = [input.rootView, ...input.mountedViews];
  const markup = renderSnapshotDocument(views);
  const bundleInput = {
    markup,
    views,
    refIndex: input.refIndex,
    visibleTools: input.visibleTools,
    ...(input.tui === undefined ? {} : { tui: input.tui }),
  };

  return createSnapshotBundle(bundleInput);
}
