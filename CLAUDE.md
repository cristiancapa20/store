# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->


## Quality Gates

Run these before marking any task done. Both must exit with code 0:

```bash
npm run typecheck   # tsc --noEmit — zero errors required
npm run lint        # eslint — zero errors required (warnings ok)
```

For UI changes, also verify visually in the browser using the dev-browser skill.

## Architecture

- **Frontend only** — no backend logic lives here. The Inventory Service owns all inventory and sales data.
- **Server actions** (`lib/actions.ts`) are the only place that calls the Inventory Service API. No `fetch` to the inventory API in `"use client"` files — ever.
- **SQLite** (`lib/db.ts`) stores only the `users` table for auth. No other data is persisted locally.
- **Auth**: NextAuth v5, Credentials provider, `httpOnly` session cookies.

## Key Files

| File | Purpose |
|---|---|
| `lib/actions.ts` | All server actions — API proxy layer |
| `lib/db.ts` | SQLite setup — users table only |
| `lib/types.ts` | Shared TypeScript types |
| `components/BottomNav.tsx` | Responsive nav (sidebar lg+, bottom bar mobile) |
| `components/BarcodeInput.tsx` | Camera + HID scanner component |
| `app/layout.tsx` | Root layout |

## Conventions

- **Never expose `INVENTORY_API_KEY` to the client.** All API calls go through server actions.
- **Tailwind only** — no inline styles, no CSS modules. Use `rounded-2xl` or higher for cards and buttons.
- **Min 48px tap targets** on all interactive elements (buttons, links, steppers).
- **No new SQLite tables** without a clear reason — the inventory service owns the data.
- **TypeScript strict** — no `any`, no `@ts-ignore`. Use proper types or generics.
- **No comments** unless the WHY is non-obvious (hidden constraint, workaround, invariant).
- **i18n required** — all user-visible text must live in `messages/es.json` AND `messages/en.json`. Never hardcode UI strings. Client components use `useTranslations`, server components use `getTranslations` (from `next-intl/server`). Default locale is `es`.

## Environment Variables

Required in `.env.local`:

```
INVENTORY_API_URL      # Must include /v1 suffix: http://localhost:3001/v1
INVENTORY_API_KEY      # Bearer token — server-side only
INVENTORY_LOCATION_ID  # UUID of the store location
NEXTAUTH_SECRET        # NextAuth session secret
NEXTAUTH_URL           # Full app URL
STORE_NAME             # Shown on PDF invoices
TAX_RATE               # Decimal (e.g. 0.10 for 10%)
SEED_ADMIN_EMAIL       # Used by npm run seed
SEED_ADMIN_PASSWORD    # Used by npm run seed
```

## Dev Setup

```bash
# 1 — Install
npm install

# 2 — Configure env
cp .env.local.example .env.local   # then fill in values

# 3 — Seed admin user (first time only)
npm run seed

# 4 — Run (inventory service must be on port 3001)
npm run dev
```
