/**
 * pi-single-step — Pi 单步执行模式扩展
 *
 * 开启后，每完成一轮工具调用（一个 turn）会暂停并询问是否继续下一步。
 * 用户在确认后才进入下一轮 LLM 调用，实现逐步执行。
 *
 * 命令：
 *   /single-step on      开启单步模式
 *   /single-step off     关闭单步模式
 *   /single-step         查看当前状态
 *
 * 在单步模式下：
 *   1. 每完成一轮工具调用 (turn_end) → 弹出选择对话框
 *   2. "Continue" → 进入下一轮 LLM 调用
 *   3. "Stop (no reason)" → 中止，不告知 LLM 原因
 *   4. "Stop (with reason)" → 中止，输入原因并告知 LLM
 *   5. 60 秒无操作 → 自动继续
 *
 * 扩展会在系统提示中注入说明，让 LLM 知道当前处于单步模式。
 * 同时会在 footer 状态栏显示当前模式状态（🟢 STEP / 🟡 STEP / ⏸️ STEP），
 * 仅在等待确认时在编辑器下方临时显示提示。
 */

import type { AutocompleteItem, ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

// ── 状态 ──

let stepModeEnabled = false;

/** 去抖窗口（毫秒） */
const DEBOUNCE_MS = 500;

/** 去抖时间戳 */
let lastPauseTimestamp = 0;

/** 当前 agent 是否正在运行（用于 widget 显示） */
let agentRunning = false;

// ── 插件入口 ──

export default function (pi: ExtensionAPI) {
  // ── 注册 /single-step 命令 ──

  pi.registerCommand("single-step", {
    description:
      "单步执行模式 — 每步执行后询问是否继续。用法: /single-step on | off",
    argumentHint: "on | off",
    getArgumentCompletions: async (prefix: string): Promise<AutocompleteItem[] | null> => {
      const candidates = [
        { value: "on", label: "on", description: "Enable single-step mode" },
        { value: "off", label: "off", description: "Disable single-step mode" },
      ];
      const filtered = candidates.filter((c) => c.value.startsWith(prefix));
      return filtered.length > 0 ? filtered : null;
    },
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const trimmed = args.trim().toLowerCase();

      if (trimmed === "on") {
        stepModeEnabled = true;
        updateStatus(ctx);
        ctx.ui.notify("🔬 Single-step mode ON — will pause after each step", "info");
      } else if (trimmed === "off") {
        stepModeEnabled = false;
        clearStatus(ctx);
        ctx.ui.notify("Single-step mode OFF", "info");
      } else {
        const status = stepModeEnabled
          ? "Single-step mode: ON"
          : "Single-step mode: OFF";
        ctx.ui.notify(status, "info");
      }
    },
  });

  // ── 会话生命周期：重置去抖状态 ──

  pi.on("session_start", async (_event, _ctx) => {
    lastPauseTimestamp = 0;
    agentRunning = false;
  });

  // ── Footer 状态标签（常态指示器）──
  // 使用 setStatus 在 footer 右侧显示，不占用主内容区空间。
  // 仅在 turn_end 等待确认时额外临时用 setWidget。

  function fmtStatus(theme: { fg: (c: string, t: string) => string }): string {
    if (agentRunning) return theme.fg("warning", "🟡 STEP");
    return theme.fg("success", "🟢 STEP");
  }

  function updateStatus(ctx: { ui: { setStatus: (id: string, text: string | undefined) => void; theme: { fg: (c: string, t: string) => string } }; hasUI: boolean }) {
    if (!stepModeEnabled) return;
    if (!ctx.hasUI) return;
    ctx.ui.setStatus("pi-single-step", fmtStatus(ctx.ui.theme));
  }

  function clearStatus(ctx: { ui: { setStatus: (id: string, text: string | undefined) => void }; hasUI: boolean }) {
    if (!ctx.hasUI) return;
    ctx.ui.setStatus("pi-single-step", undefined);
  }

  // ── 监听 agent 生命周期 ──

  pi.on("agent_start", async (_event, ctx) => {
    if (!stepModeEnabled) return;
    agentRunning = true;
    updateStatus(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    agentRunning = false;
    if (!stepModeEnabled) return;
    updateStatus(ctx);
  });

  // ── 监听 turn_end：拦截点 ──
  //
  // 每次 LLM 回复 + 该回复引发的所有工具调用执行完毕后触发。
  // 如果 LLM 还要继续调用更多工具，会在下一个 turn 继续。
  // 我们在 turn_end 暂停并询问用户是否要继续。

  pi.on("turn_end", async (_event, ctx) => {
    if (!stepModeEnabled) return;

    // 去抖：避免短时间内重复弹出
    const now = Date.now();
    if (now - lastPauseTimestamp < DEBOUNCE_MS) return;
    lastPauseTimestamp = now;

    if (!ctx.hasUI) return;

    // 等待确认：临时在编辑器下方显示提示
    const theme = ctx.ui.theme;
    ctx.ui.setWidget("pi-single-step", [theme.fg("accent", "▶  Step completed. What next?")], { placement: "belowEditor" });
    ctx.ui.setStatus("pi-single-step", theme.fg("accent", "⏸️ STEP"));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);
    let choice: string | undefined;
    try {
      choice = await ctx.ui.select(
        "🔬 Single-step — Step completed. What next?",
        [
          "Continue — proceed to next step",
          "Stop (no reason)",
          "Stop (with reason)",
        ],
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timeoutId);
      // 清除等待确认时的临时 widget
      ctx.ui.setWidget("pi-single-step", undefined);
    }

    if (controller.signal.aborted) {
      // 超时 → 自动继续：不做任何操作，让 agent 自然运行
      updateStatus(ctx);
      ctx.ui.notify("⏩ Timeout — auto-continuing", "info");
      return;
    }

    if (choice === "Continue — proceed to next step") {
      updateStatus(ctx);
      return;
    }

    ctx.ui.notify("⏸️ Paused — enter a new command to continue", "info");
    agentRunning = false;
    updateStatus(ctx);

    if (choice === "Stop (with reason)") {
      const reason = await ctx.ui.input("Reason for stopping (sent to LLM):");
      if (reason) {
        pi.sendMessage({
          customType: "step-reason",
          content: `The user paused execution for the following reason: ${reason}`,
          display: true,
          details: { reason },
        });
      }
    }
    // "Stop (no reason)" 不发送任何消息给 LLM

    ctx.abort();
  });

  // ── 在系统提示中注入单步模式说明 ──

  pi.on("before_agent_start", async (event, ctx) => {
    if (!stepModeEnabled) return;

    return {
      systemPrompt:
        event.systemPrompt +
        `\n\n## ⚠️ 单步执行模式已开启\n` +
        `当前处于单步执行模式。每完成一轮工具调用后，系统会暂停并询问是否继续。\n` +
        `你只需按正常流程执行即可，无需做任何特殊处理。\n` +
        `如果需要查看中间结果后再做下一步决定，可以放心地逐步执行。`,
    };
  });
}
