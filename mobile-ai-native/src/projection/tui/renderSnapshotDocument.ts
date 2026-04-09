import type { ViewFragment } from "../../core/types";

export function renderSnapshotDocument(views: readonly ViewFragment[]) {
  return views.map((view) => view.markup).join("");
}
