---
name: cli-help-first
description: Before executing complex CLI tools (kubectl, docker, terraform, ansible, go, uv, vite, tailscale, vault, packer, vagrant), always check --help or man pages first to understand command syntax and parameters. Use this skill whenever the user asks to run commands with these tools, even for seemingly simple operations. This reduces hallucinations and retry errors by ensuring correct command construction.
---

# CLI Help-First

When using complex command-line tools, consulting help documentation first can significantly reduce errors and retries.

## Core Principle

Before executing target CLI tool commands, you **must first** understand the correct syntax and parameters through `--help` or `man`.

## Applicable Tools

This skill applies to the following complex CLI tools:

- **Container/Orchestration**: `kubectl`, `docker`, `podman`
- **Infrastructure**: `terraform`, `ansible`, `packer`, `vagrant`
- **Secrets Management**: `vault`
- **Development Tools**: `go`, `uv`, `bun`, `vite`
- **Networking**: `tailscale`

Common bash commands that **do not require** pre-checking help:
`ls`, `cd`, `cp`, `mv`, `rm`, `mkdir`, `cat`, `echo`, `grep`, `find`, `git`, `sed`, `awk` for common operations (e.g., `git status`, `git add`, `git commit`, `git push`, `git pull`)

## Workflow

### 1. Check Help Cache

First check if help information for this tool has been cached in the current session. Cache stores raw help output and version info:

```
CLI_HELP_CACHE = {
  "<tool>": {
    "version": "<version-string>",
    "help_raw": "<full --help output>",
    "subcommands": {
      "<subcommand>": {
        "help_raw": "<subcommand --help output>"
      }
    }
  }
}
```

Cache lookup logic:
- If tool exists in cache AND version unchanged → use cached help
- If tool not in cache OR version changed → fetch fresh help
- Subcommands are cached on-demand when accessed

If already cached with matching version, skip to step 3.

### 2. Retrieve Help Information

First get version, then fetch help:

```bash
<tool> --version       # Get version for cache validation
<tool> --help           # Get brief help
<tool> <subcommand> --help  # Get detailed subcommand help (cache on-demand)
man <tool>              # Fallback if --help is insufficient
```

After retrieval, store in cache:
```
CLI_HELP_CACHE["<tool>"] = {
  "version": "<captured version>",
  "help_raw": "<help output>",
  "subcommands": {}
}
```

### 3. Understand and Build Command

Based on help information:

- Confirm command syntax
- Identify required and optional parameters
- Understand parameter format requirements
- Review examples (if available)

### 4. Execute Command

Build the correct command and execute. If errors occur, re-check help information to confirm.

## Examples

**Example 1: Using kubectl to create deployment**

User request: Use kubectl to create an Nginx replica

```
Step 1: kubectl --help
Step 2: kubectl create --help
Step 3: kubectl create deployment --help
Step 4: Execute: kubectl create deployment nginx --image=nginx
```

**Example 2: Using docker to build image**

User request: Build an image named myapp with docker

```
Step 1: docker --help
Step 2: docker build --help
Step 3: Execute: docker build -t myapp .
```

**Example 3: Using terraform to create resources**

User request: Initialize and apply configuration with terraform

```
Step 1: terraform --help
Step 2: terraform init --help
Step 3: Execute terraform init
Step 4: terraform apply --help
Step 5: Execute terraform apply
```

**Example 4: Cache in action**

```
# First time using kubectl in session
Step 1: kubectl version --client → "v1.28.0"
Step 2: kubectl --help → cache CLI_HELP_CACHE["kubectl"]["help_raw"]
Step 3: kubectl create --help → cache CLI_HELP_CACHE["kubectl"]["subcommands"]["create"]["help_raw"]

# Later in same session, using kubectl again
Step 1: Check cache → kubectl exists, version matches → skip fetch
Step 2: Use cached help_raw directly
Step 3: If need new subcommand (e.g., kubectl delete), fetch and cache on-demand
```

## Notes

- Even if you "know" how to use a command, you should still check help first, as different versions may have differences
- For multi-level subcommands, check help level by level (e.g., `kubectl` → `kubectl create` → `kubectl create deployment`)
- When help information is long, focus on the SYNOPSIS and EXAMPLES sections
- If a command fails, first check the help information to confirm parameter format is correct, rather than guessing fixes

## Cache Invalidation

Cache is invalidated when:
- New session starts (memory-based, not persistent)
- Version changes detected (`<tool> --version` output differs)
- Command fails with syntax error (may indicate help was misunderstood, re-fetch)
- User explicitly requests fresh help