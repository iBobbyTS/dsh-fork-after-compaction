/**
 * Behaviour checks for the compaction-anchored action row. The browser half is
 * a plain module-loader artifact, so the test loads it the way the Web client
 * does and drives the Definition and renderer with fabricated events.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const createElement = (type, props, ...children) => ({ type, props: { ...props, children } })

/**
 * Minimal React surface the artifact uses while rendering one row. Hook state
 * survives re-renders so a click can open the usage dialog, exactly like React.
 */
const hookStates = []
const hookRefs = []
let hookIndex = 0

const fakeReact = {
  createElement,
  useState(initial) {
    const index = hookIndex++
    if (!(index in hookStates)) hookStates[index] = typeof initial === 'function' ? initial() : initial
    return [hookStates[index], (next) => {
      hookStates[index] = typeof next === 'function' ? next(hookStates[index]) : next
    }]
  },
  useRef() {
    const index = hookIndex++
    if (!(index in hookRefs)) hookRefs[index] = { current: null }
    return hookRefs[index]
  },
  useEffect() { hookIndex++ },
  useLayoutEffect() { hookIndex++ },
  useCallback(callback) { hookIndex++; return callback },
}

const fakeReactDom = { createPortal: (node) => node }

/** Forget every hook cell before a fresh mount. */
function resetHooks() {
  hookStates.length = 0
  hookRefs.length = 0
  hookIndex = 0
}

/**
 * Load the browser artifact through a stand-in module loader.
 * @returns the plugin module the artifact factory returned.
 */
function loadPlugin() {
  let module
  const window = {
    __ModuleLoader__: {
      load(spec) {
        assert.equal(spec.id, '@local/dsh-fork-after-compaction')
        module = spec.factory((name) => {
          if (name === 'react') return fakeReact
          assert.equal(name, 'react-dom')
          return fakeReactDom
        })
      },
    },
  }
  const document = {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    head: { append() {} },
    body: {},
  }
  const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  new Function('window', 'document', source)(window, document)
  assert.ok(module !== undefined, 'artifact factory must return the plugin module')
  return module
}

let loaded

/** Mount the plugin into a stand-in client context and capture registrations. */
function mount() {
  loaded ??= loadPlugin()
  const captured = {}
  loaded.apply({
    effect: (factory) => { factory() },
    locale: { register: () => () => {} },
    uiConversation: {
      events: { register: (definition) => { captured.definition = definition; return () => {} } },
    },
    slots: {
      inject: (_name, callback) => { callback() },
      register: (options, component) => { captured.renderer = { options, component }; return {} },
    },
  })
  return captured
}

/** Replay events into the Definition's State and build its node. */
function nodeFor(definition, events) {
  const matches = []
  let state
  for (const event of events) {
    const result = definition.match[event.type]?.(event) ?? null
    if (result === null) continue
    const entry = { event, role: result.role, location: { kind: 'session' } }
    matches.push(entry)
    if (result.role === 'start') state = definition.start({ matches }, entry)
    else if (state !== undefined) state = definition.update({ state, matches }, entry)
  }
  const first = matches[0]
  return definition.buildViewNode({
    key: `5:${definition.kind}${first.event.data.compactionId}`,
    kind: definition.kind,
    id: first.event.data.compactionId,
    matches,
    start: matches.find(entry => entry.role === 'start'),
    state,
    current: new Map(),
  })
}

const startEvent = (seq, compactionId) => ({
  type: 'compaction/start',
  seq,
  time: 1_000,
  data: { compactionId, sourceCommandId: 'cmd-1', turn: null },
})

const summaryEvent = (seq, compactionId) => ({
  type: 'compaction/summary',
  seq,
  time: 2_000,
  data: {
    compactionId,
    sourceCommandId: 'cmd-1',
    summary: [{ type: 'text', text: '## Primary Request\n- keep this' }],
    shadowedSeqs: [],
    shadowedTokenCount: 1_000,
    provider: 'deepseek-official',
    model: 'deepseek-flash',
    usage: {
      inputTokens: 445,
      outputTokens: 3_029,
      cacheReadTokens: 202_880,
      cacheWriteTokens: 0,
      totalTokens: 206_354,
    },
  },
})

const endEvent = (seq, compactionId) => ({
  type: 'compaction/end',
  seq,
  time: 3_000,
  data: { compactionId, sourceCommandId: 'cmd-1', turn: null },
})

const trans = (key, params = {}) => {
  if (key === 'number.groupSeparator') return ','
  if (key === 'dialog.count') return `${params.count} tok`
  if (key === 'clock.md') return `${params.m}/${params.d}`
  if (key === 'clock.ymd') return `${params.y}-${params.m}-${params.d}`
  return key
}

/** Flatten a rendered element tree, rendering function components. */
function elements(node) {
  if (node === null || node === undefined || typeof node !== 'object') return []
  if (typeof node.type === 'function') return elements(node.type(node.props))
  return [node, ...(node.props?.children ?? []).flatMap(child => elements(child))]
}

/** Render the row once with the current hook state. */
function render(renderer, props) {
  hookIndex = 0
  return renderer.component(props)
}

/** Chat snapshot stub exposing the rows that decide "latest". */
const chatWith = (nodes) => ({
  useChat: (selector) => selector({ nodes: { values: () => nodes } }),
})

const rowProps = (overrides = {}) => ({
  ...chatWith([
    { kind: 'fork-after-compaction', anchorSeq: 2_055.1, visibility: 'visible' },
    { kind: 'turn-tail', anchorSeq: 1_900.1, visibility: 'visible' },
  ]),
  node: {
    anchorSeq: 2_055.1,
    data: {
      seq: 2_055,
      time: Date.now(),
      summarySeq: 2_053,
      provider: 'deepseek-official',
      model: 'deepseek-flash',
      summaryText: 'summary',
      usage: {
        cacheReadTokens: 202_880,
        uncachedInputTokens: 445,
        cacheWriteTokens: 0,
        outputTokens: 3_029,
        totalTokens: 206_354,
      },
    },
  },
  forkAt: () => {},
  useAccess: () => true,
  t: trans,
  ...overrides,
})

test('one completed compaction becomes one action row at compaction/end', () => {
  const { definition } = mount()
  const node = nodeFor(definition, [startEvent(10, 'c-1'), summaryEvent(11, 'c-1'), endEvent(13, 'c-1')])
  assert.equal(node.kind, 'fork-after-compaction')
  assert.equal(node.target, 'chat')
  assert.equal(node.visibility, 'visible')
  assert.deepEqual(node.data, {
    seq: 13,
    time: 3_000,
    summarySeq: 11,
    provider: 'deepseek-official',
    model: 'deepseek-flash',
    summaryText: '## Primary Request\n- keep this',
    usage: {
      cacheReadTokens: 202_880,
      uncachedInputTokens: 445,
      cacheWriteTokens: 0,
      outputTokens: 3_029,
      totalTokens: 206_354,
    },
  })
  assert.ok(node.anchorSeq > 13 && node.anchorSeq < 14, 'the row anchors after the compaction end')
})

test('a still-running compaction contributes no row', () => {
  const { definition } = mount()
  assert.equal(nodeFor(definition, [startEvent(10, 'c-1'), summaryEvent(11, 'c-1')]), null)
})

test('a failed compaction contributes no row', () => {
  const { definition } = mount()
  const failed = { ...endEvent(13, 'c-1'), data: { compactionId: 'c-1', error: { name: 'Error', message: 'boom' } } }
  assert.equal(nodeFor(definition, [startEvent(10, 'c-1'), summaryEvent(11, 'c-1'), failed]), null)
})

test('a tail window without the start event still yields the row', () => {
  const { definition } = mount()
  const node = nodeFor(definition, [summaryEvent(11, 'c-1'), endEvent(13, 'c-1')])
  assert.equal(node?.data.seq, 13)
})

test('the row forks at its compaction/end sequence and carries no text label', () => {
  resetHooks()
  const { renderer } = mount()
  assert.equal(renderer.options.key, 'fork-after-compaction')
  const forks = []
  const tree = render(renderer, rowProps({ forkAt: (seq) => { forks.push(seq) } }))
  const all = elements(tree)
  const buttons = all.filter(element => element.type === 'button')
  assert.equal(buttons.length, 3, 'copy, fork, and usage share the row')
  assert.equal(tree.props['data-dfac-fork-row'], '2055')
  assert.equal(tree.props['data-dfac-reveal'], 'always', 'a compaction at the transcript tail stays visible')
  assert.equal(buttons[1].props['aria-label'], 'action.fork')
  buttons[1].props.onClick()
  assert.deepEqual(forks, [2055])
  const usage = all.find(element => element.props && element.props['data-dfac-usage'] !== undefined)
  assert.equal(usage.props['data-dfac-usage'], '2053')
  assert.equal(usage.props['data-dfac-cache-read'], '202880')
  assert.equal(usage.props['data-dfac-uncached-input'], '445')
  assert.equal(usage.props['data-dfac-output'], '3029')
  assert.equal(usage.props['aria-haspopup'], 'dialog')
  assert.equal(usage.props['aria-expanded'], false)
  const text = all.filter(element => typeof element.props?.children?.[0] === 'string')
  assert.ok(text.some(element => element.props.children[0] === '203K/445/3K'))
  assert.ok(all.some(element => element.props && element.props['data-dfac-usage-label'] === ''))
})

test('the row stays hidden without session/fork access', () => {
  resetHooks()
  const { renderer } = mount()
  assert.equal(render(renderer, rowProps({
    node: { data: { seq: 13, time: 0, summarySeq: null, provider: null, model: null, summaryText: null, usage: null } },
    useAccess: () => false,
  })), null)
})

test('a row without a loaded summary keeps only the fork action', () => {
  resetHooks()
  const { renderer } = mount()
  const tree = render(renderer, rowProps({
    node: { data: { seq: 13, time: 0, summarySeq: null, provider: null, model: null, summaryText: null, usage: null } },
  }))
  const all = elements(tree)
  assert.equal(all.filter(element => element.type === 'button').length, 1)
  assert.equal(all.find(element => element.props && element.props['data-dfac-usage'] !== undefined), undefined)
})

test('the usage pill opens the shipped-shaped accounting dialog', () => {
  resetHooks()
  const { renderer } = mount()
  const first = render(renderer, rowProps())
  const trigger = elements(first).find(element => element.props && element.props['data-dfac-usage'] !== undefined)
  trigger.props.onClick()

  const second = render(renderer, rowProps())
  const all = elements(second)
  const dialog = all.find(element => element.props && element.props.role === 'dialog')
  assert.ok(dialog !== undefined, 'the open dialog renders')
  const labels = all.filter(element => element.type === 'dt').map(element => element.props.children[0])
  const values = all.filter(element => element.type === 'dd').map(element => element.props.children[0] ?? element.props.children)
  assert.deepEqual(labels, ['dialog.model', 'dialog.cacheHit', 'dialog.input', 'dialog.cacheRead', 'dialog.cacheWrite', 'dialog.output'])
  assert.equal(values[0], 'deepseek-official/deepseek-flash')
  assert.match(String(values[1]), /^\d+(\.\d+)?%$/)
  assert.deepEqual(values.slice(2), ['445 tok', '202,880 tok', '0 tok', '3,029 tok'])
  assert.equal(second.props['data-dfac-open'], 'true')
})

test('only a compaction at the transcript tail stays visible', () => {
  resetHooks()
  const { renderer } = mount()
  // A later Turn's row (or any later visible row) sends the compaction back to
  // hover-only, exactly like the shipped earlier-message action rows.
  const followed = render(renderer, rowProps({
    ...chatWith([
      { kind: 'fork-after-compaction', anchorSeq: 2_055.1, visibility: 'visible' },
      { kind: 'turn-tail', anchorSeq: 3_000.1, visibility: 'visible' },
      { kind: 'user', anchorSeq: 3_100, visibility: 'visible' },
    ]),
  }))
  assert.equal(followed.props['data-dfac-reveal'], 'hover')

  // Hidden later rows do not count: the tail rule follows what is rendered.
  resetHooks()
  const hiddenAfter = render(renderer, rowProps({
    ...chatWith([
      { kind: 'fork-after-compaction', anchorSeq: 2_055.1, visibility: 'visible' },
      { kind: 'turn-process', anchorSeq: 3_000.1, visibility: 'hidden' },
    ]),
  }))
  assert.equal(hiddenAfter.props['data-dfac-reveal'], 'always')
})
