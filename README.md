# Fork After Compaction

Adds one action row under every landed context-compaction marker in the DSH
Chat transcript. The row mirrors the shipped completed-Turn IconActions row —
copy, branch, token usage, clock — without the message-feedback thumbs.

## Why

DSH's shipped branch action on a Turn tail calls the fork API with that Turn's
`turn/end` sequence. A manual `/compact` lands *after* the last completed Turn,
so that cut is the pre-compaction prefix: the child re-opens with the full
history the compaction was supposed to replace. The session-menu **Fork
session** action does reach the latest prefix (a tail compaction included), but
it is not part of the conversation and it always cuts at the current end.

This plugin contributes one extra Chat row anchored on the `compaction/end`
event. Forking there makes the child inherit the compaction transaction and its
landed checkpoint, so the new session starts from the compacted context, right
where the compaction is.

## Behaviour

- One row per successful compaction (automatic or manual), right under the
  compaction marker. Failed compactions contribute nothing.
- **Copy** writes the compaction summary text (the expanded Markdown the marker
  shows) and swaps to a check glyph for a second.
- **Branch** is icon-only, in the same seat the shipped Turn row gives it. It
  uses the Chat view's own fork call, so the child is titled, attached to the
  same workspace, and opened exactly like the built-in branch action. The row is
  hidden when the Peer lacks `session/fork` for the Session.
- **Usage** shows the summarizer call's own `cache-read/uncached-input/output`
  counters with the shipped database glyph. `dsh-statusbar-config` owns that
  format: it rewrites this row's text with the same formatter as the Turn pill
  (see below). Without that plugin the row shows an identical local fallback.
- **Usage dialog** mirrors the shipped Turn-usage dialog: exact total in the
  title, provider/model, cache hit, uncached input, cached input, cache write
  and output. The panel sits above the trigger, clamps inside the viewport,
  tracks scroll/resize, and closes on Escape or an outside click.
- **Reveal rule** matches the shipped rows: only a compaction row at the
  transcript tail stays visible. Once anything follows that compaction (a later
  Turn or message), the row fades in (80ms) on pointer hover or keyboard focus
  like the shipped earlier-message actions. A row stays visible while its
  dialog is open, and devices without hover keep every row visible.
- **Clock** is the compaction-end time in the shipped message-clock format
  (`HH:mm` today, else the localized date template).
- No Host behaviour and no session events: the row is derived from committed
  events, so it survives reloads and log replay.
- The usage pill keeps the shipped narrow-viewport behaviour: below 480px only
  the database glyph remains.

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

## Files

| File | Role |
| --- | --- |
| `client.js` | Browser half: Conversation Node definition plus keyed Chat renderer |
| `index.js` | Host half: empty, the bundle row only activates the client module |
| `cordis.patch.yml` | Loader patch inserting the bundle row |
| `locale/*.json` | Plugin Manager title and description |
| `test/definition.test.js` | Node Definition and renderer checks |

## Limits

- The row forks **at the compaction end**, not at the current transcript tail.
  Anything the source Session produced after that compaction is left out of the
  child, by design.
- The compaction must already be in the loaded transcript page; an older
  compaction that has not been paged in yet shows no row until it loads.
- The dialog reads the usage the `compaction/summary` event reports for the
  summarizer call; that event carries no per-attempt route list or reasoning
  token split, so those two rows are absent.
- Tooltips are native `title` attributes rather than the app's custom tooltip
  bubble: a plugin may not load `dsh-client-ui-primitives`, and copying the
  portal/focus implementation was out of scope for this row.
