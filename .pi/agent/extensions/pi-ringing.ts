/**
 * Warcraft III 经典语音扩展 (单文件版本)
 *
 * 在关键代理事件时播放兽人苦工语音：
 * - session_start           → 会话启动
 * - agent_end                → 任务完成
 * - permissions:decision     → 需要权限 (调用 permission-system 弹窗时)
 * - tool_result(todo, add)   → Todo 生成
 *
 * 语音来源: PeonPing/og-packs
 */

import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// === 音频配置 (内联，无外部 manifest) ===
const SOUNDS: Record<string, Array<{ file: string; label: string }>> = {
	"session.start": [
		{ file: "PeonReady1.wav", label: "Ready to work!" },
		{ file: "PeonWhat2.wav", label: "Hmm?" },
	],
	"task.complete": [
		{ file: "PeonWorkComplete.wav", label: "Work complete." },
		{ file: "PeonYes1.wav", label: "I can do that." },
	],
	"permission.required": [
		{ file: "PeonWhat2.wav", label: "Hmm?" },
		{ file: "PeonWhat3.wav", label: "What you want?" },
	],
	"todo.created": [
		{ file: "PeonYes1.wav", label: "I can do that." },
		{ file: "PeonAngry1.wav", label: "Whaaat?" },
	],
	"question.asked": [
		{ file: "PeonWhat2.wav", label: "Hmm?" },
		{ file: "PeonWhat3.wav", label: "What you want?" },
		{ file: "PeonYes1.wav", label: "I can do that." },
	],
};

// 音频文件路径
const SOUND_DIR = join(homedir(), ".pi/sounds/warcraft3");

// === 节流: 防止语音轰炸 ===
let lastPlayTime = 0;
const THROTTLE_MS = 3000;

function canPlay(): boolean {
	const now = Date.now();
	if (now - lastPlayTime < THROTTLE_MS) {
		return false;
	}
	lastPlayTime = now;
	return true;
}

// === 跨平台播放器 ===
function getPlayer(): { bin: string; args: (p: string) => string[] } | null {
	if (process.platform === "darwin") {
		// macOS
		return { bin: "afplay", args: (p) => ["-v", "0.5", p] };
	}
	return null;
}

// === 异步播放 (fire-and-forget) ===
function play(filename: string): void {
	if (!canPlay()) return;

	const player = getPlayer();
	if (!player) return;

	const fullPath = join(SOUND_DIR, filename);
	if (!existsSync(fullPath)) return;

	const proc = spawn(player.bin, player.args(fullPath), {
		detached: true,
		stdio: "ignore",
	});
	proc.unref();
}

// === 随机选一个音效播放 ===
function playRandomSound(key: string): void {
	const sounds = SOUNDS[key];
	if (!sounds || sounds.length === 0) return;

	const sound = sounds[Math.floor(Math.random() * sounds.length)];
	play(sound.file);
}

// === 扩展注册 ===
export default function (pi: ExtensionAPI) {
	// 1. 会话启动
	pi.on("session_start", () => {
		playRandomSound("session.start");
	});

	// 2. 任务完成 (agent_end 表示代理轮次结束)
	pi.on("agent_end", () => {
		playRandomSound("task.complete");
	});

	// 3. 需要权限 (监听 permission-system 的决策事件，有用户交互时播报)
	pi.events.on("permissions:decision", (data) => {
		const event = data as {
			surface: string;
			value: string;
			result: "allow" | "deny";
			resolution: string;
		};
		// resolution 以 user_ 开头表示触发过弹窗交互
		if (event.result === "deny" || event.resolution.startsWith("user_")) {
			playRandomSound("permission.required");
		}
	});

	// 4. Todo 生成 (todo 工具的 add action)
	pi.on("tool_result", async (event) => {
		if (event.toolName === "todo") {
			const input = event.input as { action?: string };
			if (input.action === "add") {
				playRandomSound("todo.created");
			}
		}
	});

	// 5. ask_user_question 工具被调用时触发
	pi.on("tool_call", async (event) => {
		if (event.toolName === "ask_user_question") {
			playRandomSound("question.asked");
		}
		return undefined;
	});
}