import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  isBashToolResult,
  isEditToolResult,
  isFindToolResult,
  isGrepToolResult,
  isReadToolResult,
  isWriteToolResult,
} from "@earendil-works/pi-coding-agent";
import { basename } from "node:path";

// ── Constants ──
const CMUX_TIMEOUT_MS = 3000;
const DEFAULT_THRESHOLD_MS = 15000;
const DEFAULT_DEBOUNCE_MS = 3000;
const FINAL_CLEAR_DELAY_MS = 2500;
const MAX_LOG_LENGTH = 240;

type StatusKind = "running" | "tool" | "waiting" | "complete" | "cancelled" | "error";
type LogLevel = "info" | "progress" | "success" | "warning" | "error";
type NotifyLevel = "all" | "medium" | "low" | "disabled";
type FlashLevel = "all" | "error" | "disabled";

const STATUS_STYLE: Record<StatusKind, { icon: string; color: string }> = {
  running: { icon: "sparkle", color: "#0A84FF" },
  tool: { icon: "hammer", color: "#FF9F0A" },
  waiting: { icon: "clock", color: "#8E8E93" },
  complete: { icon: "check", color: "#30D158" },
  cancelled: { icon: "xmark", color: "#8E8E93" },
  error: { icon: "xmark", color: "#FF453A" },
};

interface RunState {
  startedAt: number;
  readFiles: Set<string>;
  changedFiles: Set<string>;
  searchCount: number;
  bashCount: number;
  toolCount: number;
  turnCount: number;
  firstToolError: string | undefined;
}

interface AssistantMessageLike {
  role: "assistant";
  stopReason?: string;
  errorMessage?: string;
  content?: Array<{ type?: string; text?: string }>;
}

// ── Helpers ──

function getNumberFromEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function getBooleanFromEnv(name: string, fallback: boolean): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (!v) return fallback;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off" || v === "disabled") return false;
  return fallback;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  if (min === 0) return `${sec}s`;
  if (sec === 0) return `${min}m`;
  return `${min}m ${sec}s`;
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
}

function plural(count: number, single: string, multi = `${single}s`): string {
  return count === 1 ? single : multi;
}

function estimateProgress(state: RunState): number {
  return Math.min(0.9, Math.max(0.08, 0.08 + state.turnCount * 0.14 + state.toolCount * 0.04));
}

function createEmptyRunState(): RunState {
  return {
    startedAt: Date.now(),
    readFiles: new Set(),
    changedFiles: new Set(),
    searchCount: 0,
    bashCount: 0,
    toolCount: 0,
    turnCount: 0,
    firstToolError: undefined,
  };
}

function getPathFromInput(input: { path?: unknown }): string | undefined {
  const p = input.path;
  return typeof p === "string" && p.length > 0 ? p : undefined;
}

function isAssistantMessage(m: unknown): m is AssistantMessageLike {
  return (
    typeof m === "object" && m !== null && (m as { role?: unknown }).role === "assistant"
  );
}

function getLastAssistantMessage(messages: readonly unknown[]): AssistantMessageLike | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isAssistantMessage(messages[i])) return messages[i];
  }
}

function extractAssistantText(msg: AssistantMessageLike): string | undefined {
  if (!Array.isArray(msg.content)) return;
  const text = msg.content
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string" && p.text.trim().length > 0)
    .map((p) => p.text.trim())
    .join("\n")
    .trim();
  return text || undefined;
}

function summarizeRunFailure(
  messages: readonly unknown[],
  fallback?: string,
): { kind: "error" | "cancelled"; summary: string } | undefined {
  const last = getLastAssistantMessage(messages);
  if (!last) return fallback ? { kind: "error", summary: fallback } : undefined;
  if (last.stopReason !== "error" && last.stopReason !== "aborted") return;

  const summary =
    last.errorMessage?.trim() ||
    truncate(extractAssistantText(last) ?? fallback ?? "Agent run failed", 120);
  return last.stopReason === "aborted"
    ? { kind: "cancelled", summary: summary || "Operation aborted" }
    : { kind: "error", summary };
}

function summarizeSuccess(state: RunState, durationMs: number, thresholdMs: number): string {
  const changed = state.changedFiles.size;
  if (changed === 1) {
    const [file] = [...state.changedFiles];
    const s = `Updated ${basename(file)}`;
    return durationMs >= thresholdMs ? `${s} in ${formatDuration(durationMs)}` : s;
  }
  if (changed > 1) {
    const s = `Updated ${changed} ${plural(changed, "file")}`;
    return durationMs >= thresholdMs ? `${s} in ${formatDuration(durationMs)}` : s;
  }

  const read = state.readFiles.size;
  if (read === 1) {
    const [file] = [...state.readFiles];
    const s = `Reviewed ${basename(file)}`;
    return durationMs >= thresholdMs ? `${s} in ${formatDuration(durationMs)}` : s;
  }
  if (read > 1) {
    const s = `Reviewed ${read} ${plural(read, "file")}`;
    return durationMs >= thresholdMs ? `${s} in ${formatDuration(durationMs)}` : s;
  }

  if (state.searchCount > 0 && state.bashCount > 0) {
    const s = `Ran ${state.searchCount} ${plural(state.searchCount, "search")} and ${state.bashCount} ${plural(state.bashCount, "shell command")}`;
    return durationMs >= thresholdMs ? `${s} in ${formatDuration(durationMs)}` : s;
  }
  if (state.searchCount > 0) {
    const s = state.searchCount === 1 ? "Searched the codebase" : `Ran ${state.searchCount} searches`;
    return durationMs >= thresholdMs ? `${s} in ${formatDuration(durationMs)}` : s;
  }
  if (state.bashCount > 0) {
    const s = `Ran ${state.bashCount} ${plural(state.bashCount, "shell command")}`;
    return durationMs >= thresholdMs ? `${s} in ${formatDuration(durationMs)}` : s;
  }
  return durationMs >= thresholdMs ? `Finished in ${formatDuration(durationMs)}` : "Finished and waiting for input";
}

function summarizeToolError(event: { toolName: string; content?: Array<{ type: string; text?: string }>; input?: { path?: unknown } }): string {
  const path = getPathFromInput(event.input ?? {});
  if (path) return `${event.toolName} failed for ${basename(path)}`;
  const textPart = (event.content ?? []).find((p) => p.type === "text");
  const text = textPart?.text?.trim();
  return text && text.length <= 120 ? text : `${event.toolName} failed`;
}

function hasCmuxWorkspaceContext(): boolean {
  return Boolean(process.env.CMUX_WORKSPACE_ID?.trim());
}

function sanitizeKey(v: string): string {
  return v.replace(/[^A-Za-z0-9_.:-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function getStatusKey(): string {
  const configured = process.env.PI_CMUX_SIDEBAR_STATUS_KEY?.trim();
  if (configured) return configured;
  const surface = process.env.CMUX_SURFACE_ID || process.env.CMUX_TAB_ID || String(process.pid);
  return `pi-${sanitizeKey(surface).slice(0, 64) || String(process.pid)}`;
}

function isCmuxUnavailableError(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("enoent") ||
    t.includes("command not found") ||
    t.includes("no such file") ||
    t.includes("connection refused") ||
    t.includes("econnrefused") ||
    t.includes("econnreset") ||
    t.includes("socket")
  );
}

// ── Notify level helpers ──

type FinalState = "waiting" | "complete" | "cancelled" | "error";

function buildFinalState(
  failure: { kind: "error" | "cancelled"; summary: string } | undefined,
  state: RunState,
  durationMs: number,
  thresholdMs: number,
): FinalState {
  if (failure) return failure.kind;
  if (state.changedFiles.size > 0 || durationMs >= thresholdMs) return "complete";
  return "waiting";
}

function shouldNotify(level: NotifyLevel, finalState: FinalState): boolean {
  if (level === "disabled") return false;
  if (level === "all") return true;
  if (level === "medium") return finalState === "complete" || finalState === "error";
  if (level === "low") return finalState === "error";
  return true;
}

// ── Extension ──

export default function (pi: ExtensionAPI) {
  if (!hasCmuxWorkspaceContext()) return;

  // ── Config ──
  const thresholdMs = getNumberFromEnv("PI_CMUX_NOTIFY_THRESHOLD_MS", DEFAULT_THRESHOLD_MS);
  const notifyLevel: NotifyLevel =
    (process.env.PI_CMUX_NOTIFY_LEVEL?.trim().toLowerCase() || "all") as NotifyLevel;
  const flashLevel: FlashLevel =
    (process.env.PI_CMUX_SIDEBAR_FLASH?.trim().toLowerCase() || "all") as FlashLevel;
  const progressEnabled = getBooleanFromEnv("PI_CMUX_SIDEBAR_PROGRESS", true);
  const statusKey = getStatusKey();

  // ── Mutable state ──
  let runState = createEmptyRunState();
  let runSeq = 0;
  let agentActive = false;
  let activeToolCount = 0;
  let cmuxUnavailable = false;
  let flashUnavailable = false;
  let cmdQueue = Promise.resolve();
  let finalClearTimer: ReturnType<typeof setTimeout> | undefined;
  let lastNotifyAt = 0;
  let lastNotifyKey = "";
  let currentProgressValue: number | undefined;
  let currentProgressLabel: string | undefined;

  // ── Helpers ──

  const markUnavailable = (text: string) => {
    if (isCmuxUnavailableError(text)) cmuxUnavailable = true;
  };

  const enqueue = (args: string[], onFailure?: () => void) => {
    if (cmuxUnavailable) return;
    cmdQueue = cmdQueue.then(
      () =>
        pi.exec("cmux", args, { timeout: CMUX_TIMEOUT_MS }).then((r) => {
          if (r.killed) { onFailure?.(); return; }
          if (r.code !== 0) {
            const err = r.stderr.trim() || r.stdout.trim() || `cmux exit ${r.code}`;
            markUnavailable(err);
            onFailure?.();
          }
        }),
      () => undefined,
    ).catch((err) => {
      markUnavailable(err instanceof Error ? err.message : String(err));
      onFailure?.();
    });
  };

  const flushCmds = () => cmdQueue.catch(() => undefined);

  const setStatus = (kind: StatusKind, text: string) => {
    const s = STATUS_STYLE[kind];
    enqueue(["set-status", statusKey, text, "--icon", s.icon, "--color", s.color]);
  };

  const clearStatus = () => enqueue(["clear-status", statusKey]);

  const setProgress = (ratio: number, label?: string) => {
    currentProgressValue = ratio;
    currentProgressLabel = label;
    if (!progressEnabled) return;
    const a = ["set-progress", ratio.toFixed(2)];
    if (label) a.push("--label", label);
    enqueue(a);
  };

  const clearProgress = () => {
    currentProgressValue = undefined;
    currentProgressLabel = undefined;
    if (!progressEnabled) return;
    enqueue(["clear-progress"]);
  };

  const appendLog = (level: LogLevel, msg: string) => {
    enqueue(["log", "--level", level, "--source", "pi", truncate(msg, MAX_LOG_LENGTH)]);
  };

  const triggerFlash = (isError: boolean) => {
    if (flashUnavailable) return;
    if (flashLevel === "disabled") return;
    if (flashLevel === "error" && !isError) return;
    enqueue(["trigger-flash"], () => { flashUnavailable = true; });
  };

  const notify = (subtitle: string, body: string) => {
    const key = `${subtitle}\n${body}`;
    const now = Date.now();
    if (key === lastNotifyKey && now - lastNotifyAt < DEFAULT_DEBOUNCE_MS) return;
    enqueue(["notify", "--title", "Pi", "--subtitle", subtitle, "--body", body]);
    lastNotifyAt = now;
    lastNotifyKey = key;
  };

  const cancelFinalClear = () => {
    if (finalClearTimer) { clearTimeout(finalClearTimer); finalClearTimer = undefined; }
  };

  const scheduleFinalClear = (seq: number) => {
    cancelFinalClear();
    finalClearTimer = setTimeout(() => {
      finalClearTimer = undefined;
      if (seq === runSeq) { clearProgress(); clearStatus(); }
    }, FINAL_CLEAR_DELAY_MS);
    (finalClearTimer as { unref?: () => void }).unref?.();
  };

  const shouldFlashFinal = (finalState: FinalState): boolean => {
    if (flashLevel === "disabled") return false;
    if (flashLevel === "error") return finalState === "error" || finalState === "cancelled";
    return true;
  };

  // ── Events ──

  pi.on("session_start", () => {
    cancelFinalClear();
    runState = createEmptyRunState();
    agentActive = false;
    activeToolCount = 0;
    clearProgress();
    clearStatus();
    notify("Ready to work", "Session started");
  });

  pi.on("agent_start", () => {
    runSeq += 1;
    agentActive = true;
    cancelFinalClear();
    runState = createEmptyRunState();
    activeToolCount = 0;
    setStatus("running", "Pi running");
    setProgress(0.08, "Starting");
    appendLog("progress", "Run started");
  });

  pi.on("agent_end", async (event) => {
    agentActive = false;
    activeToolCount = 0;
    const durationMs = Date.now() - runState.startedAt;
    const failure = summarizeRunFailure(event.messages, runState.firstToolError);
    const finalState = buildFinalState(failure, runState, durationMs, thresholdMs);
    const summary = failure?.summary || summarizeSuccess(runState, durationMs, thresholdMs);

    // Status + progress
    if (finalState === "error") {
      setStatus("error", "Pi error");
      setProgress(1, "Error");
      appendLog("error", summary);
      triggerFlash(true);
      notify("Me not that kind of orc!", summary);
    } else if (finalState === "cancelled") {
      setStatus("cancelled", "Pi cancelled");
      setProgress(1, "Cancelled");
      appendLog("warning", summary);
      if (shouldFlashFinal(finalState)) triggerFlash(false);
      if (shouldNotify(notifyLevel, finalState)) {
        notify("Work, work", summary);
      }
    } else if (finalState === "complete") {
      setStatus("complete", "Pi done");
      setProgress(1, "Done");
      appendLog("success", summary);
      if (shouldFlashFinal(finalState)) triggerFlash(false);
      if (shouldNotify(notifyLevel, finalState)) {
        notify("Work, work", summary);
      }
    } else {
      setStatus("waiting", "Pi waiting");
      setProgress(1, "Waiting");
      appendLog("info", summary);
      if (shouldFlashFinal(finalState)) triggerFlash(false);
      if (shouldNotify(notifyLevel, finalState)) {
        notify("Work, work", summary);
      }
    }

    scheduleFinalClear(runSeq);
  });

  pi.on("turn_start", (event) => {
    runState.turnCount = Math.max(runState.turnCount, event.turnIndex + 1);
    setStatus("running", event.turnIndex > 0 ? `Pi turn ${event.turnIndex + 1}` : "Pi thinking");
    setProgress(estimateProgress(runState), "Thinking");
    appendLog("progress", `Turn ${event.turnIndex + 1} started`);
  });

  pi.on("tool_execution_start", (event) => {
    activeToolCount += 1;
    setStatus("tool", `Pi ${event.toolName}`);
    setProgress(estimateProgress(runState), event.toolName);
    appendLog("progress", `Running ${event.toolName}`);
  });

  pi.on("tool_execution_end", () => {
    activeToolCount = Math.max(0, activeToolCount - 1);
    if (agentActive && activeToolCount === 0) {
      setStatus("running", "Pi thinking");
      setProgress(estimateProgress(runState), "Thinking");
    }
  });

  pi.on("tool_result", (event) => {
    runState.toolCount += 1;

    if (event.isError) {
      const err = summarizeToolError(event);
      if (!runState.firstToolError) runState.firstToolError = err;
      appendLog("warning", err);
      setProgress(estimateProgress(runState), "Tool warning");
      return;
    }

    // Classify successful tool results
    if (isReadToolResult(event)) {
      const path = getPathFromInput(event.input);
      if (path) runState.readFiles.add(path);
    } else if (isEditToolResult(event) || isWriteToolResult(event)) {
      const path = getPathFromInput(event.input);
      if (path) runState.changedFiles.add(path);
    } else if (isGrepToolResult(event) || isFindToolResult(event)) {
      runState.searchCount += 1;
    } else if (isBashToolResult(event)) {
      runState.bashCount += 1;
    }

    setProgress(estimateProgress(runState), "Working");
  });

  pi.on("session_shutdown", async () => {
    runSeq += 1;
    agentActive = false;
    activeToolCount = 0;
    cancelFinalClear();
    notify("Work complete.", "Session ended");
    clearStatus();
    clearProgress();
    await flushCmds();
  });

  // ── Custom tools ──

  pi.registerTool({
    name: "cmux_status",
    label: "Update Cmux Status",
    description: "Update the Pi status pill in cmux sidebar",
    parameters: {
      type: "object",
      properties: {
        value: { type: "string", description: "Status text" },
        icon: { type: "string", description: "SF Symbol icon name" },
        color: { type: "string", description: "Hex color" },
      },
      required: ["value"],
    },
    async execute(_id, params) {
      const { value, icon, color } = params as { value: string; icon?: string; color?: string };
      const a = ["set-status", statusKey, value];
      if (icon) a.push("--icon", icon);
      if (color) a.push("--color", color);
      enqueue(a);
      return { content: [{ type: "text", text: `Status: ${value}` }] };
    },
  });

  pi.registerTool({
    name: "cmux_notify",
    label: "Send Cmux Notification",
    description: "Send a notification and optionally flash cmux",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Notification title" },
        body: { type: "string", description: "Notification body" },
        doFlash: { type: "boolean", description: "Also trigger flash" },
      },
      required: ["title"],
    },
    async execute(_id, params) {
      const { title, body, doFlash } = params as { title: string; body?: string; doFlash?: boolean };
      enqueue(["notify", "--title", "Pi", "--subtitle", title, "--body", body ?? ""]);
      if (doFlash) enqueue(["trigger-flash"]);
      return { content: [{ type: "text", text: `Notified: ${title}` }] };
    },
  });
}
