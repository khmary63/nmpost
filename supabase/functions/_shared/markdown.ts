// Shared markdown converters for publish-* edge functions.
// Input: lightweight markdown produced by AI (** bold **, * italic *, `code`, [text](url), # headings, lists).

function escapeHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Convert markdown to Telegram HTML (parse_mode: HTML).
 * Supported: **bold**, *italic* / _italic_, `code`, ```code```, [text](url),
 * # headings (rendered as <b>), - / * / 1. lists (kept as plain bullets).
 */
export function markdownToTelegramHtml(src: string): string {
  if (!src) return "";

  // 1. Extract code blocks first to protect them from other replacements.
  const codeBlocks: string[] = [];
  let text = src.replace(/```([\s\S]*?)```/g, (_m, code) => {
    codeBlocks.push(code);
    return `\u0000CODEBLOCK${codeBlocks.length - 1}\u0000`;
  });

  const inlineCodes: string[] = [];
  text = text.replace(/`([^`\n]+)`/g, (_m, code) => {
    inlineCodes.push(code);
    return `\u0000INLINECODE${inlineCodes.length - 1}\u0000`;
  });

  // 2. Escape HTML in the remaining text.
  text = escapeHtml(text);

  // 3. Headings → bold lines (Telegram has no native heading).
  text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+(.+)$/gm, "<b>$1</b>");

  // 4. Bold: **text** or __text__
  text = text.replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>");
  text = text.replace(/__([^_\n]+?)__/g, "<b>$1</b>");

  // 5. Italic: *text* or _text_ (single, non-greedy, must not be part of ** already replaced)
  text = text.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<i>$2</i>");
  text = text.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1<i>$2</i>");

  // 5b. Strikethrough: ~~text~~
  text = text.replace(/~~([^~\n]+?)~~/g, "<s>$1</s>");

  // 5c. Spoiler: ||text||
  text = text.replace(/\|\|([^|\n]+?)\|\|/g, "<tg-spoiler>$1</tg-spoiler>");

  // 6. Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    return `<a href="${escapeAttr(url)}">${label}</a>`;
  });

  // 7. List markers: lines starting with "- ", "* ", "+ " → "• "
  text = text.replace(/^[ \t]*[-*+][ \t]+/gm, "• ");

  // 8. Restore code blocks/inline (escape inside).
  text = text.replace(/\u0000INLINECODE(\d+)\u0000/g, (_m, i) => {
    return `<code>${escapeHtml(inlineCodes[Number(i)])}</code>`;
  });
  text = text.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_m, i) => {
    return `<pre>${escapeHtml(codeBlocks[Number(i)])}</pre>`;
  });

  // 9. Collapse 3+ newlines.
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}

/**
 * Strip markdown formatting for VK (which has no rich formatting in wall.post).
 * Keeps URLs as plain text (VK auto-linkifies them).
 */
export function stripMarkdown(src: string): string {
  if (!src) return "";
  let text = src;

  // Code blocks → keep content
  text = text.replace(/```([\s\S]*?)```/g, "$1");
  // Inline code
  text = text.replace(/`([^`\n]+)`/g, "$1");
  // Headings: drop leading #'s
  text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "");
  // Bold/italic markers (order matters: ** before *)
  text = text.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
  text = text.replace(/__([^_\n]+?)__/g, "$1");
  text = text.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1$2");
  text = text.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1$2");
  // Links: [text](url) → "text (url)" if different, else url
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    return label.trim() === url.trim() ? url : `${label} (${url})`;
  });
  // Bullet markers
  text = text.replace(/^[ \t]*[-*+][ \t]+/gm, "• ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}
