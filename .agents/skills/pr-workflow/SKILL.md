---
name: pr-workflow
description: Use for PR-backed implementation work in a repository, including creating or updating pull requests, waiting for GitHub checks and preview deployments, manually validating preview functionality, checking telemetry when configured, sending PR-ready Telegram notifications when available, and adding applicable unit or e2e tests before completion.
---

# PR Workflow

Follow this workflow whenever PR work is expected to ship through a pull request.

## Project Guide

- First read `.agents/pr-workflow.md` in the repository root when it exists.
- Treat that file as the source of truth for project-specific details: GitHub repository, default branch, validation commands, required checks, preview URL rules, preview credentials, telemetry filters, and notification project name.
- If the project guide is missing, discover the same facts from the repo, CI config, package manifests, and PR metadata. Ask the user only when a required project-specific fact cannot be discovered safely.

## Worktree Setup

- Never implement PR work directly on `main` or `master`.
- Start by checking `git status --short --branch` in the current checkout and preserve unrelated user changes.
- Classify the task before creating the branch:
  - Use `feat/<task-slug>` for new functionality or behavior expansion.
  - Use `fix/<task-slug>` for bug fixes or regressions.
- Create the dedicated worktree next to the `main` checkout, under the same root directory:
  - Main checkout: `<root>/main`
  - Feature worktree: `<root>/feat/<task-slug>`
  - Bug-fix worktree: `<root>/fix/<task-slug>`
- Use the selected branch name and matching sibling worktree path, for example:

```sh
mkdir -p ../<branch-type>
git fetch origin main
git worktree add -b <branch-type>/<task-slug> ../<branch-type>/<task-slug> origin/main
```

- Do all implementation, local verification, commits, and pushes from the worktree.
- If a worktree or branch already exists for the task, inspect it and continue there instead of creating a conflicting branch.

## Local Implementation

- Follow the repo conventions and the validation commands listed in `.agents/pr-workflow.md`.
- Add or update focused unit tests for changed logic when applicable.
- Add or update e2e tests for changed user-facing flows when applicable. Use the project guide for required base URLs, credentials, and setup helpers.

## Feature Blog Post

- For public-facing feature work, create or update a Markdown blog post under `apps/web/content/blog/<task-slug>.mdx`.
- The post should explain the shipped feature in user-facing language, include a primary target keyword, include two to five secondary keyword phrases, and link naturally to relevant public pages.
- Include source PR metadata when the post is tied to a PR: `sourcePrNumber` and `sourcePrUrl`.
- Add a `heroImage` and `heroImageAlt` when there is a real screenshot or preview-visible product surface that honestly represents the feature. Store committed blog images under `apps/web/public/blog/`. Leave the hero image empty for internal, config-only, or non-visual posts instead of inventing a fake screenshot.
- Keep the post factual and tied to the implemented feature. Do not add keyword stuffing, claims that are not supported by the product, or roadmap promises.
- Skip the blog post only when the change is internal, security-sensitive, too small to justify a public update, or not user-facing. Record the skip reason in the PR body.
- When a blog post is included, validate the preview `/blog` page, the individual post URL, source PR links, and any hero screenshot rendering during Preview QA.

## Pull Request Loop

- Push the branch to `origin` and create a PR against the configured default branch and GitHub repository.
- Prefer the GitHub MCP tools for PR creation and status checks; this environment may not have the `gh` CLI installed.
- Before creating or updating the PR, write a complete PR body that gives reviewers enough context to understand the request, the implementation, and the verification without reconstructing the work from the diff:
  - Include an **Original request** section. Quote or accurately summarize the user's request that triggered the work. Do not include secrets, credentials, or unrelated private context.
  - Include a **What changed** section with concrete details about the files, behavior, configuration, tests, or workflows changed. Avoid vague summaries such as "updated auth" when the exact change was "set Auth.js session and API JWT max age to 1,209,600 seconds."
  - Include a **Reasoning** section explaining why this approach was chosen, what alternatives or tradeoffs mattered, and how the change fits the existing codebase conventions.
  - Include a **Blog post** section with the post URL, target keyword, and publish status, or the explicit skip reason.
  - Include a **Screenshots / preview evidence** section. Add screenshots to the PR description whenever the work affects UI, preview-visible behavior, or manual QA can demonstrate the requested outcome. Capture the relevant before/after or preview state with Playwright or agent-browser. If the work is non-visual, explicitly say screenshots are not applicable and explain why.
  - Include a **Validation** section listing local commands, GitHub checks, preview QA, and SigNoz checks. Mark anything skipped or blocked with the reason.
  - Keep the PR body current after every meaningful push, especially after fixing CI, e2e, preview QA, or telemetry issues.
- After every push, wait for all required GitHub jobs listed in the project guide to finish.
- If any required job fails, inspect the failed job or artifact, fix the code in the worktree, push again, and repeat the wait loop.
- Determine the preview environment URL from the project guide, PR checks, deployment metadata, or repository conventions.

## Preview QA

- After checks pass and the PR environment exists, exercise the implemented functionality in the preview with Playwright.
- Capture screenshots of the relevant preview state during manual QA when they help prove the requested behavior or illustrate the changed UI. Add those screenshots or stable artifact links to the PR description rather than leaving them only in local files.
- Use the preview credentials and e2e helpers listed in the project guide.
- Validate the exact feature or fix requested by the user, not only app startup.
- If preview QA finds a bug, fix it in the worktree, push again, wait for CI and deploy, and retest the new preview.

## SigNoz Verification

- After preview QA has exercised the feature, check telemetry when the project guide says telemetry is available.
- Use resource-attribute filters whenever possible. Use the service names and namespace patterns from the project guide.
- Check traces, logs, and metrics for the services touched by the change. Start with the signal most relevant to the work, then inspect other signals if errors or missing telemetry suggests a problem.
- Treat unexpected errors, missing service telemetry, broken trace/log correlation, or suspicious metric behavior as bugs. Fix, push, wait for deployment, rerun preview QA, and recheck SigNoz.

## Telegram Notification

- After the PR branch has passing required checks, a working preview, applicable tests, and telemetry verification or explicit telemetry skip, send a PR-ready notification when `PR_NOTIFICATION_API_TOKEN` is set.
- POST to `PR_NOTIFICATION_URL` when set, otherwise `http://127.0.0.1:8787/v1/pr-ready`.
- Send JSON with:
  - `project`: the notification project name from `.agents/pr-workflow.md`, or the repository name when no guide value exists.
  - `prUrl`: the GitHub PR URL.
  - `environmentUrl`: the preview or deployed environment URL.
  - `summary`: one concise sentence describing what changed.
- Authenticate with `Authorization: Bearer $PR_NOTIFICATION_API_TOKEN` and `Content-Type: application/json`.
- If the notifier is unavailable or `PR_NOTIFICATION_API_TOKEN` is missing, do not fail otherwise-ready PR work. Record the notification as skipped with the reason in the final summary.
- Never include notification tokens or Telegram chat IDs in PR bodies, commits, logs, or final user summaries.

## Completion

- Finish only after the PR branch has passing checks, a working preview, applicable tests, telemetry verification or explicit skip, and the Telegram notification sent or explicitly skipped.
- Summarize the PR URL, preview URL, validation performed, notification status, and any residual risks or skipped checks.
