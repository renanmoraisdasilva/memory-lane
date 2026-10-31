# Quality exceptions

The default limits are defined in
`docs/Memory_Lane_Scope_and_Implementation.md`, section 6. They are enforced in
CI.

An exception is allowed only when:

1. The rule cannot be satisfied without harming clarity or correctness.
2. The disable is narrow (`eslint-disable-next-line`, not a file-level disable).
3. The reason is written next to the disable and in the pull request.
4. A reviewer approves the exception.
5. The exception is recorded below with an owner and an expiry date.

## Active exceptions

None.

## Record template

| Date | File | Rule | Reason | Owner | Expires |
|---|---|---|---|---|---|
| YYYY-MM-DD | `path/to/file.ts` | `max-lines` | Why the limit cannot be met | Name | YYYY-MM-DD |
