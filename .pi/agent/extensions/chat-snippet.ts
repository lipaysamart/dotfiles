/**
 * chat-snippet — Pi 聊天片段快速插入扩展
 *
 * 片段以 .md 文件存储在 ~/.pi/chat-snippet/ 目录。
 * 创建/编辑/删除片段直接操作文件系统即可。
 *
 * 命令：
 *   /chat-snippet               弹出 TUI 选择框挑选片段
 *   /chat-snippet list          列出所有片段
 *   /chat-snippet add <name>    创建或编辑片段
 *   /chat-snippet insert <name> 插入指定片段到输入框（带补全）
 *   /chat-snippet <name>        直接插入（快捷方式）
 *
 * setEditorText 是运行时 API（类型声明中未暴露），pi-powerline-footer 同样使用此 API。
 */

import type { AutocompleteItem, ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import path from "node:path";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const SNIPPET_DIR = path.join(homedir(), ".pi", "chat-snippet");

// ── 纯函数：文件系统操作 ──

function snippetPath(name: string): string {
  // 防止双后缀：如果用户输入了 .md，先 strip 再加
  const base = name.endsWith(".md") ? name.slice(0, -3) : name;
  return path.join(SNIPPET_DIR, `${base}.md`);
}

function validateName(name: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error(`Invalid name "${name}", only letters, digits, hyphens and underscores allowed`);
  }
}

async function ensureDir(): Promise<void> {
  await mkdir(SNIPPET_DIR, { recursive: true });
}

async function listNames(): Promise<string[]> {
  await ensureDir();
  const entries = await readdir(SNIPPET_DIR);
  return entries
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3))
    .sort();
}

async function readSnippet(name: string): Promise<string> {
  const filePath = snippetPath(name);
  try {
    return await readFile(filePath, "utf-8");
  } catch (e: unknown) {
    if (isNotFound(e)) throw new Error(`Snippet "${name}" not found`);
    throw e;
  }
}

async function writeSnippet(name: string, content: string): Promise<void> {
  await ensureDir();
  await writeFile(snippetPath(name), content, "utf-8");
}

function isNotFound(e: unknown): boolean {
  return e instanceof Error && (e as NodeJS.ErrnoException).code === "ENOENT";
}

// ── 子命令处理 ──

async function handleInsert(name: string, ctx: ExtensionCommandContext): Promise<void> {
  validateName(name);
  const content = await readSnippet(name);
  if (content.trim() === "") {
    ctx.ui.notify(`Snippet "${name}" is empty`, "warning");
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctx.ui as any).setEditorText(content);
  ctx.ui.notify(`Inserted snippet "${name}"`, "info");
}

async function handleSelect(ctx: ExtensionCommandContext): Promise<void> {
  const names = await listNames();
  const hasSnippets = names.length > 0;

  const menuItems = hasSnippets
    ? [`📋 Insert snippet (${names.length})`, "✏️ Create / edit snippet", "📄 List all snippets"]
    : ["✏️ Create / edit snippet", "📄 List all snippets"];

  const action = await ctx.ui.select("chat-snippet", menuItems);
  if (action === undefined) return; // cancelled

  const idx = menuItems.indexOf(action);

  // "📄 List all snippets" — last item
  if (idx === menuItems.length - 1) {
    await handleList(ctx);
    return;
  }

  // "✏️ Create / edit snippet" — second item (or first when no snippets)
  if (action.startsWith("✏️")) {
    const name = await ctx.ui.input("Snippet name (letters, digits, hyphens, underscores)");
    if (name === undefined) return;
    await handleAdd(name, ctx);
    return;
  }

  // "📋 Insert snippet" — first item (only present when hasSnippets)
  const choice = await ctx.ui.select("Pick a snippet", names);
  if (choice === undefined) return;
  await handleInsert(choice, ctx);
}

async function handleList(ctx: ExtensionCommandContext): Promise<void> {
  const names = await listNames();
  if (names.length === 0) {
    ctx.ui.notify("No snippets\nCreate .md files in ~/.pi/chat-snippet/", "info");
    return;
  }
  ctx.ui.notify(names.join("\n"), "info");
}

async function handleAdd(name: string, ctx: ExtensionCommandContext): Promise<void> {
  validateName(name);
  let prefill = "";
  try {
    prefill = await readSnippet(name);
  } catch {
    // snippet doesn't exist → create mode
  }
  const content = await ctx.ui.editor(`Edit snippet: ${name}`, prefill);
  if (content === undefined) return; // cancelled
  await writeSnippet(name, content);
  ctx.ui.notify(`Saved snippet "${name}"`, "info");
}

// ── 参数解析 ──

type Action = "select" | "list" | "add" | "insert";

function parseArgs(args: string): { action: Action; name?: string } {
  const trimmed = args.trim();
  if (trimmed === "") return { action: "select" };
  if (trimmed === "list") return { action: "list" };
  // /chat-snippet add <name>
  if (trimmed.startsWith("add ")) {
    const name = trimmed.slice(4).trim();
    return name ? { action: "add", name } : { action: "select" };
  }
  // /chat-snippet insert <name>
  if (trimmed.startsWith("insert ")) {
    const name = trimmed.slice(7).trim();
    return name ? { action: "insert", name } : { action: "select" };
  }
  // /chat-snippet <name> 快捷方式
  return { action: "insert", name: trimmed };
}

// ── 入口 ──

export default function (pi: ExtensionAPI) {
  pi.registerCommand("chat-snippet", {
    description: "Chat snippets — press Enter after /chat-snippet to open menu, or type subcommands: add/insert/list/name",
    argumentHint: "[Enter for menu] | add <name> | insert <name> | list | <name>",
    getArgumentCompletions: async (prefix: string): Promise<AutocompleteItem[] | null> => {
      const trimmed = prefix.trimStart();
      // /chat-snippet insert <partial-name>
      if (trimmed.startsWith("insert ")) {
        const partial = trimmed.slice(7);
        if (partial.includes(" ")) return null;
        const names = await listNames().catch(() => [] as string[]);
        const matches = names.filter((n) => n.startsWith(partial));
        return matches.length > 0 ? matches.map((n) => ({ value: `insert ${n}`, label: n })) : null;
      }
      // /chat-snippet <partial> — subcommand or snippet name
      if (trimmed === "") {
        return [
          { value: "add ", label: "add", description: "Create or edit a snippet" },
          { value: "insert ", label: "insert", description: "Insert a snippet" },
          { value: "list", label: "list", description: "List all snippets" },
        ];
      }
      // subcommand completion
      const subs = ["add", "insert", "list"].filter((s) => s.startsWith(trimmed));
      if (subs.length > 0) {
        return subs.map((s) => ({ value: s === "add" || s === "insert" ? `${s} ` : s, label: s }));
      }
      // shortcut: complete snippet names directly
      const names = await listNames().catch(() => [] as string[]);
      const matches = names.filter((n) => n.startsWith(trimmed));
      return matches.length > 0 ? matches.map((n) => ({ value: n, label: n })) : null;
    },
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/chat-snippet requires interactive TUI mode", "error");
        return;
      }

      // Handle bare subcommands with no name: prompt interactively
      const trimmed = args.trim();
      if (trimmed === "add") {
        const name = await ctx.ui.input("Snippet name (letters, digits, hyphens, underscores)");
        if (name === undefined) return;
        return await handleAdd(name, ctx);
      }
      if (trimmed === "insert") {
        const names = await listNames();
        if (names.length === 0) {
          ctx.ui.notify("No snippets\nCreate .md files in ~/.pi/chat-snippet/", "info");
          return;
        }
        const choice = await ctx.ui.select("Pick a snippet", names);
        if (choice === undefined) return;
        return await handleInsert(choice, ctx);
      }

      const { action, name } = parseArgs(args);
      try {
        if (action === "select") return await handleSelect(ctx);
        if (action === "list") return await handleList(ctx);
        if (action === "add") return await handleAdd(name!, ctx);
        return await handleInsert(name!, ctx);
      } catch (e: unknown) {
        ctx.ui.notify(e instanceof Error ? e.message : String(e), "error");
      }
    },
  });
}
