---
name: explore-codebase
description: Use when the user asks to understand where code lives, map architecture, trace callers/callees/imports, inspect flows, onboard to an unfamiliar area, or answer "where/how is X implemented?" with Code Review Graph. Do not use for `/review`, root-cause debugging, or refactoring unless the user is primarily asking for codebase navigation.
---

# Explore Codebase

Use Code Review Graph as a bounded navigation layer for understanding Vine's structure before opening broad sets of files. This skill is for orientation and relationship tracing; it does not replace targeted file reads or repo-specific skills such as `zero`, `connect`, `one`, `tamagui`, or `vine-server-patterns`.

## Workflow

Start with a compact graph summary:

```text
get_minimal_context_tool(task="<what you are trying to understand>")
```

Choose the next graph calls based on the question:

- Architecture overview: `get_architecture_overview_tool()`
- Major modules: `list_communities_tool(detail_level="minimal")`, then `get_community_tool(...)` for one relevant community
- Entry points and call paths: `list_flows_tool(detail_level="minimal")`, then `get_flow_tool(...)` for one relevant flow
- Specific symbol or concept: `semantic_search_nodes_tool(query="<term>", detail_level="minimal")`
- Relationships around a known target: `query_graph_tool(pattern="<pattern>", target="<file/function/class>", detail_level="minimal")`
- Free-form neighborhood traversal: `traverse_graph_tool(query="<term>", depth=1 or 2, token_budget=1500)`

Useful `query_graph_tool` patterns:

- `children_of` for functions/classes inside a file or class
- `callers_of` and `callees_of` for behavior tracing
- `imports_of` and `importers_of` for module dependencies
- `tests_for` for nearby test coverage
- `file_summary` for graph-indexed contents of a file

## Boundaries

Keep graph usage small: target 2-4 graph calls, then read the most relevant source files with `rg`, `sed`, or editor tools. Use `detail_level="minimal"` unless the compact result is not enough to answer the user's question.

Do not hardcode personal absolute paths. Let MCP tools auto-detect the repo when possible; if a `repo_root` is necessary, use the active workspace's repo root.

Do not use this skill to produce review findings. For pre-landing audits, use `review`. For bugs with symptoms, use the debugging workflow. For planned refactors, use the refactoring workflow.

## Output

Answer with a concise map of what matters:

- Where the relevant code lives
- The important functions/classes/files and how they relate
- The entry points or flows involved
- Which files are worth reading next

Prefer concrete file references over broad architecture prose.
