# Xpenser - Learnings

## Completion Status: ALL TASKS COMPLETE (44/44)
- 40 implementation + 4 verification = 44 total
- `npm run build` PASSES for both packages

## Key Build Fixes
1. Next.js 16 uses `proxy.ts` not `middleware.ts` (deprecated warning)
2. `@cleverbrush/schema` v4.2.0: use `object()` wrapper, `array()` function, NOT `.array()` method
3. `.email()`, `.oneOf()`, `.nonempty()`, `.length()` available but not used in contract for safety
4. Next.js 16: `cookies()` is async - must `await cookies()`
5. `@cleverbrush/client`: uses `getToken` callback for auth, not per-call headers
6. Server actions in Next.js 16 must return `void` or `Promise<void>`
7. `revalidateTag(tag, {})` takes 2 args in Next.js 16
8. Framework's `ServerBuilder.listen()` returns a `Server` with `.close(): Promise<void>`
9. `.authorize('user')` not `.authorize({})` for endpoint authorization

## Final Verification Results
- F1: Plan Compliance → APPROVE (Must Have 10/10, Must NOT Have 11/11)
- F2: Code Quality → APPROVE (Zero as any, @ts-ignore, console.log)
- F3: Manual QA → APPROVE (Structural verification passed)
- F4: Scope Fidelity → APPROVE (Zero scope creep, 40/40 tasks matched)
