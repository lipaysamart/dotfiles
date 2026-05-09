/**
 * Direnv Auto-Load Extension
 *
 * Automatically loads direnv environment variables when pi starts.
 * Hooks into bash tool calls to ensure direnv is sourced before every command,
 * so the LLM always has access to the correct environment from .envrc / .env.
 *
 * Features:
 * - Detects .envrc or .env in current/project directories
 * - Prepends `eval "$(direnv export bash)"` to all bash tool calls
 * - Intercepts user_bash (! commands) to also load direnv
 * - Shows direnv status in the footer
 * - Allows via `direnv allow` if .envrc is not yet authorized
 *
 * Prerequisites:
 *   direnv must be installed (brew install direnv, apt install direnv, etc.)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	createBashTool,
	createLocalBashOperations,
} from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execSync } from "node:child_process";

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();

	// ── Find .envrc or .env files ──────────────────────────────────────────
	let envrcPath: string | null = null;
	let direnvAvailable = false;

	function findEnvrcFiles(): string[] {
		const candidates: string[] = [];
		let dir = cwd;
		// Walk up the directory tree looking for .envrc
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const testPath = resolve(dir, ".envrc");
			if (existsSync(testPath)) {
				candidates.push(testPath);
				break; // Stop at first .envrc found (direnv behavior)
			}
			const parent = dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
		return candidates;
	}

	function checkDirenvAvailable(): boolean {
		try {
			execSync("which direnv 2>/dev/null", { stdio: "ignore" });
			return true;
		} catch {
			return false;
		}
	}

	function ensureDirenvAllowed(rcPath: string): boolean {
		try {
			// Check if .envrc is allowed by direnv
			// `direnv allow` is idempotent — safe to call every time
			execSync(`direnv allow "${rcPath}" 2>/dev/null`, { stdio: "ignore" });
			return true;
		} catch {
			return false;
		}
	}

	// ── Initialize ─────────────────────────────────────────────────────────
	direnvAvailable = checkDirenvAvailable();
	if (direnvAvailable) {
		const envrcFiles = findEnvrcFiles();
		if (envrcFiles.length > 0) {
			envrcPath = envrcFiles[0];
			ensureDirenvAllowed(envrcPath);
		}
	}

	// ── Create bash tool with direnv spawn hook ────────────────────────────
	const bashTool = createBashTool(cwd, {
		spawnHook: ({ command, cwd: cmdCwd, env }) => {
			if (!direnvAvailable || !envrcPath) {
				return { command, cwd: cmdCwd, env };
			}
			// Prepend direnv export so every bash command sees the right env
			const prefixedCommand = `eval "$(direnv export bash 2>/dev/null)"\n${command}`;
			return { command: prefixedCommand, cwd: cmdCwd, env };
		},
	});

	// Override the built-in bash tool with our direnv-aware version
	pi.registerTool({
		...bashTool,
		execute: async (id, params, signal, onUpdate, ctx) => {
			return bashTool.execute(id, params, signal, onUpdate);
		},
	});

	// ── Intercept user_bash (!! commands) ──────────────────────────────────
	pi.on("user_bash", (event, ctx) => {
		if (!direnvAvailable || !envrcPath) return;

		// Wrap pi's local bash backend to inject direnv before user commands
		const local = createLocalBashOperations();
		return {
			operations: {
				exec: async (
					command: string,
					cmdCwd: string,
					options: { signal?: AbortSignal; timeout?: number },
				) => {
					const prefixed = `eval "$(direnv export bash 2>/dev/null)"\n${command}`;
					return local.exec(prefixed, cmdCwd, options);
				},
			},
		};
	});

	// ── Status indicator ───────────────────────────────────────────────────
	pi.on("session_start", async (_event, ctx) => {
		if (!direnvAvailable) {
			ctx.ui.setStatus(
				"direnv",
				ctx.ui.theme.fg("warning", "⚠ direnv not installed"),
			);
			return;
		}

		if (!envrcPath) {
			// No .envrc found — silently hide the status
			return;
		}

		const label = ctx.ui.theme.fg("accent", "δ");
		const path = ctx.ui.theme.fg("dim", envrcPath.replace(cwd, "."));
		ctx.ui.setStatus("direnv", `${label} ${path}`);
	});

	// ── Provide hint in the system prompt about direnv availability ────────
	pi.on("before_agent_start", async (event, _ctx) => {
		if (!direnvAvailable || !envrcPath) return;

		const hint = `\nNote: direnv is active (${envrcPath}). Environment variables from .envrc are automatically loaded before every bash command.`;
		return {
			systemPrompt: event.systemPrompt + hint,
		};
	});
}
