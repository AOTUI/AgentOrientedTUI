# Edit Tool Fallback Matching Strategies (WHAT / WHY / HOW)

This document explains how `edit` matches `oldString` against file content when exact matching is fragile.

## Scope

- File: `src/tool/edit.ts`
- Entry function: `replace(content, oldString, newString, replaceAll)`
- Goal: convert model-generated `oldString` into a **single safe match** whenever possible, while failing loudly on ambiguity.

---

## WHAT: What the matching pipeline does

`replace()` runs a chain of replacers in fixed order. Each replacer yields one or more candidate search strings. For each candidate:

1. Check whether candidate exists in full file (`indexOf`).
2. If `replaceAll === true`, replace every occurrence of that candidate.
3. Else require candidate to be unique (`indexOf === lastIndexOf`).
4. Return immediately on first valid candidate.

If no replacer yields a match, throw **not found**.
If matches exist but all are ambiguous (multi-occurrence and non-`replaceAll`), throw **multiple matches**.

### Replacer order

The order is important (strict to loose):

1. `SimpleReplacer` (exact text)
2. `LineTrimmedReplacer` (line-level trim)
3. `BlockAnchorReplacer` (first/last line anchors + similarity)
4. `WhitespaceNormalizedReplacer` (collapse whitespace)
5. `IndentationFlexibleReplacer` (remove common indent)
6. `EscapeNormalizedReplacer` (unescape sequences)
7. `TrimmedBoundaryReplacer` (trim block boundaries)
8. `ContextAwareReplacer` (anchor + 50% middle-line heuristic)
9. `MultiOccurrenceReplacer` (enumerate exact repeated matches)

---

## WHY: Why this exists

Model-generated edits fail for predictable reasons:

- Tabs/spaces or indentation drift
- CRLF/LF and escape-sequence mismatches
- Extra leading/trailing blank lines
- Slight context drift in multi-line snippets
- Repeated code blocks causing ambiguous target selection

Pure exact match would be brittle and increase retry loops. Pure fuzzy match would be unsafe and risk editing wrong regions.

This pipeline balances both:

- **Robustness** via progressively tolerant matching
- **Safety** via uniqueness gate (unless explicit `replaceAll`)
- **Determinism** via fixed strategy order and first-success return

---

## HOW: Strategy-by-strategy behavior

### 1) `SimpleReplacer`

- Yields original `oldString` directly.
- Fast path for correct exact matches.

### 2) `LineTrimmedReplacer`

- Compares each line after `.trim()`.
- Preserves original file substring boundaries when yielding.
- Useful when indentation or trailing spaces differ per line.

### 3) `BlockAnchorReplacer`

- Requires at least 3 lines.
- Uses first and last lines (trimmed) as anchors.
- Computes middle-line similarity (Levenshtein-based):
  - Single candidate threshold: `0.0` (anchors effectively enough)
  - Multi-candidate threshold: `0.3`
- Picks best candidate when several anchor blocks exist.

Notes:

- This is a controlled fuzzy step for long blocks.
- It tries to avoid random block selection in duplicated structures.

### 4) `WhitespaceNormalizedReplacer`

- Normalizes any run of whitespace (`\s+`) to single spaces.
- Supports line and block-level comparisons.
- Can recover from formatting-only differences.

### 5) `IndentationFlexibleReplacer`

- Removes minimum common indentation from each non-empty line.
- Compares de-indented blocks.
- Good for nested code moved one level in/out.

### 6) `EscapeNormalizedReplacer`

- Unescapes common sequences (`\n`, `\t`, `\r`, quotes, backticks, `\\`, `$`).
- Tries both direct unescaped match and block-level unescaped equality.
- Useful when model emits escaped string literals instead of raw text.

### 7) `TrimmedBoundaryReplacer`

- Trims only outer boundaries of `oldString`.
- Finds exact trimmed variant or block with matching trimmed boundaries.
- Handles accidental leading/trailing empty lines.

### 8) `ContextAwareReplacer`

- Requires at least 3 lines.
- Uses first/last trimmed lines as anchors.
- For same-length candidate blocks, requires middle-line trimmed equality ratio >= 50%.
- Yields first acceptable context block.

### 9) `MultiOccurrenceReplacer`

- Enumerates all exact occurrences of `oldString`.
- Mainly helps `replaceAll=true` mode apply all occurrences.
- In non-`replaceAll` mode, uniqueness gate still protects from ambiguous edits.

---

## Safety model and failure semantics

The matching pipeline is intentionally fail-fast when confidence is low:

- `oldString === newString` -> reject as no-op.
- No candidate matched -> throw not-found error.
- Candidate matched but not unique in non-`replaceAll` mode -> throw multiple-matches error.

This behavior is preferable to silent partial edits in production coding workflows.

---

## Practical guidance for prompt/tool callers

To maximize first-pass success and reduce retries:

- Include stable anchors: put 2-5 lines of unique context around the target region.
- Avoid tiny `oldString` fragments (high ambiguity risk).
- For global renames in one file, set `replaceAll=true` explicitly.
- For multiple disjoint edits, prefer `apply_patch` (or multiple `edit` calls) over one huge ambiguous block.
- Preserve indentation and avoid line number prefixes from `read` output.

---

## Known tradeoffs

- More tolerant matching improves success rate but can increase false-positive candidates in repetitive files.
- Uniqueness gate mitigates this, but some valid changes still require user/model retry with more context.
- Thresholds (`0.0`, `0.3`, and 50% heuristic) are pragmatic defaults, not mathematically optimal for all languages.

---

## Future improvements (optional)

- Add confidence scoring to replacer outputs and pick globally best, not first-success.
- Add AST-aware matching for structured languages.
- Add explainability metadata (which replacer matched) in tool output.
- Tune thresholds per language family and block length.
