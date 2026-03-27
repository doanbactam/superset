# @superset/agent-runtime

Abstracts agent runtime implementations (mastracode, codex, etc.) to allow swapping implementations without changing consuming code.

## Purpose

This package provides a thin abstraction layer over agent runtime libraries. Currently, the codebase imports directly from `mastracode`. By routing through this package, we can:

1. Swap to a different runtime (codex, opencode, etc.) by changing this package only
2. Test consuming code without a real runtime
3. Keep runtime-specific types out of application code

## Status

**Sprint 2**: Stubs only. Factory functions throw `not implemented`. Types are defined for migration.

## Next Steps

1. Implement `createAuthStorage` using mastracode under the hood
2. Implement `createMastraCode` using mastracode under the hood
3. Update consuming code to import from `@superset/agent-runtime` instead of `mastracode`
4. Add tests for the abstraction layer
