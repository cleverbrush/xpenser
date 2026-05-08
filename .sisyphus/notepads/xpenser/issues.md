# Xpenser - Issues & Gotchas

## Known Issues
- Metis and Momus agent types have system-level bug (readonly property error) - use self-review
- Docker Scout warnings on some images - use pinned versions

## BLOCKER: task() dispatch system broken
- ALL task() calls fail with "Attempted to assign to readonly property"
- Affected: explore, librarian, oracle, metis, momus, build subagent_types
- Affected: quick, deep, visual-engineering, unspecified-high categories
- Affected: background and non-background modes
- Workaround: Direct execution via write/edit/bash tools
- Root cause: Likely OpenCode runtime bug in task dispatch mechanism

## Gotchas
- @cleverbrush/orm entity maps need table name to match schema `.hasTableName()`
- OTel telemetry MUST be loaded FIRST via --import flag
- Knex migrations use explicit knex import, not @cleverbrush/orm helpers
