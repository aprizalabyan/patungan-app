# CLAUDE.md

This repository keeps its agent instructions in a tool-agnostic file. Read and follow it:

@AGENTS.md

The documents it links under `docs/` are part of the instructions. Read the ones that match your task before editing.

## Claude Code specifics

- Prefer the dedicated Read/Grep/Glob/Edit tools over shell equivalents for file work.
- The shell on this project's usual development machine is Windows (PowerShell or Git Bash). Use forward slashes
  and quote paths that contain spaces.
- Verify with `npm run typecheck`, `npm test` and `npm run build`, and report the actual output, including failures.
- Do not create commits or pull requests unless asked.
