# AIOps Workbench — Project Workspace

This folder is your local workspace for AI-assisted project work. It is **gitignored** (only this README is tracked), so you can safely put private files, secrets, and project-specific context here without committing them.

## Folder structure

```
workspace/
  README.md                        ← this file (tracked)
  <project-id>/
    instructions.md                ← AI context for all tasks in this project
    any-reference-file.ts          ← files the AI can read when working on tasks
    design-notes.md
    buckets/
      <bucket-slug>/
        instructions.md            ← AI context specific to this work bucket
        any-bucket-specific-file   ← files scoped to this bucket
```

Project IDs look like `p1234567890` and are shown in the Workspace panel header when you open it from the board. Bucket slugs are lowercased, hyphenated versions of the bucket name — e.g. "Feature Development" becomes `feature-development`.

## How it works

When you run a task with AI, the workbench automatically injects workspace context into the prompt in this order:

1. **Project instructions** — read from `<project-id>/instructions.md`
2. **Bucket instructions** — read from `<project-id>/buckets/<bucket-slug>/instructions.md` (only when the task belongs to a bucket)
3. **Reference files** — all other files in either folder are listed so the AI can read them with its Read tool

Both levels are injected when a task has a bucket, so you can layer general project conventions at the project level and bucket-specific detail at the bucket level.

## Editing instructions in the UI

Open the **Workspace panel** from any of these entry points:

| Entry point | How to open |
|---|---|
| Project (board view) | Click **Workspace** in the project swimlane header |
| Work bucket (bucket view) | Click the **folder icon** in the bucket header (switch a project to Buckets view first) |
| Task panel | Select a bucket in the task's **Work Bucket** field, then click **Workspace** next to the dropdown |

The Workspace panel has two tabs:
- **Instructions** — a code-style editor for `instructions.md`. Changes are saved immediately on click.
- **Files** — upload reference files (up to 2 MB each) or remove existing ones. You can also drop files directly into the folder on disk.

## Setting up manually

You can also manage workspace files directly on disk without using the UI:

**Project-level:**
```bash
mkdir workspace/<project-id>
# Find your project-id by opening the Workspace panel from the board header
touch workspace/<project-id>/instructions.md
```

**Bucket-level:**
```bash
mkdir -p workspace/<project-id>/buckets/<bucket-slug>
# Bucket slug = lowercase bucket name with spaces replaced by hyphens
touch workspace/<project-id>/buckets/<bucket-slug>/instructions.md
```

Then edit `instructions.md` in any text editor — changes are picked up immediately on the next AI task run.

## Tips

- Keep `instructions.md` concise — it is prepended to every AI task prompt for that scope
- Use the **project level** for stack-wide conventions, file structure, and hard constraints
- Use the **bucket level** for feature-area specifics, relevant file paths, or domain context
- For large reference files, mention them in instructions so the AI knows to look for them rather than guessing
- Files are served by absolute path — the AI reads them using its Read tool, so any file format works as long as it's readable text
