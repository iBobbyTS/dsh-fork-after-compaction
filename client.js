/**
 * Browser half: one transcript row under every landed context compaction,
 * mirroring the shipped completed-Turn IconActions row (copy, branch, usage,
 * clock) without the message-feedback thumbs. Like that shipped row, the
 * actions reveal on hover or keyboard focus, and the usage pill opens the same
 * trigger-anchored accounting dialog shape.
 *
 * The shipped branch action on a Turn tail forks at that Turn's `turn/end`,
 * which sits *before* a compaction that landed after the Turn, so the child
 * inherits the pre-compaction history. This row anchors on the compaction
 * itself and calls the Chat view's own `forkAt` with the `compaction/end`
 * sequence, so the child inherits the compacted checkpoint instead.
 *
 * The row is a plain Chat node Definition plus a keyed
 * `conversation.chat.node` renderer: the Conversation layer owns paging,
 * placement and incremental assembly, and the Chat view owns the fork call,
 * access check and child-session navigation. The usage label is published for
 * `dsh-statusbar-config`, which owns the display format for both the shipped
 * Turn pill and this row.
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-fork-after-compaction',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const h = React.createElement;

    /** Locale dictionary namespace registered by this plugin. */
    const NS = 'dshForkAfterCompaction';
    /** Conversation Node kind; the same string keys the Chat renderer Slot. */
    const KIND = 'fork-after-compaction';
    /** The row style tag id. */
    const STYLE_ID = 'dsh-fork-after-compaction';

    const en = {
      'action.copy': 'Copy summary',
      'action.copied': 'Copied',
      'action.fork': 'Fork after compaction',
      'action.forkHint': 'Fork at the end of this compaction. The new session inherits the compacted context, not the history the compaction replaced.',
      'usage.hint': 'Token usage of this compaction\u2019s summarizer call',
      'dialog.title': 'Compaction usage',
      'dialog.model': 'Provider / model',
      'dialog.cacheHit': 'Cache hit',
      'dialog.input': 'Uncached input',
      'dialog.cacheRead': 'Cached input',
      'dialog.cacheWrite': 'Cache write',
      'dialog.output': 'Output',
      'dialog.count': '{count} tok',
      'number.groupSeparator': ',',
      'clock.md': '{m}/{d}',
      'clock.ymd': '{y}-{m}-{d}',
    };

    const zh = {
      'action.copy': '复制摘要',
      'action.copied': '已复制',
      'action.fork': '从压缩点分叉',
      'action.forkHint': '从这次压缩结束处新建会话，继承压缩后的上下文，而不是被这次压缩替换掉的历史。',
      'usage.hint': '本次压缩摘要调用的用量',
      'dialog.title': '压缩用量',
      'dialog.model': '提供方 / 模型',
      'dialog.cacheHit': '缓存命中',
      'dialog.input': '未缓存输入',
      'dialog.cacheRead': '缓存读取',
      'dialog.cacheWrite': '缓存写入',
      'dialog.output': '输出',
      'dialog.count': '{count} tok',
      'number.groupSeparator': ',',
      'clock.md': '{m}月{d}日',
      'clock.ymd': '{y}年{m}月{d}日',
    };

    /** Viewport margin the placement clamp keeps (the shipped menu margin). */
    const PANEL_MARGIN = 12;
    /** Distance between the trigger's top edge and the panel's bottom. */
    const PANEL_GAP = 8;
    /** Unplaced portal panel: hidden but laid out so the clamp measures it. */
    const MEASURE_STYLE = { visibility: 'hidden', left: 0, top: 0 };

    const styles = `
      .dfac-row {
        display: flex;
        align-items: center;
        gap: 8px;
        height: calc(28px + var(--dsh-content-font-delta, 0px));
        margin: 0 0 0 -6px;
      }
      @media (hover: hover) {
        .dfac-row[data-dfac-reveal='hover'] {
          opacity: 0;
          transition: opacity 80ms ease;
        }
        .dfac-row[data-dfac-reveal='hover']:hover,
        .dfac-row[data-dfac-reveal='hover']:focus-within {
          opacity: 1;
        }
        .dfac-row[data-dfac-open='true'] {
          opacity: 1;
        }
      }
      .dfac-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: calc(28px + var(--dsh-content-font-delta, 0px));
        height: calc(28px + var(--dsh-content-font-delta, 0px));
        padding: 6px;
        border: none;
        border-radius: var(--dsw-radius-sm);
        background: transparent;
        color: var(--dsw-alias-label-tertiary);
        cursor: pointer;
      }
      .dfac-action svg {
        width: calc(17px + var(--dsh-content-font-delta, 0px));
        height: calc(17px + var(--dsh-content-font-delta, 0px));
      }
      .dfac-action:hover {
        background: var(--dsw-alias-interactive-bg-hover);
        color: var(--dsw-alias-label-secondary);
      }
      .dfac-action:focus-visible {
        outline: 1px solid var(--dsw-alias-brand-primary);
        outline-offset: 1px;
      }
      .dfac-usage-slot {
        display: inline-flex;
        min-width: 0;
        margin-left: 8px;
      }
      .dfac-usage {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        min-width: 0;
        height: calc(28px + var(--dsh-content-font-delta, 0px));
        padding: 6px 8px;
        border: none;
        border-radius: var(--dsw-radius-sm);
        background: transparent;
        color: var(--dsw-alias-label-tertiary);
        font: inherit;
        font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
        font-variant-numeric: tabular-nums;
        line-height: calc(24px + var(--dsh-content-font-delta, 0px));
        white-space: nowrap;
        cursor: pointer;
      }
      .dfac-usage:hover,
      .dfac-usage[aria-expanded='true'] {
        background: var(--dsw-alias-interactive-bg-hover);
        color: var(--dsw-alias-label-tertiary);
      }
      .dfac-usage:focus-visible {
        outline: 1px solid var(--dsw-alias-brand-primary);
        outline-offset: 1px;
      }
      .dfac-usage svg {
        width: calc(15px + var(--dsh-content-font-delta, 0px));
        height: calc(15px + var(--dsh-content-font-delta, 0px));
        flex: none;
      }
      .dfac-usage-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dfac-time {
        font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
        line-height: calc(24px + var(--dsh-content-font-delta, 0px));
        color: var(--dsw-alias-label-tertiary);
        white-space: nowrap;
      }
      @media (max-width: 480px) {
        .dfac-usage {
          justify-content: center;
          width: calc(28px + var(--dsh-content-font-delta, 0px));
          padding: 6px;
        }
        .dfac-usage-label {
          display: none;
        }
      }
      /* Trigger-anchored accounting dialog: the shipped stat-dialog skin. */
      .dfac-dialog {
        position: fixed;
        z-index: 1100;
        box-sizing: border-box;
        width: max-content;
        min-width: min(300px, calc(100vw - 24px));
        max-width: min(440px, calc(100vw - 24px));
        padding: 16px;
        border: 0;
        border-radius: var(--dsw-radius-lg);
        background: var(--dsw-specific-menu);
        backdrop-filter: var(--dsw-menu-backdrop-filter);
        --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
        box-shadow: var(--dsw-elevation-prominent);
        font-size: 12px;
        line-height: 18px;
        color: var(--dsw-alias-label-secondary);
        cursor: default;
      }
      .dfac-dialog-title {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 8px;
        color: var(--dsw-alias-label-primary);
        font-weight: 500;
      }
      .dfac-dialog-rule {
        margin-bottom: 10px;
        border-top: 0.5px solid var(--dsw-alias-border-l2);
      }
      .dfac-dialog-titleValue {
        font-variant-numeric: tabular-nums;
      }
      .dfac-dialog-titleLabel {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .dfac-dialog-titleLabel svg {
        width: 14px;
        height: 14px;
        flex: none;
      }
      .dfac-dialog-details {
        display: grid;
        grid-template-columns: minmax(76px, auto) minmax(0, 1fr);
        gap: 6px 16px;
        margin: 0;
        color: var(--dsw-alias-label-tertiary);
      }
      .dfac-dialog-details dt,
      .dfac-dialog-details dd {
        min-width: 0;
        margin: 0;
      }
      .dfac-dialog-details dd {
        color: var(--dsw-alias-label-secondary);
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
      .dfac-dialog-route {
        overflow-wrap: anywhere;
      }
    `;

    /** The shipped one-pixel branch glyph. */
    function BranchIcon() {
      return h('svg', {
        viewBox: '0 0 16 16',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true',
        strokeWidth: 1,
      },
        h('path', { d: 'M1.01503 8.0001L5.6964 8.0001C6.41913 8.0001 6.78049 8.0001 7.12115 7.91951C7.4232 7.84804 7.71233 7.73014 7.97821 7.57C8.27809 7.38939 8.5364 7.13669 9.05303 6.63129L11.3281 4.40564', stroke: 'currentColor' }),
        h('path', { d: 'M1.01221 7.9999L5.6964 7.9999C6.41913 7.9999 6.78049 7.9999 7.12115 8.08049C7.4232 8.15196 7.71233 8.26986 7.97821 8.43C8.27809 8.61061 8.5364 8.86331 9.05303 9.36871L11.3281 11.5944', stroke: 'currentColor' }),
        h('circle', { cx: 12.4502, cy: 3.3079, r: 1.56962, stroke: 'currentColor' }),
        h('circle', { cx: 12.4502, cy: 12.6921, r: 1.56962, stroke: 'currentColor' }));
    }

    /** The shipped one-pixel copy glyph. */
    function CopyIcon() {
      return h('svg', {
        viewBox: '0 0 16 16',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true',
        strokeWidth: 1,
      },
        h('rect', { x: 1.52075, y: 4.07373, width: 10.3932, height: 10.3932, rx: 2, stroke: 'currentColor' }),
        h('path', { d: 'M11.9792 1.53296C13.36 1.53296 14.4792 2.65225 14.4792 4.03296V9.42847C14.4792 10.3756 13.9521 11.1987 13.1755 11.6228V10.3298C13.3652 10.0787 13.4792 9.7674 13.4792 9.42847V4.03296C13.4792 3.20453 12.8077 2.53296 11.9792 2.53296H6.58374C6.27966 2.53301 5.99684 2.6235 5.7605 2.77905H4.42358C4.85652 2.03463 5.66056 1.53304 6.58374 1.53296H11.9792Z', fill: 'currentColor' }));
    }

    /** The shipped one-pixel check glyph used after a successful copy. */
    function CheckIcon() {
      return h('svg', {
        viewBox: '0 0 16 16',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true',
        strokeWidth: 1,
      },
        h('path', { d: 'M2.25 8.5L5.49732 11.7473C5.90519 12.1552 6.57263 12.1344 6.95426 11.7018L13.75 4', stroke: 'currentColor' }));
    }

    /** The shipped one-pixel database glyph used by the usage pill. */
    function DatabaseIcon() {
      return h('svg', {
        viewBox: '0 0 16 16',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        'aria-hidden': 'true',
        strokeWidth: 1,
      },
        h('path', { d: 'M13.1967 5.1869C13.7232 4.77378 14.0003 4.30517 14.0001 3.82819C14.0003 3.3512 13.7232 2.88259 13.1967 2.46947C12.6702 2.05635 11.9128 1.71328 11.0006 1.47475C10.0885 1.23621 9.05371 1.11062 8.00039 1.1106C6.94707 1.11057 5.9123 1.23612 5.00009 1.47461C4.08742 1.71301 3.32948 2.05604 2.80249 2.46919C2.2755 2.88235 1.99805 3.35106 1.99805 3.82819C1.99805 4.30531 2.2755 4.77402 2.80249 5.18718C3.32948 5.60033 4.08742 5.94336 5.00009 6.18176C5.9123 6.42025 6.94707 6.5458 8.00039 6.54578C9.05371 6.54575 10.0885 6.42016 11.0006 6.18163C11.9128 5.94309 12.6702 5.60002 13.1967 5.1869Z', stroke: 'currentColor' }),
        h('path', { d: 'M2 3.80371V11.7848', stroke: 'currentColor' }),
        h('path', { d: 'M14 3.80371V11.7848', stroke: 'currentColor' }),
        h('path', { d: 'M2 7.81396C2 8.60524 2.63214 9.36411 3.75736 9.92363C4.88258 10.4832 6.4087 10.7975 8 10.7975C9.5913 10.7975 11.1174 10.4832 12.2426 9.92363C13.3679 9.36411 14 8.60524 14 7.81396', stroke: 'currentColor' }),
        h('path', { d: 'M2 11.7847C2 12.6081 2.63214 13.3977 3.75736 13.98C4.88258 14.5622 6.4087 14.8893 8 14.8893C9.5913 14.8893 11.1174 14.5622 12.2426 13.98C13.3679 13.3977 14 12.6081 14 11.7847', stroke: 'currentColor' }));
    }

    /** Resolve one assembled Context's best currently loaded event Location. */
    function contextLocation(context) {
      return (context.start && context.start.location)
        ?? (context.matches[0] && context.matches[0].location)
        ?? { kind: 'unresolved' };
    }

    /** Return a Context's last Match for one event type, when loaded. */
    function matchOf(context, type) {
      let found;
      for (const match of context.matches) {
        if (match.event.type === type) found = match;
      }
      return found;
    }

    /** Plain text of a `compaction/summary` payload, or null. */
    function summaryText(event) {
      const blocks = event.data.summary;
      if (!Array.isArray(blocks)) return null;
      const text = blocks.map(block => (block && block.type === 'text' ? block.text : '')).join('').trim();
      return text === '' ? null : text;
    }

    /** Provider usage of a summarizer call as token buckets, or null. */
    function summaryUsage(event) {
      const raw = event.data.usage;
      if (raw === null || typeof raw !== 'object') return null;
      const input = raw.inputTokens;
      const read = raw.cacheReadTokens;
      const output = raw.outputTokens;
      if (!Number.isSafeInteger(input) || !Number.isSafeInteger(read) || !Number.isSafeInteger(output)) return null;
      const write = raw.cacheWriteTokens;
      const usage = {
        cacheReadTokens: read,
        uncachedInputTokens: input,
        outputTokens: output,
        totalTokens: Number.isSafeInteger(raw.totalTokens)
          ? raw.totalTokens
          : input + read + (Number.isSafeInteger(write) ? write : 0) + output,
      };
      if (Number.isSafeInteger(write)) usage.cacheWriteTokens = write;
      return usage;
    }

    /** Non-empty string field of a payload, or null. */
    function textField(value) {
      return typeof value === 'string' && value !== '' ? value : null;
    }

    /** Compact token count: 517 / 12.2K / 517K / 1.2M. */
    function formatTokens(value) {
      const scaled = candidate => candidate >= 100
        ? String(Math.round(candidate))
        : String(Math.round(candidate * 10) / 10);
      if (value < 1000) return String(value);
      if (value < 1000000) return scaled(value / 1000) + 'K';
      return scaled(value / 1000000) + 'M';
    }

    /** Exact integer token count with locale-owned digit grouping. */
    function formatExactTokens(value, t) {
      const digits = String(value);
      const groups = [];
      for (let end = digits.length; end > 0; end -= 3) {
        groups.unshift(digits.slice(Math.max(0, end - 3), end));
      }
      return groups.join(t('number.groupSeparator'));
    }

    /** Exact count with the shipped `tok` unit. */
    function exactCount(value, t) {
      return t('dialog.count', { count: formatExactTokens(value, t) });
    }

    /** `cache-read/uncached-input/output` for one summarizer call, or null. */
    function usageLabel(usage) {
      if (usage === null) return null;
      return [
        formatTokens(usage.cacheReadTokens),
        formatTokens(usage.uncachedInputTokens),
        formatTokens(usage.outputTokens),
      ].join('/');
    }

    /** Round a cache-read ratio to exact percentage units, positive ties up. */
    function roundedPercentUnits(cacheReadTokens, denominator, decimalPlaces) {
      const unitsPerPercent = decimalPlaces === 0 ? 1 : 10;
      const scale = unitsPerPercent * 100;
      const doubledScale = scale * 2;
      const denominatorQuotient = Math.floor(denominator / doubledScale);
      const denominatorRemainder = denominator % doubledScale;
      let lower = 0;
      let upper = scale;
      while (lower < upper) {
        const candidate = Math.floor((lower + upper + 1) / 2);
        const factor = candidate * 2 - 1;
        const threshold = factor * denominatorQuotient
          + Math.ceil(factor * denominatorRemainder / doubledScale);
        if (cacheReadTokens >= threshold) lower = candidate;
        else upper = candidate - 1;
      }
      return lower;
    }

    /** Render exact percentage units with optional tenths. */
    function displayPercentUnits(units, decimalPlaces) {
      if (decimalPlaces === 0) return String(units);
      const whole = Math.floor(units / 10);
      const tenths = units % 10;
      return tenths === 0 ? String(whole) : whole + '.' + tenths;
    }

    /** Honest cache-hit percentage that never rounds a partial hit to 100. */
    function formatCacheHitPercent(cacheReadTokens, promptTokens, decimalPlaces) {
      if (promptTokens === 0) return null;
      const missedInputTokens = promptTokens - cacheReadTokens;
      if (missedInputTokens === 0) return '100';
      const roundedUnits = roundedPercentUnits(cacheReadTokens, promptTokens, decimalPlaces);
      const fullHitUnits = decimalPlaces === 0 ? 100 : 1000;
      if (roundedUnits < fullHitUnits) return displayPercentUnits(roundedUnits, decimalPlaces);
      let distinguishingPlaces = 1;
      let scaledDoubleGap = missedInputTokens * 200;
      const denominatorTens = Math.floor(promptTokens / 10);
      while (scaledDoubleGap <= denominatorTens) {
        scaledDoubleGap *= 10;
        distinguishingPlaces += 1;
      }
      const denominatorOnes = promptTokens % 10;
      let roundedLoss = 5;
      for (let loss = 1; loss < 5; loss += 1) {
        const factor = loss * 2 + 1;
        const threshold = factor * denominatorTens + Math.floor(factor * denominatorOnes / 10);
        if (scaledDoubleGap <= threshold) {
          roundedLoss = loss;
          break;
        }
      }
      return '99.' + '9'.repeat(distinguishingPlaces - 1) + (10 - roundedLoss);
    }

    /** Build the visible row after one completed compaction, or nothing. */
    function buildViewNode(context) {
      const end = matchOf(context, 'compaction/end');
      if (end === undefined || end.event.data.error !== undefined) return null;
      const summary = matchOf(context, 'compaction/summary');
      return {
        key: context.key,
        kind: KIND,
        id: context.id,
        target: 'chat',
        anchorSeq: end.event.seq + 0.1,
        location: contextLocation(context),
        visibility: 'visible',
        data: {
          seq: end.event.seq,
          time: end.event.time,
          summarySeq: summary === undefined ? null : summary.event.seq,
          provider: summary === undefined ? null : textField(summary.event.data.provider),
          model: summary === undefined ? null : textField(summary.event.data.model),
          summaryText: summary === undefined ? null : summaryText(summary.event),
          usage: summary === undefined ? null : summaryUsage(summary.event),
        },
      };
    }

    /**
     * One compaction lifecycle becomes one action row. Grouping by
     * `compactionId` keeps the row stable while an automatic compaction runs,
     * and a failed compaction contributes no row.
     */
    const definition = {
      kind: KIND,
      target: 'chat',
      match: {
        'compaction/start': (event) => {
          const id = event.data.compactionId;
          return typeof id === 'string' && id !== '' ? { id, role: 'start' } : null;
        },
        'compaction/summary': (event) => {
          const id = event.data.compactionId;
          return typeof id === 'string' && id !== '' ? { id, role: 'update' } : null;
        },
        'compaction/end': (event) => {
          const id = event.data.compactionId;
          return typeof id === 'string' && id !== '' ? { id, role: 'update' } : null;
        },
      },
      start: () => ({}),
      update: (context, match) => match.event.type === 'compaction/end'
        ? { ...context.state, end: match }
        : context.state,
      buildViewNode,
    };

    /** Local midnight epoch, advanced at each local midnight like the clock. */
    function useCalendarDay() {
      const [day, setDay] = React.useState(() => {
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        return midnight.getTime();
      });
      React.useEffect(() => {
        let timer;
        const arm = () => {
          const now = Date.now();
          const midnight = new Date(now);
          midnight.setHours(0, 0, 0, 0);
          setDay(midnight.getTime());
          const next = new Date(now);
          next.setHours(24, 0, 0, 0);
          timer = setTimeout(arm, Math.max(next.getTime() - now, 1));
        };
        timer = setTimeout(arm, (() => {
          const now = Date.now();
          const next = new Date(now);
          next.setHours(24, 0, 0, 0);
          return Math.max(next.getTime() - now, 1);
        })());
        return () => { clearTimeout(timer); };
      }, []);
      return day;
    }

    /** Compact local timestamp: same day `HH:mm`, else the locale date template. */
    function formatClock(time, t, day) {
      const date = new Date(time);
      const reference = new Date(day);
      const pad = value => String(value).padStart(2, '0');
      const clock = pad(date.getHours()) + ':' + pad(date.getMinutes());
      if (date.getFullYear() === reference.getFullYear()
        && date.getMonth() === reference.getMonth()
        && date.getDate() === reference.getDate()) return clock;
      const params = { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
      const template = date.getFullYear() === reference.getFullYear()
        ? t('clock.md', params)
        : t('clock.ymd', params);
      return template + ' ' + clock;
    }

    /** Write text through the browser clipboard API. */
    async function writeClipboard(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {
        // A refused clipboard write leaves the copy action unchanged.
      }
      return false;
    }

    /** Top margin an overlay keeps from the viewport edge. */
    function overlayTopMargin(margin) {
      const root = document.documentElement;
      const clearance = Number.parseFloat(getComputedStyle(root).getPropertyValue('--dsh-frame-top-clearance'));
      if (Number.isNaN(clearance)) return margin;
      return Math.max(margin, (root.hasAttribute('data-fullscreen') ? 0 : clearance) + 20);
    }

    /** Track the trigger and return the panel's viewport-clamped fixed point. */
    function useAnchoredPosition(options) {
      const { open, anchorRef, panelRef, side, align, gap, margin } = options;
      const [position, setPosition] = React.useState(null);
      React.useLayoutEffect(() => {
        if (!open) {
          setPosition(null);
          return;
        }
        const place = () => {
          const rect = anchorRef.current?.getBoundingClientRect();
          if (rect === undefined) return;
          const panel = panelRef.current;
          const width = panel?.offsetWidth ?? 0;
          const height = panel?.offsetHeight ?? 0;
          let left = align === 'end' ? rect.right - width : rect.left;
          let top = side === 'top' ? rect.top - gap - height : rect.bottom + gap;
          if (width > 0) left = Math.min(Math.max(left, margin), window.innerWidth - width - margin);
          if (height > 0) top = Math.min(Math.max(top, overlayTopMargin(margin)), window.innerHeight - height - margin);
          setPosition({ left, top });
        };
        place();
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
        const panel = panelRef.current;
        let observer = null;
        if (typeof ResizeObserver !== 'undefined' && panel !== null) {
          observer = new ResizeObserver(place);
          observer.observe(panel);
        }
        return () => {
          observer?.disconnect();
          window.removeEventListener('scroll', place, true);
          window.removeEventListener('resize', place);
        };
      }, [open, anchorRef, panelRef, side, align, gap, margin]);
      return position;
    }

    /** Close an open dialog when a pointerdown lands outside trigger and panel. */
    function useDismissOnOutsidePointer(root, open, setOpen, portal) {
      React.useEffect(() => {
        if (!open) return;
        const closeOutside = (event) => {
          if (event.target instanceof Node
            && root.current?.contains(event.target) !== true
            && portal?.current?.contains(event.target) !== true) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOutside);
        return () => { document.removeEventListener('pointerdown', closeOutside); };
      }, [root, open, setOpen, portal]);
    }

    /** Open state, refs, and clamped placement for the usage dialog. */
    function useUsageDialog() {
      const [open, setOpen] = React.useState(false);
      const rootRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const pos = useAnchoredPosition({
        open,
        anchorRef: rootRef,
        panelRef,
        side: 'top',
        align: 'start',
        gap: PANEL_GAP,
        margin: PANEL_MARGIN,
      });
      useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef);
      React.useEffect(() => {
        if (!open) return;
        const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
        const onClick = (e) => {
          if (e.target instanceof Node
            && rootRef.current?.contains(e.target) !== true
            && panelRef.current?.contains(e.target) !== true) {
            setOpen(false);
          }
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('click', onClick, true);
        return () => {
          document.removeEventListener('keydown', onKeyDown);
          document.removeEventListener('click', onClick, true);
        };
      }, [open, setOpen, rootRef, panelRef]);
      return { open, setOpen, rootRef, panelRef, pos };
    }

    /** The accounting dialog: totals, provider route, cache hit, and buckets. */
    function CompactionUsageDialog({ usage, provider, model, t, panelRef, pos }) {
      const promptTokens = usage.totalTokens - usage.outputTokens;
      const cacheHit = usage.cacheReadTokens === undefined
        ? null
        : formatCacheHitPercent(usage.cacheReadTokens, promptTokens, 1);
      const rows = [];
      if (provider !== null && model !== null) {
        rows.push(h('dt', { key: 'model' }, t('dialog.model')));
        rows.push(h('dd', { key: 'modelValue', className: 'dfac-dialog-route' }, provider + '/' + model));
      }
      if (cacheHit !== null) {
        rows.push(h('dt', { key: 'cacheHit' }, t('dialog.cacheHit')));
        rows.push(h('dd', { key: 'cacheHitValue' }, cacheHit + '%'));
      }
      rows.push(h('dt', { key: 'input' }, t('dialog.input')));
      rows.push(h('dd', { key: 'inputValue' }, exactCount(usage.uncachedInputTokens, t)));
      if (usage.cacheReadTokens !== undefined) {
        rows.push(h('dt', { key: 'cacheRead' }, t('dialog.cacheRead')));
        rows.push(h('dd', { key: 'cacheReadValue' }, exactCount(usage.cacheReadTokens, t)));
      }
      if (usage.cacheWriteTokens !== undefined) {
        rows.push(h('dt', { key: 'cacheWrite' }, t('dialog.cacheWrite')));
        rows.push(h('dd', { key: 'cacheWriteValue' }, exactCount(usage.cacheWriteTokens, t)));
      }
      rows.push(h('dt', { key: 'output' }, t('dialog.output')));
      rows.push(h('dd', { key: 'outputValue' }, exactCount(usage.outputTokens, t)));
      return h('div', {
        ref: panelRef,
        className: 'dfac-dialog',
        role: 'dialog',
        'aria-label': t('dialog.title'),
        style: pos === null ? MEASURE_STYLE : pos,
      },
      h('div', { className: 'dfac-dialog-title' },
        h('span', { className: 'dfac-dialog-titleLabel' }, h(DatabaseIcon, null), t('dialog.title')),
        h('span', { className: 'dfac-dialog-titleValue' }, exactCount(usage.totalTokens, t))),
      h('div', { className: 'dfac-dialog-rule', 'aria-hidden': 'true' }),
      h('dl', { className: 'dfac-dialog-details' }, ...rows));
    }

    /**
     * The action row: copy the compaction summary, fork at the compaction end,
     * open the summarizer usage dialog, and show the time.
     */
    function ForkAfterCompactionView(props) {
      const { node, forkAt, t } = props;
      const useAccess = props.useAccess;
      const data = node.data;
      const selectChat = typeof props.useChat === 'function' ? props.useChat : () => true;
      const rowRef = React.useRef(null);
      const day = useCalendarDay();
      const [copied, setCopied] = React.useState(false);
      const copyTimer = React.useRef(null);
      React.useEffect(() => () => {
        if (copyTimer.current !== null) clearTimeout(copyTimer.current);
      }, []);
      const copy = React.useCallback(() => {
        if (data.summaryText === null || copied) return;
        void writeClipboard(data.summaryText).then((ok) => {
          if (!ok) return;
          setCopied(true);
          copyTimer.current = setTimeout(() => {
            copyTimer.current = null;
            setCopied(false);
          }, 1000);
        });
      }, [data.summaryText, copied]);
      const dialog = useUsageDialog();
      React.useEffect(() => {
        const row = rowRef.current;
        const usage = row === null ? null : row.querySelector('[data-dfac-usage]');
        if (usage === null) return;
        usage.dispatchEvent(new CustomEvent('dsh-fork-row-usage', { bubbles: true }));
      }, [node.data.summarySeq]);
      // The shipped rows keep only the transcript tail's actions visible and
      // reveal every earlier row on hover; this row does the same, so a
      // compaction followed by later Turns goes back to hover-only.
      const isTail = selectChat((snapshot) => {
        let latest = -Infinity;
        for (const candidate of snapshot.nodes.values()) {
          if (candidate.visibility !== 'visible') continue;
          if (candidate.anchorSeq > latest) latest = candidate.anchorSeq;
        }
        return latest <= node.anchorSeq + 1e-6;
      });
      const allowed = typeof useAccess === 'function' ? useAccess('session/fork') : true;
      if (!allowed || typeof forkAt !== 'function') return null;
      const label = usageLabel(data.usage);
      return h('div', {
        ref: rowRef,
        className: 'dfac-row',
        'data-dfac-fork-row': String(data.seq),
        'data-dfac-reveal': isTail ? 'always' : 'hover',
        ...dialog.open ? { 'data-dfac-open': 'true' } : {},
      },
      data.summaryText === null ? null : h('button', {
        type: 'button',
        className: 'dfac-action',
        title: copied ? t('action.copied') : t('action.copy'),
        'aria-label': copied ? t('action.copied') : t('action.copy'),
        onClick: copy,
      }, copied ? h(CheckIcon, null) : h(CopyIcon, null)),
      h('button', {
        type: 'button',
        className: 'dfac-action',
        title: t('action.forkHint'),
        'aria-label': t('action.fork'),
        onClick: () => { forkAt(data.seq) },
      }, h(BranchIcon, null)),
      label === null ? null : h('span', { className: 'dfac-usage-slot', ref: dialog.rootRef },
        h('button', {
          type: 'button',
          className: 'dfac-usage',
          'data-dfac-usage': String(data.summarySeq),
          'data-dfac-cache-read': String(data.usage.cacheReadTokens),
          'data-dfac-uncached-input': String(data.usage.uncachedInputTokens),
          'data-dfac-output': String(data.usage.outputTokens),
          title: t('usage.hint'),
          'aria-label': t('dialog.title'),
          'aria-haspopup': 'dialog',
          'aria-expanded': dialog.open,
          onClick: () => { dialog.setOpen(!dialog.open) },
        },
        h(DatabaseIcon, null),
        h('span', { className: 'dfac-usage-label', 'data-dfac-usage-label': '' }, label)),
        dialog.open
          ? createPortal(h(CompactionUsageDialog, {
            usage: data.usage,
            provider: data.provider,
            model: data.model,
            t,
            panelRef: dialog.panelRef,
            pos: dialog.pos,
          }), document.body)
          : null),
      h('span', { className: 'dfac-time' }, formatClock(data.time, t, day)));
    }

    /** Install the row stylesheet for this plugin's lifetime. */
    function installStyles() {
      document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')?.remove();
      const tag = document.createElement('style');
      tag.dataset.plugin = '@local/dsh-fork-after-compaction';
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = styles;
      document.head.append(tag);
      return () => tag.remove();
    }

    return {
      inject: ['slots', 'locale', 'uiConversation'],
      apply(ctx) {
        ctx.effect(installStyles, 'dsh-fork-after-compaction: styles');
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-fork-after-compaction: locale');
        ctx.effect(
          () => ctx.uiConversation.events.register(definition),
          'dsh-fork-after-compaction: node',
        );
        ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
          name: 'conversation.chat.node',
          key: KIND,
          locale: NS,
        }, ForkAfterCompactionView));
      },
    };
  },
});
