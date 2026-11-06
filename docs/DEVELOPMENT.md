# Fork after compaction: development

[User guide](../README.md) · [中文入口](../README.zh.md)

## Rendering and ownership

The Conversation Node groups a compaction lifecycle by `compactionId`, contributes a row only after a successful `compaction/end`, and anchors it immediately after that event. The Chat view owns the actual fork, access check and child navigation; the plugin passes the compaction-end sequence to `forkAt`.

Copy uses the loaded `compaction/summary` text. The usage dialog reads the same summary event; it cannot display per-attempt routes or reasoning-token splits that the event does not contain. A missing summary leaves the fork action available without summary-dependent controls.

A row at the transcript tail stays visible. Earlier rows reveal on hover or keyboard focus, remain visible while their dialog is open, and stay visible on devices without hover. Below 480px, only the usage glyph remains. Tooltips use native `title` attributes.

## dsh-statusbar-config integration

DSH ships no standalone usage component or Slot for this row, so the row
publishes its buckets for the statusbar plugin to format:

| Contract | Direction | Meaning |
| --- | --- | --- |
| `data-dfac-usage` | this plugin sets | the `compaction/summary` event seq |
| `data-dfac-cache-read`, `data-dfac-uncached-input`, `data-dfac-output` | this plugin sets | the summarizer's raw buckets |
| `data-dfac-usage-label` | this plugin sets | the fallback label element the statusbar CSS hides |
| `dsh-fork-row-usage` (bubbling) | this plugin dispatches on mount | tells the statusbar plugin to (re)format this row |
| `data-dsc-fork-row-usage`, `--dsc-fork-row-usage-label` | statusbar sets | marks the pill and carries the formatted text |

`dsh-statusbar-config` scans once on mount and listens for the event, so rows
rendered before it activates are covered too.

The formatter must stay within the owning conversation. Event sequence values are local to a session and must not be treated as globally unique across open or forked conversations.

## Files

| File | Role |
| --- | --- |
| `src/client.ts` | Browser half: Conversation Node definition plus keyed Chat renderer |
| `src/index.ts` | Host half: empty, the bundle row only activates the client module |
| `cordis.patch.yml` | Loader patch inserting the bundle row |
| `locale/*.json` | Plugin Manager title and description |
| `test/definition.test.js` | Node Definition and renderer checks |

## Verification

From the repository root:

```sh
pnpm test
```

These tests use a browser-module harness to check node assembly, the fork sequence, usage and dialog rendering. For a DSH upgrade, compare the Conversation Node, Chat renderer, fork/access and primitive contracts in the target source. Rendering or interaction changes also require the relevant real UI check; source and harness results alone do not establish Desktop behavior.

## Build and distribution checks

Use Node 24.11.0 and the `packageManager` pnpm version for maintenance. `pnpm install --frozen-lockfile` prepares development dependencies. `pnpm typecheck` checks Host and Client separately; `pnpm build:runtime` refreshes generated `lib/`; `pnpm test` builds an isolated candidate before testing; `pnpm check:dist` independently rebuilds and compares all artifacts, then packs and tests clean tarball/Git installation. `pnpm check` combines these with one candidate build. Installation uses prebuilt JS; it runs no plugin compiler lifecycle hook.

Automated/source checks target DSH 0.2.2-rc.1. Desktop interaction and real user accounts remain separate validation.
