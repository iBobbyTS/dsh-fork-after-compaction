# Fork After Compaction

[English](README.md) | [简体中文](README.zh.md)

Adds an action row below each successful DSH context compaction: copy its summary, fork at that compaction, view summarizer token usage, and show its completion time.

The ordinary Turn-tail branch action cuts at `turn/end`, which can precede a manual compaction. This plugin forks at `compaction/end`, so the new session inherits the compacted checkpoint. Content produced after that compaction is intentionally excluded.

## Compatibility

Verified: DSH 0.2.2-rc.1 (source review and automated checks); Desktop testing has not been completed.

## Install

For Desktop, launch the app once, quit it, and run the command below with its bundled CLI.

Use a checkout of this repository and Node.js 22 or later. Replace the absolute path with your checkout path:

```sh
dsh plugin --profile desktop add "link:/absolute/path/to/dsh-fork-after-compaction"
```

Use `web` instead of `desktop` for a standalone Web profile. Restart the corresponding DSH process and reload its UI. This private `@local/dsh-fork-after-compaction` bundle is installed from the checkout, rather than a published npm package.

## Use and limits

- Failed or still-running compactions have no action row. Older compactions appear when their transcript page is loaded.
- The row uses DSH's own fork action and is hidden without `session/fork` access.
- Usage shows the summarizer's cache-read / uncached-input / output buckets. Both input and output must be valid for a usage pill; an omitted cache bucket counts as zero. The dialog can also show reported cache-write usage.
- `dsh-statusbar-config` can format the usage label; without it, the row supplies its own fallback.
- The row and dialog follow native hover, keyboard, clock and narrow-screen behavior. The plugin derives them from committed events and does not write session events.

[Development and statusbar integration](docs/DEVELOPMENT.md)
