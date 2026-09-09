const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { test, beforeEach } = require('node:test')
const root = path.resolve(__dirname, '../code')
const servicePath = path.join(root, 'services/visitor-state.js')
let visitor, storage, calls, readError, writeError, writes, deferredQuery, pageStack, previewError

function freshService() {
  delete require.cache[require.resolve(servicePath)]
  return require(servicePath)
}
function event(dataset = {}, extra = {}) { return { currentTarget: { dataset }, ...extra } }
function loadPage(name, options = {}) {
  let definition
  global.Page = (value) => { definition = value }
  const file = path.join(root, `pages/${name}/${name}.js`)
  delete require.cache[require.resolve(file)]
  require(file)
  const page = { ...definition, data: structuredClone(definition.data), setData(value, done) {
    assert.ok(!this.unloaded, 'no setData after unload')
    Object.assign(this.data, value)
    if (done) done()
  } }
  if (page.onLoad) page.onLoad(options)
  if (page.onShow) page.onShow()
  return page
}
function pin(page, place, vibe = '', note = '') {
  page.openPinSheet()
  page.inputPinPlace({ detail: { value: place } })
  page.inputPinNote({ detail: { value: note } })
  if (vibe) page.selectPinVibe(event({ id: vibe }))
  page.savePin()
}
function partition(page) {
  const all = page.data.activeStops.concat(page.data.skippedStops).map((item) => item.id)
  assert.equal(all.length, 4)
  assert.deepEqual([...all].sort(), [...visitor.PLACE_IDS].sort())
  assert.equal(new Set(all).size, 4)
  assert.ok(!JSON.stringify(page.data).includes('undefined'))
}
function drag(page, from, to) {
  const id = page.data.activeStops[from].id
  page.touchRouteStart(event({ id }, { touches: [{ clientY: from * 70 + 35 }] }))
  assert.equal(page.data.pressedId, id)
  page.startRouteDrag(event({ id }))
  assert.equal(page.data.dragId, id)
  page.moveRouteDrag({ touches: [{ clientY: to * 70 + 35 }] })
  page.endRouteDrag()
  assert.equal(page.data.activeStops[to].id, id)
  assert.equal(page.data.dragId, '')
  partition(page)
}
beforeEach(() => {
  storage = {}; calls = []; readError = false; writeError = false; writes = 0; deferredQuery = false
  pageStack = [{ route: 'pages/home/home' }]; previewError = false
  global.getCurrentPages = () => pageStack
  global.wx = {
    getStorageSync(key) { if (readError) throw Error('read failure'); return structuredClone(storage[key]) },
    setStorageSync(key, value) { writes++; if (writeError) throw Error('quota'); storage[key] = structuredClone(value) },
    showToast(value) { calls.push(value) },
    getWindowInfo: () => ({ windowWidth: 375, windowHeight: 667, screenHeight: 700, safeArea: { bottom: 680 } }),
    getMenuButtonBoundingClientRect: () => ({ bottom: 52 }),
    setBackgroundColor() {},
    navigateTo(value) { calls.push(value) }, redirectTo(value) { calls.push(value) },
    reLaunch(value) { calls.push(value) }, navigateBack(value = {}) { calls.push({ back: true, ...value }) },
    getImageInfo(value) { value.success({ width: 640, height: 480 }) },
    previewImage(value) { calls.push(value); if (!previewError && value.success) value.success(); else if (previewError && value.fail) value.fail({ errMsg: 'failed' }) },
    createSelectorQuery() {
      let page, callback
      const query = {
        in(value) { page = value; return query }, selectAll() { return query },
        boundingClientRect(value) { callback = value; return query },
        exec() {
          const rects = page.data.activeStops.map((item, index) => ({ top: index * 70, bottom: index * 70 + 70 }))
          const invoke = () => callback(rects)
          if (deferredQuery) calls.push(invoke); else invoke()
        }
      }
      return query
    }
  }
  visitor = freshService()
})

test('cold start, missing fields, invalid legacy values, default reset and detached copies', () => {
  assert.deepEqual(visitor.loadVisitorState(), visitor.getDefaultState())
  assert.equal(writes, 0)
  for (const raw of [null, 'broken', [], 17, { version: 9 }, { version: 1, pin: null, route: null, session: null }]) {
    storage[visitor.STORAGE_KEY] = raw
    assert.deepEqual(visitor.loadVisitorState(), visitor.getDefaultState())
  }
  storage[visitor.STORAGE_KEY] = { pin: { place: ' 青岛 ' }, route: { days: 5, order: ['urumqi', null, 'urumqi', 'unknown'], skipped: ['guiping', 'guiping'], priorities: ['nature', 'bad', 'quiet', 'city'] }, scores: { city: 999 } }
  let result = visitor.loadVisitorState()
  assert.equal(result.pin.place, '青岛')
  assert.equal(result.pin.vibe, '')
  assert.deepEqual(result.route.order, ['urumqi', 'nanning', 'bayinbuluke'])
  assert.deepEqual(result.route.priorities, ['nature', 'quiet'])
  assert.equal(result.scores.city, 2)
  result.route.order.push('bad')
  assert.ok(!visitor.loadVisitorState().route.order.includes('bad'))
  assert.equal(visitor.resetVisitorState(), true)
  assert.deepEqual(freshService().loadVisitorState(), visitor.getDefaultState())
})

test('storage write/read exceptions preserve session state, report failure and allow retry/reset', () => {
  visitor.updatePin({ place: '成都', vibe: 'city' })
  writeError = true
  const failed = visitor.updatePin({ place: '青岛' })
  assert.equal(failed.persisted, false)
  assert.equal(visitor.loadVisitorState().pin.place, '青岛')
  readError = true
  const journey = visitor.updateRoute({ days: 7, order: ['bayinbuluke'] })
  assert.equal(journey.state.pin.place, '青岛')
  assert.equal(journey.persisted, false)
  readError = false; writeError = false
  assert.equal(visitor.saveVisitorState(), true)
  visitor = freshService()
  assert.equal(visitor.loadVisitorState().route.days, 7)
  assert.equal(visitor.loadVisitorState().pin.place, '青岛')
  writeError = true
  assert.equal(visitor.resetVisitorState(), false)
  assert.deepEqual(visitor.loadVisitorState(), visitor.getDefaultState())
  writeError = false
  visitor.saveVisitorState()
  assert.deepEqual(freshService().loadVisitorState(), visitor.getDefaultState())
  readError = true
  assert.deepEqual(freshService().loadVisitorState(), visitor.getDefaultState())
})

test('pin empty, whitespace, place-only, complete, edit, limits, cancel and reopen', () => {
  const page = loadPage('home')
  assert.equal(page.data.match, null)
  pin(page, '   ')
  assert.ok(page.data.pinError)
  assert.equal(page.data.pinSheetOpen, true)
  assert.equal(visitor.loadVisitorState().session.interactionCount, 0)
  pin(page, ' 东京 ')
  assert.equal(page.data.pin.place, '东京')
  assert.equal(page.data.match, null)
  assert.equal(page.data.pinSheetOpen, false)
  pin(page, '东京', 'quiet', ' 想在这里消失一个星期。 ')
  assert.equal(page.data.match.placeId, 'bayinbuluke')
  assert.equal(page.data.pin.note, '想在这里消失一个星期。')
  page.toggleMatch()
  assert.equal(page.data.matchExpanded, true)
  const count = visitor.loadVisitorState().session.interactionCount
  page.savePin()
  assert.equal(visitor.loadVisitorState().session.interactionCount, count)
  pin(page, '成都', 'city', '新的一句话')
  assert.equal(page.data.match.placeId, 'urumqi')
  pin(page, '地'.repeat(31))
  assert.ok(page.data.pinError)
  assert.equal(page.data.pin.place, '成都')
  page.closePinSheet()
  page.openPinSheet()
  assert.equal(page.data.pinDraft.place, '成都')
  page.inputPinNote({ detail: { value: '字'.repeat(41) } })
  page.savePin()
  assert.ok(page.data.pinError)
  page.onHide(); page.onShow()
  assert.equal(page.data.pinSheetOpen, false)
  assert.equal(page.data.pin.note, '新的一句话')
})

test('pin persistence failure is visible, survives page navigation during this session', () => {
  const page = loadPage('home')
  writeError = true
  pin(page, '东京', 'slow')
  assert.match(calls.at(-1).title, /未能写入本地/)
  assert.equal(loadPage('home').data.pin.place, '东京')
})

test('vibe matches deterministic for all six choices; no invented map markers', () => {
  const home = loadPage('home')
  const original = structuredClone(home.data.markers)
  const expected = ['bayinbuluke', 'bayinbuluke', 'guiping', 'urumqi', 'bayinbuluke', 'urumqi']
  visitor.VIBES.forEach((vibe, index) => {
    pin(home, '任意地点', vibe.id)
    assert.equal(home.data.match.placeId, expected[index])
    assert.ok(home.data.match.reason.includes(`${home.data.match.percent}/100`))
    const match = structuredClone(home.data.match)
    home.onShow()
    assert.deepEqual(home.data.match, match)
    assert.deepEqual(home.data.markers, original)
    home.openMatch()
    const journeys = require('../code/services/summer-data').getJourneys()
    const target = journeys.find((item) => item.placeId === expected[index])
    assert.equal(calls.at(-1).url, `/pages/detail/detail?id=${target.id}`)
  })
})

test('Journey 3/5/7 days, 0/1/2 priorities, third selection rejects without replacement', () => {
  const page = loadPage('timeline')
  assert.equal(page.data.journeyMode, 'my')
  page.selectMode(event({ mode: 'your' }))
  page.generateRoute()
  assert.match(page.data.routeError, /天数/)
  for (const days of [3, 5, 7]) {
    page.selectDays(event({ days }))
    page.generateRoute()
    assert.equal(page.data.routeResult.length, days)
    assert.equal(page.data.routeResult[0].placeId, 'nanning')
    assert.deepEqual(page.data.routeResult.map((item) => item.day), Array.from({ length: days }, (_, i) => String(i + 1).padStart(2, '0')))
  }
  assert.deepEqual(page.data.route.priorities, [])
  page.selectPriority(event({ id: 'nature' }))
  assert.deepEqual(page.data.route.priorities, ['nature'])
  page.selectPriority(event({ id: 'quiet' }))
  const count = visitor.loadVisitorState().session.interactionCount
  page.selectPriority(event({ id: 'city' }))
  assert.equal(calls.at(-1).title, '最多选择两个。')
  assert.deepEqual(page.data.route.priorities, ['nature', 'quiet'])
  assert.equal(visitor.loadVisitorState().session.interactionCount, count)
  page.selectPriority(event({ id: 'nature' }))
  page.selectPriority(event({ id: 'quiet' }))
  assert.deepEqual(page.data.route.priorities, [])
})

test('120 rapid native-handler reorder cycles preserve each location exactly once', () => {
  const page = loadPage('timeline')
  page.selectDays(event({ days: 5 }))
  for (let i = 0; i < 120; i++) drag(page, i % 4, (i + 3) % 4)
  const saved = visitor.loadVisitorState()
  assert.deepEqual(loadPage('timeline').data.route, saved.route)
  assert.equal(visitor.loadVisitorState().session.interactionCount, saved.session.interactionCount)
})

test('touch cancelled, delayed selector query, missing touches and repeated end cannot corrupt route', () => {
  const page = loadPage('timeline')
  const original = page.data.activeStops.map((item) => item.id)
  deferredQuery = true
  page.touchRouteStart(event({ id: original[0] }, { touches: [{ clientY: 35 }] }))
  page.startRouteDrag(event({ id: original[0] }))
  const callback = calls.at(-1)
  page.moveRouteDrag({ touches: [{ clientY: 245 }] })
  page.cancelDrag()
  callback()
  page.endRouteDrag(); page.endRouteDrag()
  page.moveRouteDrag({ touches: [] })
  page.touchRouteStart(event({ id: 'bad' }, { touches: [{ clientY: 0 }] }))
  assert.deepEqual(page.data.activeStops.map((item) => item.id), original)
  page.touchRouteStart(event({ id: original[0] }, { touches: [{ clientY: 35 }] }))
  page.startRouteDrag(event({ id: original[0] }))
  const afterUnload = calls.at(-1)
  page.onUnload(); page.unloaded = true
  afterUnload()
  assert.equal(writes, 0)
})

test('KEEP/SKIP/KEEP, all skipped, one remaining, days greater/fewer than stops', () => {
  const page = loadPage('timeline')
  page.selectDays(event({ days: 7 }))
  for (let i = 0; i < 20; i++) {
    page.toggleStop(event({ id: 'guiping' })); partition(page)
    assert.ok(!page.data.activeStops.some((item) => item.id === 'guiping'))
    page.toggleStop(event({ id: 'guiping' })); partition(page)
    assert.equal(page.data.activeStops.at(-1).id, 'guiping')
  }
  visitor.PLACE_IDS.forEach((id) => page.toggleStop(event({ id })))
  partition(page)
  assert.equal(page.data.activeStops.length, 0)
  page.generateRoute()
  assert.match(page.data.routeError, /至少保留/)
  assert.deepEqual(page.data.routeResult, [])
  assert.equal(loadPage('timeline').data.activeStops.length, 0)
  page.toggleStop(event({ id: 'bayinbuluke' }))
  page.generateRoute()
  assert.equal(page.data.routeResult.length, 7)
  assert.ok(page.data.routeResult.every((item) => item.placeId === 'bayinbuluke'))
  page.toggleStop(event({ id: 'urumqi' }))
  page.selectDays(event({ days: 5 }))
  assert.deepEqual(page.data.routeResult.map((item) => item.placeId), ['bayinbuluke', 'bayinbuluke', 'bayinbuluke', 'bayinbuluke', 'urumqi'])
  page.toggleStop(event({ id: 'nanning' })); page.toggleStop(event({ id: 'guiping' }))
  page.selectDays(event({ days: 3 }))
  assert.equal(page.data.routeResult.length, 3)
  assert.equal(page.data.omittedNames, '桂平')
})

test('MAP → JOURNEY → MAP and fresh runtime restore both sections without counting reads', () => {
  const home = loadPage('home')
  pin(home, '青岛', 'quiet', '沿着海边慢慢走')
  const timeline = loadPage('timeline')
  timeline.selectDays(event({ days: 3 }))
  timeline.selectPriority(event({ id: 'nature' }))
  drag(timeline, 3, 0)
  timeline.generateRoute()
  const saved = visitor.loadVisitorState()
  const writeCount = writes
  for (let i = 0; i < 10; i++) { home.onShow(); timeline.onShow() }
  assert.equal(writes, writeCount)
  assert.deepEqual(home.data.pin, saved.pin)
  assert.deepEqual(visitor.loadVisitorState(), saved)
  visitor = freshService()
  assert.deepEqual(visitor.loadVisitorState(), saved)
  assert.deepEqual(loadPage('home').data.pin, saved.pin)
  assert.deepEqual(loadPage('timeline').data.route, saved.route)
  visitor.resetVisitorState()
  home.onShow(); timeline.onShow()
  assert.equal(home.data.pin.place, '')
  assert.equal(home.data.match, null)
  assert.equal(timeline.data.route.days, null)
  assert.equal(timeline.data.activeStops.length, 4)
})

test('scores recompute from current choices; same save, edit and restored reads never inflate them', () => {
  visitor.updatePin({ place: '东京', vibe: 'quiet' })
  assert.equal(visitor.calculateVisitorScores().quiet, 3)
  const first = visitor.loadVisitorState()
  visitor.updatePin(first.pin)
  assert.deepEqual(visitor.loadVisitorState(), first)
  visitor.updatePin({ vibe: 'city' })
  assert.equal(visitor.calculateVisitorScores().quiet, 0)
  assert.equal(visitor.calculateVisitorScores().city, 3)
  visitor.updateRoute({ days: 7, priorities: ['nature', 'quiet'], order: ['bayinbuluke', 'urumqi'], skipped: ['nanning', 'guiping'] })
  assert.deepEqual(visitor.calculateVisitorScores(), { nature: 6, city: 3, quiet: 4, social: 1, planned: 0, spontaneous: 1 })
  assert.ok(visitor.getVisitorEvidence().some((item) => item.reason.includes('巴音布鲁克排在第一站')))
  assert.equal(visitor.getVisitorType().id, 'quiet-wanderer')
  const saved = visitor.loadVisitorState()
  visitor.updateRoute(saved.route)
  assert.deepEqual(visitor.loadVisitorState(), saved)
  visitor.resetVisitorState()
  assert.deepEqual(visitor.getVisitorEvidence(), [])
  assert.equal(visitor.getVisitorType(), null)
  visitor.updateRoute({ days: 3, priorities: ['nature'] })
  assert.equal(visitor.getVisitorType().id, 'quiet-wanderer', 'explicit nature priority outranks light planned signal in the five-type model')
})

test('original markers/detail navigation and MY JOURNEY filters remain available', () => {
  const home = loadPage('home')
  assert.equal(home.data.markers.length, 4)
  home.data.markers.forEach((marker) => {
    home.openMarker({ detail: { markerId: marker.id } })
    const target = home.data.stops.find((item) => Number(item.order) === marker.id)
    assert.equal(calls.at(-1).url, `/pages/detail/detail?id=${target.id}`)
  })
  home.openJourney()
  assert.equal(calls.at(-1).url, '/pages/timeline/timeline')
  const page = loadPage('timeline')
  assert.equal(page.data.journeys.length, 4)
  for (const filter of ['JUL', 'AUG', 'ALL']) {
    page.selectFilter(event({ filter }))
    const expected = filter === 'ALL' ? page.allJourneys : page.allJourneys.filter((item) => item.month === (filter === 'JUL' ? '07' : '08'))
    assert.deepEqual(page.data.journeys, expected)
  }
  page.openDetail(event({ id: page.data.journeys[0].id }))
  assert.equal(calls.at(-1).url, `/pages/detail/detail?id=${page.data.journeys[0].id}`)
})

test('all JS/JSON checks, active WXML handlers and resources pass; unused legacy binding is reported', () => {
  function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]) }
  const files = walk(root)
  const js = files.filter((file) => file.endsWith('.js'))
  js.forEach((file) => execFileSync(process.execPath, ['--check', file]))
  const json = files.filter((file) => file.endsWith('.json'))
  json.forEach((file) => JSON.parse(fs.readFileSync(file, 'utf8')))
  let events = 0
  const missing = []
  for (const directory of ['pages', 'components']) {
    for (const folder of fs.readdirSync(path.join(root, directory))) {
      const file = path.join(root, directory, folder, `${folder}.js`)
      if (!fs.existsSync(file)) continue
      let definition
      global.Page = global.Component = (value) => { definition = value }
      delete require.cache[require.resolve(file)]; require(file)
      const handlers = definition.methods || definition
      for (const wxml of walk(path.dirname(file)).filter((name) => name.endsWith('.wxml'))) {
        for (const match of fs.readFileSync(wxml, 'utf8').matchAll(/(?:bind|catch)(?::)?[a-zA-Z]+\s*=\s*"([A-Za-z_$][\w$]*)"/g)) {
          if (typeof handlers[match[1]] !== 'function') missing.push(`${path.relative(root, wxml).replaceAll('\\', '/')}:${match[1]}`)
          events++
        }
      }
    }
  }
  assert.deepEqual(missing, ['components/navigation-bar/navigation-bar.wxml:home'])
  json.forEach((file) => {
    const config = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.ok(!Object.values(config.usingComponents || {}).some((value) => value.includes('navigation-bar')), 'legacy navigation-bar must remain unused')
  })
  console.log(`KNOWN BASELINE ISSUE (unused component): ${missing.join(', ')}`)
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json')))
  assert.equal(app.pages.length, 6)
  const summer = require('../code/data/summer2026')
  summer.photos.forEach((photo) => assert.ok(fs.existsSync(path.join(root, photo.src)), photo.src))
  for (const photo of summer.photos.filter((item) => /草原|湖泊|巩乃|公路/.test(item.title))) assert.equal(photo.placeId, 'bayinbuluke', photo.title)
  console.log(`Checked ${js.length} JS files, ${json.length} JSON files, ${events} WXML bindings, ${summer.photos.length} photo resources.`)
})

// Sprint 2 continues the same mocked WeChat harness and Sprint 1 regression suite.
const situations = require('../code/data/visitor-situations')
const summerData = require('../code/services/summer-data')
function detailPage(placeId) {
  return loadPage('detail', { id: summerData.getJourneys().find((item) => item.placeId === placeId).id })
}
function youPage() {
  const page = loadPage('me')
  page.selectArchiveMode(event({ mode: 'you' }))
  return page
}
function fullVisitor() {
  visitor.updatePin({ place: '青岛', vibe: 'quiet', note: '沿着海边慢慢走' })
  visitor.updateRoute({ days: 3, priorities: ['nature', 'quiet'], order: ['bayinbuluke', 'urumqi'], skipped: ['nanning', 'guiping'] })
  const decisions = { nanning: 'stay_home', guiping: 'go_random', urumqi: 'keep_exploring', bayinbuluke: 'stop_sunset' }
  Object.entries(decisions).forEach(([id, choice]) => visitor.recordDecision(id, choice))
}
function finiteTree(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value))
  if (value && typeof value === 'object') Object.values(value).forEach(finiteTree)
}

test('Sprint 2: all 12 decision mappings, first save, overwrite, invalid inputs and reset', () => {
  for (const placeId of visitor.PLACE_IDS) {
    for (const choice of situations[placeId].choices) {
      visitor.resetVisitorState()
      assert.equal(visitor.recordDecision(placeId, choice.id).changed, true)
      assert.deepEqual(visitor.calculateVisitorScores(), { ...visitor.getDefaultState().scores, ...choice.weights })
      const before = visitor.loadVisitorState()
      assert.equal(visitor.recordDecision(placeId, choice.id).changed, false)
      assert.deepEqual(visitor.loadVisitorState(), before)
      assert.equal(freshService().loadVisitorState().decisions[placeId], choice.id)
    }
  }
  visitor.resetVisitorState()
  visitor.recordDecision('guiping', 'go_random')
  visitor.recordDecision('guiping', 'stay_in')
  assert.equal(visitor.calculateVisitorScores().spontaneous, 0)
  assert.equal(visitor.calculateVisitorScores().quiet, 3)
  const before = visitor.loadVisitorState()
  const beforeWrites = writes
  for (const id of [null, undefined, 'missing', '__proto__']) visitor.recordDecision(id, 'stay_home')
  for (const choice of [null, undefined, 'go_random', 'missing', {}]) visitor.recordDecision('nanning', choice)
  assert.deepEqual(visitor.loadVisitorState(), before)
  assert.equal(writes, beforeWrites)
  visitor.resetVisitorState()
  assert.deepEqual(visitor.loadVisitorState(), visitor.getDefaultState())
})

test('Sprint 2: exact MAP and priority weights replace Sprint 1 scoring rules', () => {
  const vibes = { quiet: { quiet: 3 }, wild: { spontaneous: 3, nature: 1 }, warm: { social: 1, quiet: 1 }, city: { city: 3, social: 1 }, slow: { quiet: 3, planned: 1 }, surprise: { spontaneous: 3 } }
  for (const [vibe, expected] of Object.entries(vibes)) {
    visitor.updatePin({ place: '东京', vibe })
    assert.deepEqual(visitor.calculateVisitorScores(), { ...visitor.getDefaultState().scores, ...expected })
  }
  const priorities = { nature: { nature: 4 }, food: { city: 1, social: 2 }, city: { city: 4 }, quiet: { quiet: 4 }, adventure: { spontaneous: 3, nature: 1 }, people: { social: 4 }, random: { spontaneous: 4 }, comfort: { planned: 2, quiet: 1 } }
  for (const [priority, expected] of Object.entries(priorities)) {
    const state = visitor.getDefaultState()
    state.route.priorities = [priority]
    assert.deepEqual(visitor.calculateVisitorScores(state), { ...state.scores, ...expected })
  }
})

test('Sprint 2: route first, all KEEP, many SKIP and short slow itinerary scoring', () => {
  visitor.updateRoute({ days: 3, order: ['urumqi', 'bayinbuluke'], skipped: ['nanning', 'guiping'] })
  assert.deepEqual(visitor.calculateVisitorScores(), { nature: 0, city: 2, quiet: 1, social: 0, planned: 0, spontaneous: 1 })
  visitor.updateRoute({ order: ['bayinbuluke', 'urumqi'], skipped: ['nanning', 'guiping'], days: 5 })
  assert.deepEqual(visitor.calculateVisitorScores(), { nature: 2, city: 0, quiet: 0, social: 0, planned: 0, spontaneous: 1 })
  visitor.updateRoute({ days: 7, order: visitor.PLACE_IDS, skipped: [] })
  assert.equal(visitor.calculateVisitorScores().planned, 2)
})

test('Sprint 2: legacy decisions and malformed behavior are normalized safely', () => {
  storage[visitor.STORAGE_KEY] = { version: 1, decisions: { nanning: 'go_random', guiping: 'stay_in', urumqi: null, bayinbuluke: 23 }, behavior: {
    detailVisits: { nanning: -1, guiping: 2.9, missing: 90 }, photoPreviews: { missing: 9, 'golden-puppy': 100, 'xinjiang-bbq': 3 },
    dwellTime: { nanning: NaN, guiping: Infinity, urumqi: -5, bayinbuluke: 1e20 }, revisitCount: { nanning: 100 }
  } }
  const state = visitor.loadVisitorState()
  assert.equal(state.decisions.nanning, null)
  assert.equal(state.decisions.guiping, 'stay_in')
  assert.deepEqual(state.behavior.detailVisits, { guiping: 2 })
  assert.deepEqual(state.behavior.revisitCount, { guiping: 1 })
  assert.deepEqual(state.behavior.photoPreviews, { 'xinjiang-bbq': 3 })
  assert.equal(state.behavior.dwellTime.bayinbuluke, 1000000000)
  finiteTree(state)
})

test('Sprint 2: implicit scoring capped per dimension, bounded under repeated visits/previews', () => {
  fullVisitor()
  const explicitState = visitor.loadVisitorState()
  const explicit = visitor.calculateVisitorScores()
  const type = visitor.getVisitorType().id
  for (let i = 0; i < 25; i++) {
    for (const id of visitor.PLACE_IDS) visitor.recordDetailVisit(id)
    visitor.recordPhotoPreview('bayinbuluke', 'xinjiang-grassland')
    visitor.recordPhotoPreview('urumqi', 'xinjiang-bbq')
  }
  visitor.recordDwellTime('urumqi', 600)
  const scores = visitor.calculateVisitorScores()
  for (const key of Object.keys(scores)) assert.ok(scores[key] - explicit[key] >= 0 && scores[key] - explicit[key] <= 2)
  assert.equal(scores.city - explicit.city, 2)
  assert.equal(visitor.getVisitorType().id, type)
  const justChoices = structuredClone(explicitState)
  justChoices.behavior = visitor.getDefaultState().behavior
  assert.deepEqual(visitor.calculateVisitorScores(justChoices), explicit)
})

test('Sprint 2: attention requires real data, records photo ownership and deterministic ties', () => {
  assert.equal(visitor.getAttentionSummary().hasData, false)
  visitor.recordDetailVisit('urumqi')
  visitor.recordDetailVisit('nanning')
  let attention = visitor.getAttentionSummary()
  assert.equal(attention.mostVisited.placeId, 'nanning')
  assert.equal(attention.mostVisited.tied, true)
  assert.equal(attention.mostRevisited, null)
  visitor.recordDetailVisit('urumqi')
  assert.equal(visitor.getAttentionSummary().mostRevisited.placeId, 'urumqi')
  const writesBefore = writes
  visitor.recordPhotoPreview('urumqi', 'xinjiang-grassland')
  visitor.recordPhotoPreview(null, 'missing')
  visitor.recordDetailVisit('__proto__')
  assert.equal(writes, writesBefore)
  visitor.recordPhotoPreview('bayinbuluke', 'xinjiang-grassland')
  visitor.recordPhotoPreview('bayinbuluke', 'xinjiang-grassland')
  attention = visitor.getAttentionSummary()
  assert.equal(attention.mostPreviewedPhoto.placeId, 'bayinbuluke')
  assert.equal(attention.mostPreviewedPhoto.count, 2)
  assert.equal(attention.mostPreviewedPhoto.title, '新疆草原')
  visitor.recordDwellTime('guiping', 80)
  assert.equal(visitor.getAttentionSummary().longestDwell.name, '桂平')
})

test('Sprint 2: dwell cap, invalid/negative durations, and no count inflation for dwell writes', () => {
  const before = writes
  for (const duration of [-1, NaN, Infinity, null, undefined, '5', 0]) visitor.recordDwellTime('nanning', duration)
  visitor.recordDwellTime('missing', 500)
  assert.equal(writes, before)
  visitor.recordDwellTime('nanning', 100000)
  assert.equal(visitor.loadVisitorState().behavior.dwellTime.nanning, 600)
  visitor.recordDwellTime('nanning', 0.5)
  assert.equal(visitor.loadVisitorState().behavior.dwellTime.nanning, 600.5)
  assert.equal(visitor.loadVisitorState().session.interactionCount, 0)
  finiteTree(visitor.loadVisitorState())
})

test('Sprint 2: Detail lifecycle counts one visit, pauses in background and never doubles dwell', (t) => {
  let now = 1000
  t.mock.method(Date, 'now', () => now)
  const page = detailPage('nanning')
  now = 2000; page.onShow()
  assert.equal(visitor.loadVisitorState().behavior.detailVisits.nanning, 1)
  now = 6000; page.onHide()
  assert.equal(visitor.loadVisitorState().behavior.dwellTime.nanning, 5)
  now = 999999; page.onShow()
  now += 2000; page.onHide(); page.onUnload()
  assert.equal(visitor.loadVisitorState().behavior.dwellTime.nanning, 7)
  const next = detailPage('nanning')
  assert.equal(visitor.loadVisitorState().behavior.detailVisits.nanning, 2)
  assert.equal(visitor.loadVisitorState().behavior.revisitCount.nanning, 1)
  next.onUnload()
  assert.equal(visitor.loadVisitorState().behavior.dwellTime.nanning, 7)
})

test('Sprint 2: rapid Detail exit, negative clock, huge time jump and invalid journey are safe', (t) => {
  let now = 100000
  t.mock.method(Date, 'now', () => now)
  const page = detailPage('guiping')
  now -= 1000; page.onHide()
  assert.equal(visitor.loadVisitorState().behavior.dwellTime.guiping, undefined)
  page.onShow(); now += 10000000; page.onUnload()
  assert.equal(visitor.loadVisitorState().behavior.dwellTime.guiping, 600)
  for (let i = 0; i < 20; i++) { const p = detailPage('guiping'); p.onHide(); p.onUnload() }
  assert.equal(visitor.loadVisitorState().behavior.dwellTime.guiping, 600)
  const before = visitor.loadVisitorState()
  const bad = loadPage('detail', { id: 'missing' })
  bad.onShow(); bad.onHide(); bad.onUnload()
  assert.equal(bad.data.error, true)
  assert.deepEqual(visitor.loadVisitorState(), before)
})

test('Sprint 2: each Situation reveals YOU/ME, SAME/DIFFERENT, restores and allows overwrite', () => {
  for (const placeId of visitor.PLACE_IDS) {
    const page = detailPage(placeId)
    const model = situations[placeId]
    assert.equal(page.data.situation.comparisonKind, 'curated')
    assert.equal(page.data.choosing, true)
    page.selectDecision(event({ choice: model.comparisonChoice }))
    assert.equal(page.data.decision.same, true)
    assert.equal(page.data.choosing, false)
    assert.equal(page.data.decisionRestored, false)
    const different = model.choices.find((item) => item.id !== model.comparisonChoice)
    page.reselectDecision()
    page.selectDecision(event({ choice: different.id }))
    assert.equal(page.data.decision.same, false)
    assert.equal(page.data.decision.label, different.label)
    assert.equal(visitor.loadVisitorState().decisions[placeId], different.id)
    const restored = detailPage(placeId)
    assert.equal(restored.data.decision.choice, different.id)
    assert.equal(restored.data.decisionRestored, true)
    assert.equal(restored.data.choosing, false)
    page.onUnload(); restored.onUnload()
  }
  const summary = visitor.getChoiceSummary()
  assert.equal(summary.completed, 4)
  assert.equal(summary.same, 0)
  assert.equal(summary.different, 4)
})

test('Sprint 2: Detail rendering does not count previews, valid success counts and failures do not', async () => {
  const page = detailPage('bayinbuluke')
  await Promise.resolve(); await Promise.resolve()
  assert.ok(page.data.galleryRows.length > 0)
  assert.deepEqual(visitor.loadVisitorState().behavior.photoPreviews, {})
  const cover = page.data.journey.coverPhoto
  const urls = structuredClone(page.data.galleryUrls)
  page.previewPhoto(event({ src: cover.src }))
  assert.equal(calls.at(-1).current, cover.src)
  assert.deepEqual(calls.at(-1).urls, urls)
  assert.equal(visitor.loadVisitorState().behavior.photoPreviews[cover.id], 1)
  page.previewPhoto(event({ src: cover.src }))
  assert.equal(visitor.loadVisitorState().behavior.photoPreviews[cover.id], 2)
  previewError = true
  page.previewPhoto(event({ src: cover.src }))
  page.previewPhoto(event({ src: '/missing.jpg' }))
  assert.equal(visitor.loadVisitorState().behavior.photoPreviews[cover.id], 2)
  page.onUnload()
  const pending = detailPage('urumqi'); pending.onUnload()
  await Promise.resolve(); await Promise.resolve()
})

test('Sprint 2: Detail back and original main navigation paths stay intact', () => {
  const page = detailPage('nanning')
  page.goBack()
  assert.equal(calls.at(-1).url, '/pages/home/home')
  pageStack.push({ route: 'pages/detail/detail' })
  page.goBack()
  assert.equal(calls.at(-1).back, true)
  page.onUnload()
})

test('Sprint 2: normalized scores are finite independent intensities, monotonic and in 0–100', () => {
  assert.deepEqual(visitor.getNormalizedScores(), visitor.getDefaultState().scores)
  visitor.updatePin({ place: '东京', vibe: 'quiet' })
  assert.equal(visitor.getNormalizedScores().quiet, Math.round(300 / 11))
  const before = visitor.getNormalizedScores().quiet
  visitor.recordDecision('nanning', 'stay_home')
  assert.ok(visitor.getNormalizedScores().quiet > before)
  fullVisitor()
  const state = visitor.loadVisitorState()
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(visitor.calculateVisitorScores(state), state.scores)
    for (const score of Object.values(visitor.getNormalizedScores(state))) assert.ok(Number.isInteger(score) && score >= 0 && score <= 100)
  }
})

test('Sprint 2: all five formal types and fixed priority tie are deterministic', () => {
  const cases = [
    ['quiet-wanderer', { route: { priorities: ['nature', 'quiet'] } }],
    ['city-explorer', { pin: { place: '东京', vibe: 'city' } }],
    ['off-script', { decisions: { guiping: 'go_random' } }],
    ['slow-observer', { pin: { place: '青岛', vibe: 'slow' } }],
    ['route-maker', { route: { days: 5, order: visitor.PLACE_IDS } }]
  ]
  for (const [id, patch] of cases) {
    const state = { ...visitor.getDefaultState(), ...patch }
    const result = visitor.getVisitorType(state)
    assert.equal(result.id, id)
    assert.ok(result.en && result.description)
    for (let i = 0; i < 20; i++) assert.deepEqual(visitor.getVisitorType(state), result)
  }
  // City = 3, Slow = 3; fixed list places City first.
  const tie = visitor.getDefaultState()
  tie.pin = { place: '东京', vibe: 'quiet' }
  tie.route.priorities = ['people']
  assert.equal(visitor.getVisitorType(tie).id, 'city-explorer')
  assert.equal(visitor.getVisitorType(tie).score, 3)
  visitor.updatePin({ place: '东京' })
  assert.equal(visitor.getVisitorType(), null, 'place text alone cannot invent preferences')
  fullVisitor()
  const fullType = visitor.getVisitorType()
  assert.ok(fullType)
  assert.deepEqual(freshService().getVisitorType(), fullType)
})

test('Sprint 2: five more seconds cannot overturn an explicit type; sparse browsing stays explainable', () => {
  visitor.recordDecision('nanning', 'stay_home')
  const type = visitor.getVisitorType().id
  visitor.recordDwellTime('urumqi', 58)
  visitor.recordDwellTime('urumqi', 5)
  assert.equal(visitor.getVisitorType().id, type)
  visitor.resetVisitorState()
  visitor.recordDetailVisit('urumqi')
  assert.equal(visitor.getVisitorType(), null)
  visitor.recordDetailVisit('urumqi')
  assert.equal(visitor.getVisitorType().id, 'city-explorer')
  assert.ok(visitor.getVisitorEvidence().some((item) => item.text.includes('乌鲁木齐')))
})

test('Sprint 2: evidence is state-derived, bounded, refreshed after overwrite and never fabricated', () => {
  assert.deepEqual(visitor.getVisitorEvidence(), [])
  visitor.recordDecision('guiping', 'go_random')
  let evidence = visitor.getVisitorEvidence()
  assert.equal(evidence.length, 1)
  assert.equal(evidence[0].type, 'decision')
  assert.ok(evidence[0].text.includes('临时去一个没计划的地方'))
  assert.ok(!JSON.stringify(evidence).includes('四次'))
  visitor.recordDecision('guiping', 'stay_in')
  evidence = visitor.getVisitorEvidence()
  assert.ok(evidence[0].text.includes('留在家里'))
  assert.ok(!JSON.stringify(evidence).includes('临时去'))
  fullVisitor()
  evidence = visitor.getVisitorEvidence()
  assert.ok(evidence.length >= 3 && evidence.length <= 5)
  assert.equal(evidence[0].type, 'priority')
  assert.ok(evidence.some((item) => item.type === 'route_first' && item.text.includes('巴音布鲁克')))
  assert.ok(!evidence.some((item) => item.type === 'attention'))
  visitor.resetVisitorState()
  assert.deepEqual(visitor.getVisitorEvidence(), [])
  assert.equal(visitor.getAttentionSummary().hasData, false)
})

test('Sprint 2: Archive empty state, ME/YOU switching, signals and completion render models', () => {
  const page = loadPage('me')
  assert.equal(page.data.archiveMode, 'me')
  const original = { stats: structuredClone(page.data.stats), places: structuredClone(page.data.places), moments: structuredClone(page.data.moments) }
  page.selectArchiveMode(event({ mode: 'you' }))
  const profile = page.data.profile
  assert.equal(profile.type, null)
  assert.equal(profile.pin.place, '')
  assert.equal(profile.routeComplete, false)
  assert.equal(profile.choices.completed, 0)
  assert.equal(profile.attention.hasData, false)
  assert.deepEqual(profile.evidence, [])
  assert.deepEqual(profile.comparisons, [])
  assert.equal(profile.signalGroups.flatMap((group) => group.items).length, 6)
  page.selectArchiveMode(event({ mode: 'me' }))
  assert.equal(page.data.archiveMode, 'me')
  assert.deepEqual({ stats: page.data.stats, places: page.data.places, moments: page.data.moments }, original)
  assert.equal(writes, 0)
})

test('Sprint 2: Archive only pin, only route, one decision and full decisions are real snapshots', () => {
  const page = youPage()
  visitor.updatePin({ place: '东京', vibe: 'city', note: '走过街道' })
  page.onShow()
  assert.equal(page.data.profile.pin.place, '东京')
  assert.equal(page.data.profile.type.id, 'city-explorer')
  assert.equal(page.data.profile.comparisons.length, 1)
  visitor.resetVisitorState()
  visitor.updateRoute({ days: 3, order: ['urumqi', 'bayinbuluke'], skipped: ['nanning', 'guiping'] })
  page.onShow()
  assert.equal(page.data.profile.routeComplete, true)
  assert.deepEqual(page.data.profile.routeNames, ['乌鲁木齐', '巴音布鲁克'])
  assert.equal(page.data.profile.skippedNames, '南宁 · 桂平')
  visitor.resetVisitorState()
  visitor.recordDecision('bayinbuluke', 'stop_sunset')
  page.onShow()
  assert.equal(page.data.profile.choices.completed, 1)
  assert.equal(page.data.profile.choices.items[0].label, '还没有选择')
  assert.equal(page.data.profile.choices.items[3].label, '停下来等日落')
  fullVisitor(); page.onShow()
  assert.equal(page.data.profile.choices.completed, 4)
  assert.equal(page.data.profile.comparisons.length, 6)
  assert.equal(page.data.profile.type.id, visitor.getVisitorType().id)
  assert.deepEqual(page.data.profile.evidence, visitor.getVisitorEvidence())
})

test('Sprint 2: Archive attention photo, all SKIP and days-limited route stay truthful', () => {
  const page = youPage()
  visitor.recordDetailVisit('bayinbuluke')
  visitor.recordDetailVisit('bayinbuluke')
  visitor.recordPhotoPreview('bayinbuluke', 'xinjiang-grassland')
  visitor.recordDwellTime('bayinbuluke', 120)
  page.onShow()
  assert.equal(page.data.profile.attention.hasData, true)
  assert.equal(page.data.profile.attention.mostRevisited.name, '巴音布鲁克')
  assert.equal(page.data.profile.attention.mostPreviewedPhoto.id, 'xinjiang-grassland')
  visitor.updateRoute({ days: 3, order: visitor.PLACE_IDS })
  page.onShow()
  assert.deepEqual(page.data.profile.routeNames, ['南宁', '桂平', '乌鲁木齐'])
  assert.equal(page.data.profile.omittedNames, '巴音布鲁克')
  visitor.updateRoute({ order: [], skipped: visitor.PLACE_IDS })
  page.onShow()
  assert.equal(page.data.profile.routeComplete, false)
  assert.deepEqual(page.data.profile.routeNames, [])
})

test('Sprint 2: Archive CTAs continue missing work without a new page route', () => {
  const page = youPage()
  page.continueTrace(event({ kind: 'map' }))
  assert.equal(calls.at(-1).url, '/pages/home/home')
  page.continueTrace(event({ kind: 'journey' }))
  assert.equal(calls.at(-1).url, '/pages/timeline/timeline?mode=your')
  assert.equal(loadPage('timeline', { mode: 'your' }).data.journeyMode, 'your')
  assert.equal(loadPage('timeline').data.journeyMode, 'my')
  visitor.recordDecision('nanning', 'stay_home')
  page.continueTrace(event({ kind: 'choices' }))
  const target = summerData.getJourneys().find((item) => item.placeId === 'guiping')
  assert.equal(calls.at(-1).url, `/pages/detail/detail?id=${target.id}`)
  pageStack.push({ route: 'pages/me/me' })
  page.continueTrace(event({ kind: 'journey' }))
  assert.equal(calls.at(-1).url, '/pages/timeline/timeline?mode=your')
})

test('Sprint 2: MAP/Route/Decision edits refresh open Archive and cold restart restores full profile', () => {
  const archive = youPage()
  const map = loadPage('home')
  pin(map, '青岛', 'quiet')
  archive.onShow()
  assert.equal(archive.data.profile.pin.place, '青岛')
  assert.equal(archive.data.profile.type.id, 'slow-observer')
  const journey = loadPage('timeline')
  journey.selectDays(event({ days: 3 }))
  journey.selectPriority(event({ id: 'nature' }))
  drag(journey, 3, 0)
  archive.onShow()
  assert.equal(archive.data.profile.routeNames[0], '巴音布鲁克')
  assert.equal(archive.data.profile.type.id, 'quiet-wanderer')
  const detail = detailPage('guiping')
  detail.selectDecision(event({ choice: 'go_random' }))
  archive.onShow()
  assert.ok(archive.data.profile.choices.items[1].label.includes('临时'))
  const score = archive.data.profile.signalGroups[2].items[1].value
  detail.reselectDecision(); detail.selectDecision(event({ choice: 'stay_in' }))
  detail.onHide(); archive.onShow()
  assert.equal(archive.data.profile.choices.items[1].label, '留在家里')
  assert.ok(archive.data.profile.signalGroups[2].items[1].value < score)
  assert.ok(!JSON.stringify(archive.data.profile.evidence).includes('临时去'))
  const saved = structuredClone(archive.data.profile)
  visitor = freshService()
  assert.deepEqual(youPage().data.profile, saved)
  const count = visitor.loadVisitorState().session.interactionCount
  archive.onShow(); archive.onShow()
  assert.equal(visitor.loadVisitorState().session.interactionCount, count)
  detail.onUnload()
})

test('Sprint 2: Storage failures keep decisions and profile coherent with a visible save notice', () => {
  const detail = detailPage('guiping')
  writeError = true
  detail.selectDecision(event({ choice: 'go_random' }))
  assert.match(detail.data.decisionSaveNotice, /未能写入本地/)
  assert.equal(youPage().data.profile.choices.items[1].choice, 'go_random')
  writeError = false
  detail.reselectDecision(); detail.selectDecision(event({ choice: 'go_random' }))
  assert.equal(freshService().loadVisitorState().decisions.guiping, 'go_random')
  detail.onUnload()
})

test('Sprint 2: full reset clears decisions, behavior, scores and the already open profile', () => {
  fullVisitor()
  visitor.recordDetailVisit('urumqi'); visitor.recordDetailVisit('urumqi')
  visitor.recordPhotoPreview('urumqi', 'xinjiang-bbq')
  visitor.recordDwellTime('urumqi', 120)
  const page = youPage()
  assert.ok(page.data.profile.type)
  visitor.resetVisitorState()
  page.onShow()
  assert.deepEqual(visitor.loadVisitorState(), visitor.getDefaultState())
  assert.equal(page.data.profile.choices.completed, 0)
  assert.equal(page.data.profile.type, null)
  assert.equal(page.data.profile.attention.hasData, false)
  assert.deepEqual(page.data.profile.evidence, [])
  assert.ok(page.data.profile.signalGroups.every((group) => group.items.every((item) => item.value === 0)))
})

test('Sprint 2: representative evidence includes both priorities and only actually chosen exploratory situations', () => {
  fullVisitor()
  const evidence = visitor.getVisitorEvidence()
  const priorities = evidence.find((item) => item.type === 'priority').text
  assert.ok(priorities.includes('自然') && priorities.includes('安静'))
  const decision = evidence.find((item) => item.type === 'decision').text
  assert.ok(decision.includes('桂平') && decision.includes('乌鲁木齐') && decision.includes('2个情境'))
  assert.ok(!decision.includes('南宁') && !decision.includes('巴音布鲁克'))
  visitor.recordDecision('urumqi', 'noodles')
  assert.ok(!visitor.getVisitorEvidence().some((item) => item.text.includes('2个情境')))
})

test('Sprint 2: modified WXML has balanced structure and new interactions retain Chinese labels', () => {
  for (const name of ['detail', 'me']) {
    const source = fs.readFileSync(path.join(root, `pages/${name}/${name}.wxml`), 'utf8')
    const markup = source.replace(/\{\{[\s\S]*?\}\}/g, 'expression').replace(/<!--[\s\S]*?-->/g, '')
    const stack = []
    for (const tag of markup.matchAll(/<(\/)?([\w-]+)\b[^>]*>/g)) {
      if (tag[1]) assert.equal(stack.pop(), tag[2], `unbalanced tag in ${name}: ${tag[0]}`)
      else if (!tag[0].endsWith('/>')) stack.push(tag[2])
    }
    assert.deepEqual(stack, [])
    assert.ok(!/Preview|目前看来/.test(markup))
  }
  const detail = fs.readFileSync(path.join(root, 'pages/detail/detail.wxml'), 'utf8')
  assert.ok(detail.indexOf('class="situation"') > detail.indexOf('class="photo-gallery"'))
  assert.ok(detail.includes('我的互动对照版本'))
  const archive = fs.readFileSync(path.join(root, 'pages/me/me.wxml'), 'utf8')
  for (const heading of ['01 / 你的地点', '02 / 你的路线', '03 / 你的四次决定', '04 / 两种版本', '05 / 你停下来的地方', '06 / 你的倾向', '07 / 为什么是你', '你的痕迹 / YOUR TRACE']) assert.ok(archive.includes(heading))
})

test('Sprint 3: empty Visitor State keeps all 14 slides and never invents personal data', () => {
  const page = loadPage('index')
  const before = visitor.loadVisitorState()
  const names = ['Cover', 'Intro', 'Days', 'Timeline', 'Places Intro', 'Summer Map', 'Top Place', 'Biggest Day', 'Top Moments', 'Photo Number', 'Planned vs Reality', 'Summer Soundtrack', 'Summer Type', 'Final Poster']
  for (let i = 0; i < 14; i++) {
    page.goTo(i)
    assert.equal(page.data.slide.name, names[i])
    assert.equal(page.data.slide.number, String(i + 1).padStart(2, '0'))
    const personal = page.data.slide.visitor
    assert.equal(personal.hasTrace, false)
    for (const key of ['pin', 'route', 'decision', 'moment', 'match', 'type', 'soundtrack']) assert.equal(personal[key], null)
    assert.equal(personal.previewCount, 0)
    assert.equal(personal.durationText, '')
    assert.deepEqual(personal.evidence, [])
  }
  assert.deepEqual(visitor.loadVisitorState(), before, 'viewing Wrapped is read-only for Visitor State')
})

test('Sprint 3: pin-only, route-only, decision-only and full states personalize appropriate summaries', () => {
  visitor.updatePin({ place: '东京', vibe: 'quiet' })
  let summary = visitor.getWrappedSummary()
  assert.equal(summary.pin.place, '东京')
  assert.equal(summary.vibeMatch.placeId, 'bayinbuluke')
  assert.equal(summary.route, null)
  assert.equal(summary.decision, null)
  visitor.resetVisitorState()
  visitor.updateRoute({ days: 3, order: ['urumqi', 'bayinbuluke'], skipped: ['nanning', 'guiping'] })
  summary = visitor.getWrappedSummary()
  assert.equal(summary.route.path, '乌鲁木齐 → 巴音布鲁克')
  assert.equal(summary.emphasis.placeId, 'urumqi')
  assert.equal(summary.pin, null)
  visitor.resetVisitorState()
  visitor.recordDecision('bayinbuluke', 'stop_sunset')
  summary = visitor.getWrappedSummary()
  assert.equal(summary.decision.label, '停下来等日落')
  assert.equal(summary.decision.comparisonKind, 'curated')
  assert.equal(summary.route, null)
  fullVisitor()
  summary = visitor.getWrappedSummary()
  assert.ok(summary.hasTrace && summary.type && summary.route && summary.pin && summary.decision)
})

test('Sprint 3: existing Wrapped refreshes Pin, Route and Decision on return and same-slide refresh', () => {
  fullVisitor()
  const page = loadPage('index')
  page.goTo(5)
  visitor.updatePin({ place: '成都', vibe: 'city' })
  page.onShow()
  assert.equal(page.data.slide.visitor.pin.place, '成都')
  assert.equal(page.data.slide.visitor.match.placeId, 'urumqi')
  page.goTo(3)
  visitor.updateRoute({ order: ['urumqi', 'bayinbuluke'] })
  page.onShow()
  assert.equal(page.data.slide.visitor.route.stops[0].id, 'urumqi')
  page.goTo(7)
  visitor.recordDecision('bayinbuluke', 'change_plan')
  page.onShow()
  assert.equal(page.data.slide.visitor.decision.choice, 'change_plan')
  visitor.recordDecision('bayinbuluke', 'keep_driving')
  page.goTo(7)
  assert.equal(page.data.slide.visitor.decision.same, true)
})

test('Sprint 3: Slide 08 personalization requires a valid Bayinbuluke decision and keeps curated meaning', () => {
  visitor.recordDecision('nanning', 'go_eat')
  const page = loadPage('index', { slide: '7' })
  assert.equal(page.data.slide.visitor.decision, null)
  visitor.recordDecision('bayinbuluke', 'invalid')
  page.onShow()
  assert.equal(page.data.slide.visitor.decision, null)
  visitor.recordDecision('bayinbuluke', 'stop_sunset')
  page.onShow()
  assert.equal(page.data.slide.biggestDay.date, '2026-08-01')
  assert.equal(page.data.slide.photo.placeId, 'bayinbuluke')
  assert.equal(page.data.slide.visitor.decision.comparisonChoice, 'keep_driving')
  const source = (fs.readFileSync(path.join(root, 'pages/index/slides.wxml'), 'utf8') + fs.readFileSync(path.join(root, 'pages/index/details.wxml'), 'utf8'))
  assert.ok(source.includes('作者 / ME</text><text>{{slide.visitor.decision.comparisonLabel}}'))
  assert.ok(!/我当时真实|我继续走了/.test(source))
})

test('Sprint 3: no preview data produces no photo-view count; dwell/revisit tell place stories', () => {
  visitor.recordDetailVisit('bayinbuluke')
  assert.equal(visitor.getWrappedSummary().moment, null)
  visitor.recordDwellTime('bayinbuluke', 5)
  assert.equal(visitor.getWrappedSummary().moment, null)
  visitor.recordDwellTime('bayinbuluke', 60)
  let summary = visitor.getWrappedSummary()
  assert.equal(summary.moment.source, 'dwell')
  assert.equal(summary.moment.photo.placeId, 'bayinbuluke')
  assert.equal(summary.moment.title, '你在这里停得最久')
  assert.ok(summary.moment.reason.includes('最多时间留在了巴音布鲁克'))
  assert.equal(summary.previewCount, 0)
  assert.equal(summary.mostPreviewedPhoto, null)
  visitor.resetVisitorState()
  visitor.recordDetailVisit('urumqi'); visitor.recordDetailVisit('urumqi')
  summary = visitor.getWrappedSummary()
  assert.equal(summary.moment.source, 'revisit')
  assert.equal(summary.moment.photo.placeId, 'urumqi')
  assert.equal(summary.previewCount, 0)
})

test('Sprint 3: preview summary counts unique photos and identifies tied/repeated previews truthfully', () => {
  visitor.recordPhotoPreview('bayinbuluke', 'xinjiang-grassland')
  visitor.recordPhotoPreview('urumqi', 'xinjiang-bbq')
  let summary = visitor.getWrappedSummary()
  assert.equal(summary.previewCount, 2)
  assert.equal(summary.mostPreviewedPhoto.tied, true)
  assert.ok(summary.moment.reason.includes('之一'))
  visitor.recordPhotoPreview('urumqi', 'xinjiang-bbq')
  summary = visitor.getWrappedSummary()
  assert.equal(summary.previewCount, 2)
  assert.equal(summary.moment.photo.id, 'xinjiang-bbq')
  assert.equal(summary.moment.source, 'preview')
  assert.equal(summary.mostPreviewedPhoto.count, 2)
  const state = visitor.loadVisitorState()
  const page = loadPage('index')
  for (let i = 0; i < 10; i++) { page.goTo(8); page.goTo(9); page.onShow() }
  assert.deepEqual(visitor.loadVisitorState(), state)
})

test('Sprint 3: ties do not invent unequal attention and original travel order remains intact', () => {
  visitor.PLACE_IDS.forEach((id) => visitor.recordDetailVisit(id))
  assert.equal(visitor.getWrappedSummary().emphasis, null)
  visitor.updateRoute({ days: 3, order: ['bayinbuluke', 'urumqi', 'guiping', 'nanning'] })
  const page = loadPage('index', { slide: '4' })
  assert.equal(page.data.slide.visitor.emphasis.placeId, 'bayinbuluke')
  assert.deepEqual(page.data.slide.places.map((place) => place.id), visitor.PLACE_IDS)
  page.goTo(3)
  assert.deepEqual(page.data.slide.places.map((place) => place.id), visitor.PLACE_IDS)
  assert.deepEqual(page.data.slide.visitor.route.stops.map((place) => place.id), ['bayinbuluke', 'urumqi', 'guiping'])
})

test('Sprint 3: Slide 13 type, signal values and all evidence items exactly match Archive', () => {
  for (const setup of [() => {}, () => visitor.updatePin({ place: '东京', vibe: 'city' }), fullVisitor,
    () => visitor.recordDecision('guiping', 'go_random'), () => visitor.updatePin({ place: '青岛', vibe: 'slow' }),
    () => visitor.updateRoute({ days: 5, order: visitor.PLACE_IDS })]) {
    visitor.resetVisitorState(); setup()
    const archive = youPage()
    const wrapped = loadPage('index', { slide: '12' })
    const summary = wrapped.data.slide.visitor
    assert.deepEqual(summary.type, archive.data.profile.type)
    assert.deepEqual(summary.evidence, archive.data.profile.evidence)
    const archiveSignals = Object.fromEntries(archive.data.profile.signalGroups.flatMap((group) => group.items).map((item) => [item.id, item.value]))
    assert.deepEqual(summary.normalizedScores, archiveSignals)
    summary.signals.forEach((item) => assert.equal(item.value, archiveSignals[item.id]))
  }
})

test('Sprint 3: soundtrack switches freely, restores on reentry, overwrites and never changes score', () => {
  fullVisitor()
  const scores = visitor.calculateVisitorScores()
  const count = visitor.loadVisitorState().session.interactionCount
  const page = loadPage('index', { slide: '11' })
  assert.equal(visitor.loadVisitorState().soundtrack, null, 'default displayed track is not an explicit choice')
  for (const index of [2, 1, 0, 2, 0]) {
    page.selectTrack(event({ index }))
    assert.equal(page.data.slide.activeTrackIndex, index)
    assert.equal(visitor.loadVisitorState().soundtrack, ['01', '02', '03'][index])
    assert.deepEqual(page.data.slide.secondaryTracks.map((track) => track.index), [0, 1, 2].filter((i) => i !== index))
    assert.deepEqual(visitor.calculateVisitorScores(), scores)
  }
  assert.equal(visitor.loadVisitorState().session.interactionCount, count + 5)
  page.selectTrack(event({ index: 0 }))
  assert.equal(visitor.loadVisitorState().session.interactionCount, count + 5)
  page.selectTrack(event({ index: 2 }))
  page.goTo(12); page.goTo(11)
  assert.equal(page.data.slide.activeTrackIndex, 2)
  visitor = freshService()
  assert.equal(loadPage('index', { slide: '11' }).data.slide.activeTrackIndex, 2)
  const previous = visitor.loadVisitorState()
  visitor.setSoundtrack('missing'); page.selectTrack(event({ index: -1 }))
  assert.deepEqual(visitor.loadVisitorState(), previous)
})

test('Sprint 3: soundtrack storage failure stays visible and successful retry persists choice', () => {
  const page = loadPage('index', { slide: '11' })
  writeError = true
  page.selectTrack(event({ index: 1 }))
  assert.match(page.data.trackSaveNotice, /未能写入本地/)
  assert.equal(page.data.slide.activeTrackIndex, 1)
  writeError = false
  page.selectTrack(event({ index: 1 }))
  assert.equal(freshService().loadVisitorState().soundtrack, '02')
})

test('Sprint 3: Final summary uses real state and CTA retains existing Cut route', () => {
  fullVisitor(); visitor.setSoundtrack('02')
  const page = loadPage('index', { slide: '13' })
  const summary = page.data.slide.visitor
  assert.equal(summary.pin.place, '青岛')
  assert.equal(summary.route.path, '巴音布鲁克 → 乌鲁木齐')
  assert.equal(summary.soundtrack.title, 'SNOOZE')
  assert.deepEqual(summary.type, visitor.getVisitorType())
  page.openCut()
  assert.equal(calls.at(-1).url, '/pages/cut/cut')
  visitor.resetVisitorState(); page.onShow()
  for (const key of ['type', 'pin', 'route', 'soundtrack']) assert.equal(page.data.slide.visitor[key], null)
})

test('Sprint 3: continue/replay keeps newest visitor data while preserving first/last boundaries', () => {
  require('../code/services/summer-state').saveState({ story: { currentSlide: 6 } })
  const page = loadPage('index')
  assert.equal(page.data.canContinue, true)
  visitor.updatePin({ place: '成都', vibe: 'city' })
  page.continueStory()
  assert.equal(page.data.currentSlide, 6)
  assert.equal(page.data.slide.visitor.pin.place, '成都')
  const before = visitor.loadVisitorState()
  page.replay(); page.previous()
  assert.equal(page.data.currentSlide, 0)
  assert.equal(page.data.canContinue, false)
  assert.equal(page.data.slide.visitor.pin.place, '成都')
  page.goTo(13); page.next()
  assert.equal(page.data.currentSlide, 13)
  assert.deepEqual(visitor.loadVisitorState(), before)
})

test('Sprint 3: vertical scrolling and control touches do not advance a story', () => {
  const page = loadPage('index')
  page.goTo(11)
  page.touchStart({ touches: [{ pageX: 200, pageY: 300 }] })
  page.touchEnd({ changedTouches: [{ pageX: 205, pageY: 100 }] })
  page.tapStory({ detail: { x: 300 } })
  assert.equal(page.data.currentSlide, 11)
  page.touchStart({ touches: [{ pageX: 200, pageY: 300 }] })
  page.stopControlTouch()
  page.touchEnd({ changedTouches: [{ pageX: 10, pageY: 300 }] })
  page.selectTrack(event({ index: 2 }))
  assert.equal(page.data.currentSlide, 11)
  assert.equal(page.data.slide.activeTrackIndex, 2)
  page.touchStart({ touches: [{ pageX: 300, pageY: 300 }] })
  page.touchEnd({ changedTouches: [{ pageX: 100, pageY: 300 }] })
  page.tapStory({ detail: { x: 300 } })
  assert.equal(page.data.currentSlide, 12)
})

test('Sprint 3: first interaction timestamp is never presented as elapsed app use', () => {
  const state = visitor.getDefaultState()
  state.session.startedAt = Date.now() - 86400000
  state.session.interactionCount = 2
  visitor.saveVisitorState(state)
  assert.equal(visitor.getWrappedSummary().durationText, '')
  const page = loadPage('index', { slide: '2' })
  assert.equal(page.data.slide.days, 35)
  assert.equal(page.data.slide.visitor.durationText, '')
})

test('Sprint 3: Wrapped WXML structure and control bindings remain valid', () => {
  for (const name of ['index', 'slides']) {
    const source = fs.readFileSync(path.join(root, `pages/index/${name}.wxml`), 'utf8')
    const markup = source.replace(/\{\{[\s\S]*?\}\}/g, 'expression').replace(/<!--[\s\S]*?-->/g, '')
    const stack = []
    for (const tag of markup.matchAll(/<(\/)?([\w-]+)\b[^>]*>/g)) {
      if (tag[1]) assert.equal(stack.pop(), tag[2])
      else if (!tag[0].endsWith('/>')) stack.push(tag[2])
    }
    assert.deepEqual(stack, [])
  }
  const source = (fs.readFileSync(path.join(root, 'pages/index/slides.wxml'), 'utf8') + fs.readFileSync(path.join(root, 'pages/index/details.wxml'), 'utf8'))
  assert.ok(source.includes('一路走到这里，'))
  assert.ok(source.includes('做出你的版本'))
  assert.ok(source.includes('mark:storyControl="cta"'))
})

test('PATCH 09: preview, revisit, dwell and insufficient evidence use matching narratives', () => {
  assert.equal(visitor.getWrappedSummary().moment, null)
  visitor.recordDetailVisit('urumqi')
  assert.equal(visitor.getWrappedSummary().moment, null)
  visitor.recordDetailVisit('urumqi')
  let moment = visitor.getWrappedSummary().moment
  assert.equal(moment.title, '你总会回到这里')
  assert.equal(moment.caption, '乌鲁木齐')
  assert.equal(moment.reason, '你最常重新打开的是乌鲁木齐。')
  assert.equal(moment.photo.placeId, 'urumqi')
  visitor.recordDwellTime('bayinbuluke', 120)
  assert.equal(visitor.getWrappedSummary().moment.source, 'revisit', 'revisit narrative precedes dwell')
  visitor.recordPhotoPreview('bayinbuluke', 'xinjiang-grassland')
  visitor.recordPhotoPreview('bayinbuluke', 'xinjiang-grassland')
  moment = visitor.getWrappedSummary().moment
  assert.equal(moment.title, '你反复打开的这一刻')
  assert.equal(moment.reason, '这张照片，是你回看最多的一张。')
  assert.equal(moment.detail, '你一共打开了它 2 次。')
  assert.equal(moment.photo.id, 'xinjiang-grassland')
  visitor.resetVisitorState()
  visitor.recordDwellTime('bayinbuluke', 120)
  moment = visitor.getWrappedSummary().moment
  assert.equal(moment.title, '你在这里停得最久')
  assert.equal(moment.reason, '在所有地点里，你把最多时间留在了巴音布鲁克。')
  assert.equal(moment.caption, '巴音布鲁克')
  assert.ok(!/封面|并不|系统检测|这里使用/.test(JSON.stringify({ title: moment.title, reason: moment.reason, detail: moment.detail })))
})

test('PATCH 11: changed, unchanged, priority-free and missing journeys connect honestly', () => {
  assert.equal(visitor.getWrappedSummary().routeNarrative, null)
  visitor.updateRoute({ days: 7, priorities: ['nature', 'quiet'], order: ['nanning', 'urumqi', 'guiping', 'bayinbuluke'] })
  let story = visitor.getWrappedSummary().routeNarrative
  assert.equal(story.sameOrder, false)
  assert.equal(story.headline, '而你，又改写了我的路线。')
  assert.equal(story.bridge, '你没有照着我的顺序走。')
  assert.equal(story.days, 7)
  assert.equal(story.priorities, '自然 / 安静')
  assert.equal(story.path, '南宁 → 乌鲁木齐 → 桂平 → 巴音布鲁克')
  visitor.updateRoute({ order: visitor.PLACE_IDS })
  story = visitor.getWrappedSummary().routeNarrative
  assert.equal(story.sameOrder, true)
  assert.equal(story.bridge, '你保留了我的顺序，但理由已经不同。')
  assert.ok(!story.headline.includes('改写'))
  visitor.updateRoute({ priorities: [] })
  story = visitor.getWrappedSummary().routeNarrative
  assert.equal(story.priorities, '')
  assert.ok(!story.bridge.includes('理由已经不同'))
  visitor.updateRoute({ order: ['nanning', 'urumqi'], skipped: ['guiping', 'bayinbuluke'] })
  story = visitor.getWrappedSummary().routeNarrative
  assert.equal(story.sameOrder, false)
  assert.equal(story.skipped, '桂平 · 巴音布鲁克')
  const source = (fs.readFileSync(path.join(root, 'pages/index/slides.wxml'), 'utf8') + fs.readFileSync(path.join(root, 'pages/index/details.wxml'), 'utf8'))
  for (const copy of ['学雅思', '保持进度', '照计划走', 'GAMES', 'FRIENDS', 'FOOD', 'TRIPS', '现实赢了。', '现实改写了我的计划。', '轮到你。']) assert.ok(source.includes(copy))
})

function markedTrackGesture(page, index, dx = 0, dy = 0) {
  const mark = { storyControl: 'soundtrack' }
  page.touchStart({ mark, touches: [{ pageX: 200, pageY: 200 }] })
  page.touchEnd({ mark, changedTouches: [{ pageX: 200 + dx, pageY: 200 + dy }] })
  page.selectTrack(event({ index }, { mark }))
  // Even accidental delivery to the outer handler must not turn a tap into navigation.
  page.tapStory({ mark, detail: { x: 200 } })
}

test('PATCH 12: marked card tap sequence 01→02→03→01 and rapid taps never turn pages', () => {
  const page = loadPage('index', { slide: '11' })
  const scores = visitor.calculateVisitorScores()
  for (const index of [0, 1, 2, 0, ...Array.from({ length: 24 }, (_, i) => i % 3)]) {
    markedTrackGesture(page, index)
    assert.equal(page.data.currentSlide, 11)
    assert.equal(page.data.slide.activeTrackIndex, index)
    assert.equal(visitor.loadVisitorState().soundtrack, ['01', '02', '03'][index])
    assert.equal(page.data.slide.soundtrack.tracks.length, 3)
    assert.deepEqual(visitor.calculateVisitorScores(), scores)
  }
  assert.equal(loadPage('index', { slide: '11' }).data.slide.activeTrackIndex, 2)
})

test('PATCH 12: card drag scrolls or swipes without selecting; subsequent tap works', () => {
  const page = loadPage('index', { slide: '11' })
  markedTrackGesture(page, 0)
  markedTrackGesture(page, 1, 0, -140)
  assert.equal(page.data.currentSlide, 11)
  assert.equal(visitor.loadVisitorState().soundtrack, '01')
  markedTrackGesture(page, 1)
  assert.equal(visitor.loadVisitorState().soundtrack, '02')
  markedTrackGesture(page, 2, -150, 0)
  assert.equal(page.data.currentSlide, 12)
  assert.equal(visitor.loadVisitorState().soundtrack, '02')
  page.touchStart({ touches: [{ pageX: 100, pageY: 100 }] })
  page.touchEnd({ changedTouches: [{ pageX: 280, pageY: 100 }] })
  assert.equal(page.data.currentSlide, 11)
  markedTrackGesture(page, 0)
  assert.equal(page.data.slide.activeTrackIndex, 0)
  page.touchStart({ mark: { storyControl: 'soundtrack' }, touches: [{ pageX: 100, pageY: 100 }] })
  page.touchCancel()
  page.selectTrack(event({ index: 2 }))
  assert.equal(visitor.loadVisitorState().soundtrack, '01')
})

test('PATCH 12: actual WXML leaves raw touch to the scroll-view and isolates only card taps', () => {
  const source = (fs.readFileSync(path.join(root, 'pages/index/slides.wxml'), 'utf8') + fs.readFileSync(path.join(root, 'pages/index/details.wxml'), 'utf8'))
  const start = source.indexOf('<view class="sound-controls"')
  const end = source.indexOf('<text class="wrapped-caption">{{trackSaveNotice', start)
  const controls = source.slice(start, end)
  assert.ok(controls.includes('mark:storyControl="soundtrack"'))
  assert.ok(!/catchtouch(start|move|end|cancel)/.test(controls))
  assert.equal((controls.match(/catchtap="selectTrack"/g) || []).length, 2)
  assert.ok(controls.includes('wx:for="{{slide.soundtrack.tracks}}"'))
  assert.ok(controls.includes('已选择'))
  const main = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
  assert.ok(main.includes('scroll-y'))
  assert.ok(main.includes('bindtouchstart="touchStart"'))
  assert.ok(main.includes('bindtouchend="touchEnd"'))
  const css = fs.readFileSync(path.join(root, 'pages/index/index.wxss'), 'utf8')
  assert.ok(css.includes('.sound-controls .sound-rebuild-wave { pointer-events: none; }'))
})
