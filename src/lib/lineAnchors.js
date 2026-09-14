// Compare stored text, never the user's simplified/traditional display choice.
// ponytail: identical repeated lines remain ambiguous; preserved line UUIDs are
// needed before automatic remapping or wiki-style restoration.
export function matchesLine(row, lines) {
  return typeof row?.original_line === 'string' && Number.isInteger(row.line_index)
    && row.line_index >= 0 && row.original_line === lines[row.line_index];
}

export function selectedLineTranslation(selection, originalLine) {
  return typeof selection?.original_line === 'string' && selection.original_line === originalLine
    && typeof selection.content === 'string' ? selection.content : null;
}
