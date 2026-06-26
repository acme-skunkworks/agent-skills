---
name: cleanup-repo
description: >-
  Clean up a Git repository's merged branches and worktrees, then prune
  filesystem cruft (recursively-empty directories and orphaned node_modules).
  Use when asked to clean up / tidy / prune merged branches, remove stale or
  finished worktrees, delete branches whose PRs have already merged (including
  squash-merges), or sweep empty directories and leftover node_modules. Two-pass
  merge detection (git ancestry plus merged GitHub PRs), an uncommitted-changes
  guard on worktrees, an optional Linear "Done" writeback, a single confirmation
  gate, and a --dry-run preview. Protected branches are never touched.
license: MIT
compatibility: >-
  Requires the `git` and `gh` CLIs. The optional Linear status check needs the
  Linear MCP server; if it is unavailable, skip that step silently. The
  filesystem pass needs Node.js ≥22.
metadata:
  version: 0.1.3
allowed-tools: Read, Bash(git:*), Bash(gh:*), Bash(node:*), mcp__linear-server__get_issue, mcp__linear-server__save_issue, mcp__linear-server__list_issue_statuses
---

# cleanup-repo

Remove merged Git worktrees and branches, then run a filesystem-hygiene pass —
all behind a single confirmation gate, with a `--dry-run` preview.

The branch/worktree pass mirrors the behaviour of the `/cleanup-branches`
slash command it was extracted from. The filesystem-hygiene pass (recursively-empty
directories and orphan `node_modules/`) is new to this skill. See
[`references/design-notes.md`](references/design-notes.md) for the naming
rationale and the deliberately-deferred future extensions.

## Configuration

Three knobs live in [`config.json`](config.json) beside this file. Read it at the
start of a run and use its values throughout. Edit your copied `config.json` to
match the consuming repo:

| Key | Meaning | Default |
| --- | --- | --- |
| `linearTeamName` | Linear team **name** used to resolve the live `Done` state. Use the name, not the key — the key is renamed over time but the name is stable. | `"ACME Skunkworks"` |
| `issueKeys` | Team-key prefixes that may appear in branch names. The issue-ID regex is built from these. Keep legacy keys so old branches still match. | `["ASW", "AKW", "SKW"]` |
| `protectedBranches` | Branches that are **never** deleted, locally or remotely. | `["main"]` |

Build the issue-ID regex by joining `issueKeys` with `|`:
`\b((?:ASW|AKW|SKW)-\d+)\b` for the defaults above. Match it against the
**upper-cased** branch name (branches like `asw-7-as-acquired` carry the key in
lower case).

If the Linear MCP server is not available, skip the Linear status check and the
optional `Done` writeback silently — they are not required for branch cleanup.

## Usage modes

**Dry run** — preview everything, change nothing:

```bash
cleanup-repo --dry-run
```

**Normal** — preview, then delete after a single confirmation:

```bash
cleanup-repo
```

These are skill invocations, not a standalone CLI: `cleanup-repo` is the skill and
`--dry-run` is passed through `$ARGUMENTS` (the agent reads it from there), so a bare
`cleanup-repo --dry-run` in a shell does nothing.

There is one bulk confirmation gate (Step 8) covering both the branch/worktree
pass and the filesystem pass. `--dry-run` short-circuits before that gate.

## Process

### Step 1 — Fetch latest from remote

```bash
git fetch --prune origin
```

### Step 2 — Identify worktrees to remove

```bash
git worktree list
```

- List all worktrees except the main repository directory (the primary working
  directory is never removed).
- Identify worktrees whose branch is fully merged into `main`.
- Identify worktrees in detached-HEAD state — treat as abandoned, safe to remove.
- Identify worktrees with uncommitted changes: `git -C <path> status --porcelain`
  non-empty. These are surfaced separately in Step 6 and **never removed
  automatically** — the user handles them manually (`git worktree remove --force
  <path>` once they have moved or discarded the work).
- Worktree location is irrelevant to detection; `git worktree list` enumerates
  them wherever they live (e.g. a gitignored `.claude/worktrees/<branch>/`).

### Step 3 — Identify merged branches (two-pass)

**Pass 1 — Git-merged branches:**

- Find local branches merged into `main`: `git branch --merged origin/main`.
- Exclude every branch in `protectedBranches`.
- Determine which of those branches also still exist on the remote.

**Pass 2 — Squash-merged branches:**

A squash merge lands a single new commit on `main`, so the branch's own commits
are never ancestors of `main` and `git branch --merged` misses it. For each local
branch **not** caught in Pass 1 (and not protected):

```bash
gh pr list --head <branch-name> --state merged --json number,title --limit 1
```

`gh` auto-detects the repository from the current directory's remote, so no
`--repo` flag is needed.

- A non-empty result means the branch has a merged PR — treat it as merged and
  add it to the cleanup list.
- An empty result means the branch is genuinely unmerged — leave it alone.
- Record the PR number and title for the summary so the user can verify.

### Step 4 — Check Linear issue status for merged branches

For each merged branch whose name contains an issue ID (extract with the regex
built from `issueKeys`, matched against the upper-cased branch name):

- Fetch the issue via `mcp__linear-server__get_issue`.
- Track any issue that is **not** in `Done` status.

Skip this step silently if the Linear MCP server is unavailable.

### Step 5 — Run the filesystem-hygiene detection

Run the bundled script against the repository root to get the candidate list.
It is read-only without `--apply`:

```bash
node scripts/filesystem-hygiene.mjs <repo-root> --json
```

Two paths here point at different places, so resolve each deliberately:

- `<repo-root>` is the **target repository** being cleaned — obtain it with
  `git rev-parse --show-toplevel`. The script refuses to run against a root with no
  `.git` entry, so a mis-pointed root can't sweep arbitrary directories.
- `scripts/filesystem-hygiene.mjs` is **relative to this skill bundle** (where this
  `SKILL.md` lives), not to `<repo-root>`. If your working directory is the target
  repo, give the script its absolute bundle path.

It prints `{ "emptyDirs": [...], "orphanNodeModules": [...] }`:

- **`emptyDirs`** — top-most recursively-empty directories (no files anywhere in
  the subtree). Directories holding any file — including a `.gitkeep` /
  `.gitignore` placeholder — are left alone. `.git/` is never traversed.
- **`orphanNodeModules`** — `node_modules/` directories whose immediate parent has
  no `package.json` (strict; no workspace inference). Removing one re-installs is
  needed if the parent was not actually meant to be gone — which is why these are
  surfaced **separately**.

This detection is read-only and feeds the Step 6 preview. One subtlety: Step 9
removes worktrees **before** re-running the detection with `--apply`, so the apply
pass can additionally sweep a parent that becomes empty only once its worktrees are
gone (e.g. `.claude/worktrees/`). Such a directory won't appear in this pre-removal
detect output — predict it from the worktree-removal list and label it as a
post-removal sweep in the preview, so the user isn't surprised when `--apply`
removes it.

### Step 6 — Display everything to be deleted

Show clear, counted lists. Keep the filesystem groups separate so the user can
eyeball them:

```text
## Worktrees to Remove (3)
- /path/.claude/worktrees/ASW-7-as-acquired (merged)
- /path/.claude/worktrees/ASW-9-button-styling (squash-merged, PR #42)
- /path/.claude/worktrees/orphan-detached (detached HEAD)

## Worktrees Skipped — Uncommitted Changes (1)
- /path/.claude/worktrees/ASW-12-wip (merged, but `git status` is non-empty;
  remove manually with `git worktree remove --force <path>`)

## Local Branches to Delete (3)
- ASW-7-as-acquired (merged)
- ASW-9-button-styling (squash-merged, PR #42 "Fix button styling")
- chore-update-deps (merged)

## Remote Branches to Delete (2)
- ASW-7-as-acquired
- ASW-9-button-styling

## Linear Issues Still Open (1)
- ASW-9 "Button styling" — currently In Review (branch: ASW-9-button-styling)

## Empty Directories to Remove (1)
- /path/.claude/worktrees   (predicted: empty once the worktrees above are removed)

## Orphan node_modules to Remove (1)
- /path/old-package/node_modules   (no sibling package.json)
```

### Step 7 — Dry-run handling

If `--dry-run` is set, STOP here. Print `DRY RUN MODE - No changes were made` and
exit without changing anything.

### Step 8 — Confirmation (normal mode only)

Ask once: `Do you want to delete these worktrees, branches, and files? (yes/no)`.
Proceed only if the user answers `yes`; otherwise exit without deleting.

### Step 9 — Execute, in order

Order matters. Worktrees must go before their branches, and the filesystem pass
runs **after** worktree removal so a just-emptied worktree parent (e.g.
`.claude/worktrees/`) is swept in the same run.

1. **Remove worktrees** (skip the uncommitted-changes group from Step 6):

   ```bash
   git worktree remove <path>
   ```

2. **Prune stale worktree references:**

   ```bash
   git worktree prune
   ```

3. **Delete local branches:**

   ```bash
   git branch -d <branch-name>   # Pass 1 (git-merged) — safe delete
   git branch -D <branch-name>   # Pass 2 (squash-merged) — force is safe: a
                                 # merged PR was confirmed via the GitHub API
   ```

   The branch you are currently on — or one checked out in a worktree — cannot be
   deleted: `git branch -d` fails by design. The per-item error handling catches it
   and moves on, so it is auto-skipped; this is expected, not a failure.

4. **Delete remote branches** that still exist:

   ```bash
   git push origin --delete <branch-name>
   ```

5. **Filesystem-hygiene removal** — re-run the bundled script with `--apply`. It
   removes exactly the same set it detects and prints what it removed:

   ```bash
   node scripts/filesystem-hygiene.mjs <repo-root> --apply
   ```

   `<repo-root>` and the bundle-relative `scripts/` path resolve exactly as in
   Step 5 (`git rev-parse --show-toplevel` for the root; the script lives in this
   skill bundle). Removing an orphan `node_modules/` can leave its parent empty;
   that parent is intentionally left for a follow-up run rather than swept in this
   snapshot.

### Step 10 — Optional Linear `Done` writeback

If any Linear issues from Step 4 are not `Done`:

- Ask: `These Linear issues are linked to merged branches but aren't Done. Set
  them to Done? (yes/no)`. **Default no** — Linear's GitHub integration normally
  handles this on PR merge, so this exists only for the rare case where it didn't
  fire (e.g. the issue ID was added after the merge).
- If yes:
  - Resolve the live `Done` state ID **once** via
    `mcp__linear-server__list_issue_statuses` with `team: <linearTeamName>` —
    state IDs are per-team and the team key changes over time, so pass the team
    *name*.
  - For each open issue, call `mcp__linear-server__save_issue` with
    `state: <Done state ID>`.
- If no, skip without changes.

### Step 11 — Summary

Report counts: worktrees removed, local branches deleted, remote branches
deleted, empty directories removed, orphan `node_modules/` removed, Linear issues
set to `Done` (if any). List the names of deleted items.

## Important rules

- **Dry-run** previews without deleting (`--dry-run`).
- **Confirmation required** before any deletion (single bulk gate).
- **Protected branches** (`protectedBranches`) are never touched.
- **Merged only**: a branch is deleted only if merged into `main` via git
  ancestry **or** a merged GitHub PR (squash merges).
- **Worktrees first**, then branches; filesystem pass last.
- **Uncommitted worktrees** are never force-removed automatically.
- **`.git/` and the main worktree** are never touched.

## Error handling

- Skip (and report) any worktree or branch that fails to remove; continue with
  the rest.
- Skip remote branches that no longer exist (already deleted).
- If `gh pr list` fails for a branch (network, rate limit, auth), log a warning
  and continue — do not treat the branch as merged.
- If the Linear MCP server is unavailable, skip the Linear steps silently.

## Arguments

$ARGUMENTS
