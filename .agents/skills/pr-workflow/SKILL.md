---
name: pr-workflow
description: Use for PR-backed implementation work in the repository, including creating or updating pull requests, waiting for GitHub checks and preview deployments, manually validating preview functionality with Playwright, checking SigNoz telemetry for PR environments, and adding applicable unit or e2e tests before completion.
---

# PR Workflow

Follow this workflow whenever PR work is expected to ship through a pull request.

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

- Follow the repo conventions first: npm workspaces, TypeScript, Biome, Vitest, and Playwright.
- Use the repo scripts for validation:

```sh
npm run lint
npm run typecheck
npm test
```

- Add or update focused unit tests for changed logic when applicable.
- Add or update Playwright tests for changed user-facing flows when applicable. The e2e config requires `PLAYWRIGHT_BASE_URL`; local runs should point at a deployed preview or an equivalent running app.

## Pull Request Loop

- Push the branch to `origin` and create a PR against `main` in `cleverbrush/xpenser`.
- Prefer the GitHub MCP tools for PR creation and status checks; this environment may not have the `gh` CLI installed.
- Before creating or updating the PR, write a complete PR body that gives reviewers enough context to understand the request, the implementation, and the verification without reconstructing the work from the diff:
  - Include an **Original request** section. Quote or accurately summarize the user's request that triggered the work. Do not include secrets, credentials, or unrelated private context.
  - Include a **What changed** section with concrete details about the files, behavior, configuration, tests, or workflows changed. Avoid vague summaries such as "updated auth" when the exact change was "set Auth.js session and API JWT max age to 1,209,600 seconds."
  - Include a **Reasoning** section explaining why this approach was chosen, what alternatives or tradeoffs mattered, and how the change fits the existing codebase conventions.
  - Include a **Screenshots / preview evidence** section. Add screenshots to the PR description whenever the work affects UI, preview-visible behavior, or manual QA can demonstrate the requested outcome. Capture the relevant before/after or preview state with Playwright or agent-browser. If the work is non-visual, explicitly say screenshots are not applicable and explain why.
  - Include a **Validation** section listing local commands, GitHub checks, preview QA, and SigNoz checks. Mark anything skipped or blocked with the reason.
  - Keep the PR body current after every meaningful push, especially after fixing CI, e2e, preview QA, or telemetry issues.
- After every push, wait for all required GitHub jobs to finish. The PR workflow runs:
  - `Lint and test`
  - `Deploy PR environment`
  - `Playwright e2e`
- If any job fails, inspect the failed job or artifact, fix the code in the worktree, push again, and repeat the wait loop.
- The preview URL is deterministic:

```text
https://xpenser-pr-<three-digit-pr-number>.cleverbrush.com
```

For example, PR `7` deploys to `https://xpenser-pr-007.cleverbrush.com`.

## Preview QA

- After checks pass and the PR environment exists, exercise the implemented functionality in the preview with Playwright.
- Capture screenshots of the relevant preview state during manual QA when they help prove the requested behavior or illustrate the changed UI. Add those screenshots or stable artifact links to the PR description rather than leaving them only in local files.
- Sign in with the seeded account:

```text
Email: test@cleverbrush.com
Password: testPassw0rd
```

- Match the existing e2e helpers in `tests/e2e/helpers.ts` for login and setup behavior.
- Validate the exact feature or fix requested by the user, not only app startup.
- If preview QA finds a bug, fix it in the worktree, push again, wait for CI and deploy, and retest the new preview.

## SigNoz Verification

- After preview QA has exercised the feature, check SigNoz for the PR environment.
- Use resource-attribute filters whenever possible. Relevant service names are:
  - `xpenser-web-pr-<PR number>`
  - `xpenser-api-pr-<PR number>`
  - `xpenser-telegram-bot-pr-<PR number>` when bot behavior is relevant
- Check traces, logs, and metrics for the services touched by the change. Start with the signal most relevant to the work, then inspect other signals if errors or missing telemetry suggest a problem.
- Treat unexpected errors, missing service telemetry, broken trace/log correlation, or suspicious metric behavior as bugs. Fix, push, wait for deployment, rerun preview QA, and recheck SigNoz.

## Completion

- Finish only after the PR branch has passing checks, a working preview, applicable tests, and clean SigNoz verification.
- Summarize the PR URL, preview URL, validation performed, and any residual risks or skipped checks.
