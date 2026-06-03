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
    throw new Error(`非法名称 "${name}"，仅允许英文字母、数字、下划线和连字符`);
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
    if (isNotFound(e)) throw new Error(`片段 "${name}" 不存在`);
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
    ctx.ui.notify(`片段 "${name}" 为空`, "warning");
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctx.ui as any).setEditorText(content);
  ctx.ui.notify(`已插入片段 "${name}"`, "info");
}

async function handleSelect(ctx: ExtensionCommandContext): Promise<void> {
  const names = await listNames();
  if (names.length === 0) {
    ctx.ui.notify("没有片段\n请在 ~/.pi/chat-snippet/ 创建 .md 文件", "info");
    return;
  }
  const choice = await ctx.ui.select("选择片段", names);
  if (choice === undefined) return; // 用户取消
  await handleInsert(choice, ctx);
}

async function handleList(ctx: ExtensionCommandContext): Promise<void> {
  const names = await listNames();
  if (names.length === 0) {
    ctx.ui.notify("没有片段\n请在 ~/.pi/chat-snippet/ 创建 .md 文件", "info");
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
    // 片段不存在 → 新建模式
  }
  const content = await ctx.ui.editor(`编辑片段 ${name}`, prefill);
  if (content === undefined) return; // 用户取消
  await writeSnippet(name, content);
  ctx.ui.notify(`已保存片段 "${name}"`, "info");
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
    description: "聊天片段 — /chat-snippet 选择，/chat-snippet add <name> 创建，/chat-snippet insert <name> 插入，/chat-snippet list 列出",
    argumentHint: "[name] | add <name> | insert <name> | list",
    getArgumentCompletions: async (prefix: string): Promise<AutocompleteItem[] | null> => {
      const trimmed = prefix.trimStart();
      // /chat-snippet insert <partial-name> — 补全片段名
      if (trimmed.startsWith("insert ")) {
        const partial = trimmed.slice(7);
        if (partial.includes(" ")) return null;
        const names = await listNames().catch(() => [] as string[]);
        const matches = names.filter((n) => n.startsWith(partial));
        return matches.length > 0 ? matches.map((n) => ({ value: `insert ${n}`, label: n })) : null;
      }
      // /chat-snippet <partial> — 补全子命令或片段名
      if (trimmed === "") {
        return [
          { value: "add ", label: "add", description: "创建或编辑片段" },
          { value: "insert ", label: "insert", description: "插入指定片段" },
          { value: "list", label: "list", description: "列出所有片段" },
        ];
      }
      // 子命令补全
      const subs = ["add", "insert", "list"].filter((s) => s.startsWith(trimmed));
      if (subs.length > 0) {
        return subs.map((s) => ({ value: s === "add" || s === "insert" ? `${s} ` : s, label: s }));
      }
      // 快捷方式：直接补全片段名
      const names = await listNames().catch(() => [] as string[]);
      const matches = names.filter((n) => n.startsWith(trimmed));
      return matches.length > 0 ? matches.map((n) => ({ value: n, label: n })) : null;
    },
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/chat-snippet 需要交互式 TUI 模式", "error");
        return;
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
