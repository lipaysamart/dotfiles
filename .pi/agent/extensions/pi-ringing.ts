/**
 * Warcraft III 经典语音扩展 (单文件版本)
 *
 * 在关键代理事件时播放兽人苦工语音：
 * - session_start           → 会话启动
 * - agent_end                → 任务完成
 * - tool_call(ask_user_question) → 用户提问时
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
	// 子 agent 进程中静默，不播放任何声音
	if (process.env.PI_SUBAGENT_CHILD === "1") return;

	// 1. 会话启动
	pi.on("session_start", () => {
		playRandomSound("session.start");
	});

	// 2. 任务完成 (agent_end 表示代理轮次结束)
	pi.on("agent_end", () => {
		playRandomSound("task.complete");
	});

	// 3. ask_user_question 提示音
	pi.on("tool_call", (event) => {
		if (event.toolName === "ask_user_question") {
			playRandomSound("question.asked");
		}
	});
}
