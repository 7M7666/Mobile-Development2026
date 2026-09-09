const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test, beforeEach } = require('node:test')

const root = path.resolve(__dirname, '../code')
const summer = require('../code/data/summer2026')
const state = require('../code/services/summer-state')
const visitor = require('../code/services/visitor-state')
let storage, calls, pages, pageDefinition
let exportCount

function canvas() {
  const context = new Proxy({ measureText: (text) => ({ width: String(text).length * 24 }) }, {
    get: (target, key) => target[key] || (() => {})
  })
  return {
    getContext: () => context,
    createImage() {
      const image = { width: 640, height: 480 }
      Object.defineProperty(image, 'src', { set(src) {
        assert.ok(fs.existsSync(path.join(root, src)))
        queueMicrotask(() => image.onload())
      } })
      return image
    }
  }
}

function loadPage(name) {
  const file = path.join(root, `pages/${name}/${name}.js`)
  delete require.cache[require.resolve(file)]
  require(file)
  const page = {
    ...pageDefinition,
    data: structuredClone(pageDefinition.data),
    setData(changes, callback) {
      assert.ok(!this.unloaded, 'setData after unload')
      Object.assign(this.data, changes)
      if (callback) callback()
    },
    getPosterCanvas: async () => canvas()
  }
  page.onLoad({})
  if (page.onShow) page.onShow()
  return page
}

function choose(page, place, vibe = 'warm') {
  visitor.updatePin({ place: visitor.PLACE_NAMES[place], vibe: vibe === 'random' ? 'surprise' : vibe })
  visitor.resetCut()
  visitor.setPiece({ type: 'place', place: visitor.PLACE_NAMES[place] })
  page.refreshCut()
  page.goStep({ currentTarget: { dataset: { step: 4 } } })
}

beforeEach(() => {
  storage = {}
  calls = []
  pages = [{ route: 'pages/home/home' }]
  exportCount = 0
  global.Page = (value) => { pageDefinition = value }
  global.getCurrentPages = () => pages
  global.wx = {
    getStorageSync: (key) => storage[key],
    setStorageSync: (key, value) => { storage[key] = structuredClone(value) },
    getWindowInfo: () => ({ windowWidth: 375, windowHeight: 667, screenHeight: 700, safeArea: { bottom: 680 } }),
    getMenuButtonBoundingClientRect: () => ({ bottom: 52 }),
    setBackgroundColor() {}, showLoading() {}, hideLoading() {},
    showModal: (v) => v.success({ confirm: true }),
    showToast: (value) => calls.push(['toast', value.title]),
    previewImage: (value) => calls.push(['preview', value.current]),
    canvasToTempFilePath: (value) => value.success({ tempFilePath: `poster-${++exportCount}.png` }),
    saveImageToPhotosAlbum(value) { calls.push(['save', value.filePath]); value.success() },
    navigateBack: ({ delta = 1 }) => pages.splice(-delta),
    redirectTo: ({ url }) => { pages[pages.length - 1] = { route: url.slice(1) } },
    reLaunch: ({ url }) => { pages = [{ route: url.slice(1) }] }
  }
})

test('all 16 trace variants generate four system photos plus a user place and export/save', async () => {
  assert.equal(summer.photos.length, 33)
  for (const place of summer.places) {
    for (const vibe of ['quiet', 'wild', 'warm', 'random']) {
      const page = loadPage('cut')
      choose(page, place.id, vibe)
      assert.equal(page.data.model.photos.length, 4)
      assert.equal(new Set(page.data.model.photoIds).size, 4)
      assert.deepEqual(page.data.model.photoIds, page.data.model.photos.map((photo) => photo.id))
      assert.equal(page.data.model.piece.place, visitor.PLACE_NAMES[place.id])
      await page.previewPoster()
      const exported = page.data.posterPath
      await page.savePoster()
      assert.equal(page.data.posterPath, exported)
      assert.equal(page.data.posterStatus, 'saved')
    }
  }
  assert.equal(exportCount, 16)
  assert.equal(calls.filter(([type]) => type === 'save').length, 16)
})

test('URUMQI includes all ten photos; keyword aliases remain independent', () => {
  const cut = summer.buildCut({ placeId: 'urumqi' }, 'warm')
  assert.equal(cut.count, 10)
  assert.ok(cut.rankedPhotos.some((photo) => photo.id === 'xinjiang-bbq'))
  assert.equal(summer.buildCut('food', 'warm').query, '美食')
  assert.ok(summer.buildCut('food', 'warm').rankedPhotos.every((photo) => photo.tags.includes('美食')))
})

test('legacy Cut data does not override new recommendations; background instances synchronize', async () => {
  state.saveState({ yourCut: { selectedPlace: 'nanning', selectedVibe: 'warm', resultPhotoIds: ['nanning-old-town'] } })
  const first = loadPage('cut')
  assert.equal(first.data.model.photoIds.length, 4)
  first.goStep({ currentTarget: { dataset: { step: 2 } } })
  first.onShow()
  assert.equal(first.data.step, 2, 'unchanged storage preserves edit step')
  const second = loadPage('cut'); choose(second, 'bayinbuluke'); first.onShow()
  assert.equal(first.data.model.piece.place, '巴音布鲁克')
  assert.deepEqual(first.data.model.photoIds, second.data.model.photoIds)
  await first.resetCut(); assert.equal(first.data.model.piece.type, null)
  assert.equal(loadPage('cut').data.step, 1)
})

test('both poster flows suppress concurrent saves and release the lock', async () => {
  for (const name of ['cut', 'index']) {
    const page = loadPage(name)
    if (name === 'cut') choose(page, 'guiping')
    const before = calls.filter(([type]) => type === 'save').length
    await Promise.all([page.savePoster(), page.savePoster()])
    assert.equal(calls.filter(([type]) => type === 'save').length, before + 1)
    assert.equal(page.posterSaving, false)
    await page.savePoster()
    assert.equal(calls.filter(([type]) => type === 'save').length, before + 2)
  }
})

test('permission failures use valid modal buttons and a modal failure fallback', async () => {
  const originalError = console.error
  console.error = () => {}
  try {
    wx.saveImageToPhotosAlbum = (value) => value.fail({ errMsg: 'auth deny' })
    wx.showModal = (value) => {
      assert.ok(value.confirmText.length <= 4 && value.cancelText.length <= 4)
      value.fail({ errMsg: 'modal failed' })
    }
    for (const name of ['cut', 'index']) {
      const page = loadPage(name)
      if (name === 'cut') choose(page, 'guiping')
      await page.savePoster()
      assert.equal(page.posterSaving, false)
    }
    assert.equal(calls.filter((call) => call[1] === '需要相册权限').length, 2)
  } finally { console.error = originalError }
})

test('Wrapped ignores legacy Cut storage and invalidates its poster for Visitor Cut changes', async () => {
  state.saveState({ yourCut: { selectedPlace: 'guiping', resultPhotoIds: ['guiping-mountain-road'] } })
  const wrapped = loadPage('index')
  wrapped.goTo(13)
  const first = await wrapped.generatePoster()
  state.saveState({ yourCut: { selectedPlace: 'nanning', resultPhotoIds: ['nanning-old-town'] } })
  wrapped.onShow()
  assert.equal(wrapped.data.posterPath, first)
  visitor.updatePin({ place: '巴音布鲁克', vibe: 'nature' })
  wrapped.onShow()
  assert.equal(wrapped.data.posterPath, '')
  assert.equal(wrapped.data.slide.cutModel.pinPlace, '巴音布鲁克')
  await wrapped.savePoster()
  assert.notEqual(wrapped.data.posterPath, first)
  assert.equal(calls.filter(([type]) => type === 'save').at(-1)[1], wrapped.data.posterPath)
})

test('Slide 14 CTA bindings isolate tap and touch while ordinary swipe remains available', async () => {
  const source = fs.readFileSync(path.join(root, 'pages/index/slides.wxml'), 'utf8').split("slide.page == 'final'")[1]
  for (const handler of ['openCut', 'handlePosterAction', 'savePoster', 'replay', 'backToSummer']) {
    assert.match(source, new RegExp('mark:storyControl="cta"[^>]*catchtap="' + handler + '"'))
    const p = loadPage('index'); p.goTo(13)
    const e = { mark: { storyControl: 'cta' }, touches: [{ clientX: 300, clientY: 120 }], changedTouches: [{ clientX: 20, clientY: 120 }], detail: { x: 20 } }
    p.touchStart(e); p.touchEnd(e); p.tapStory(e)
    assert.equal(p.data.currentSlide, 13, handler)
    assert.equal(typeof p[handler], 'function')
  }
  const p = loadPage('index'); p.goTo(13)
  wx.navigateTo = ({ url, complete }) => { pages.push({ route: url.slice(1) }); complete() }
  p.openCut(); assert.equal(pages.at(-1).route, 'pages/cut/cut')
  await p.handlePosterAction(); assert.ok(p.data.posterPath)
  await p.savePoster(); assert.ok(calls.some(([kind]) => kind === 'save'))
  p.replay(); assert.equal(p.data.currentSlide, 0)
  p.touchStart({ touches: [{ clientX: 300, clientY: 120 }] })
  p.touchEnd({ changedTouches: [{ clientX: 20, clientY: 120 }] })
  assert.equal(p.data.currentSlide, 1)
  p.backToSummer(); assert.deepEqual(pages, [{ route: 'pages/home/home' }])
})

test('Wrapped and Cut alternate twenty times in either entry order without stack growth', () => {
  wx.navigateTo = ({ url, complete }) => { pages.push({ route: url.slice(1) }); complete() }
  wx.navigateBack = ({ delta = 1, complete }) => { pages.splice(-delta); if (complete) complete() }
  for (const first of ['index', 'cut']) {
    pages = [{ route: 'pages/home/home' }, { route: `pages/${first}/${first}` }]
    for (let i = 0; i < 20; i++) {
      const a = loadPage(first); first === 'index' ? a.openCut() : a.openWrapped()
      assert.equal(pages.length, 3)
      const second = first === 'index' ? 'cut' : 'index'
      const b = loadPage(second); second === 'index' ? b.openCut() : b.openWrapped()
      assert.equal(pages.length, 2)
      assert.equal(pages.at(-1).route, `pages/${first}/${first}`)
    }
    wx.navigateBack({}); assert.equal(pages.at(-1).route, 'pages/home/home')
  }
})

test('preview completions after hide or hide/show never open an old image in either flow', async () => {
  for (const name of ['cut', 'index']) for (const showAgain of [false, true]) {
    const p = loadPage(name); if (name === 'cut') choose(p, 'guiping')
    let resolve
    p.getPosterCanvas = () => new Promise((r) => { resolve = r })
    const pending = p.previewPoster(); await new Promise(setImmediate)
    p.onHide(); if (showAgain) p.onShow()
    resolve(canvas()); await pending
    assert.equal(p.previewing, false)
  }
  assert.equal(calls.filter(([kind]) => kind === 'preview').length, 0)
})

test('Slide 09 says opened once until a real second photo preview', () => {
  visitor.recordPhotoPreview('bayinbuluke', 'xinjiang-grassland')
  assert.equal(visitor.getWrappedSummary().moment.title, '你打开过的这一刻')
  visitor.recordPhotoPreview('bayinbuluke', 'xinjiang-grassland')
  assert.equal(visitor.getWrappedSummary().moment.title, '你反复打开的这一刻')
})

test('route popup opens over the same slide and isolates gestures', () => {
  const p = loadPage('index'); p.goTo(10)
  p.openDetailSheet({ currentTarget: { dataset: { kind: 'plan' } } }); assert.equal(p.data.detailSheet, '')
  visitor.updateRoute({ days: 5, order: ['nanning', 'guiping', 'urumqi', 'bayinbuluke'] }); p.onShow()
  const route = visitor.loadVisitorState().route
  p.openDetailSheet({ currentTarget: { dataset: { kind: 'plan' } } }); assert.equal(p.data.detailSheet, 'plan')
  p.touchStart({ touches: [{ clientX: 300, clientY: 120 }] }); p.touchEnd({ changedTouches: [{ clientX: 20, clientY: 120 }] })
  p.tapStory({ detail: { x: 300 } }); p.next(); p.previous(); assert.equal(p.data.currentSlide, 10)
  p.closeDetailSheet(); assert.equal(p.data.detailSheet, ''); assert.deepEqual(visitor.loadVisitorState().route, route)
  p.next(); assert.equal(p.data.currentSlide, 11)
})

test('evidence popup retains all evidence and closes on hide or replay', () => {
  visitor.updatePin({ place: '成都', vibe: 'slow' }); const p = loadPage('index'); p.goTo(12)
  const evidence = p.data.slide.visitor.evidence; assert.ok(evidence.length)
  p.openDetailSheet({ currentTarget: { dataset: { kind: 'evidence' } } }); assert.equal(p.data.detailSheet, 'evidence')
  assert.deepEqual(p.data.slide.visitor.evidence, evidence)
  p.onHide(); assert.equal(p.data.detailSheet, ''); p.onShow()
  p.openDetailSheet({ currentTarget: { dataset: { kind: 'evidence' } } }); p.replay(); assert.equal(p.data.detailSheet, '')
})

test('obsolete or unloaded asynchronous poster results do not update pages', async () => {
  for (const name of ['cut', 'index']) {
    const page = loadPage(name)
    if (name === 'cut') choose(page, 'guiping')
    let resolveCanvas
    page.getPosterCanvas = () => new Promise((resolve) => { resolveCanvas = resolve })
    const pending = name === 'cut' ? page.ensurePoster() : page.generatePoster()
    await new Promise(setImmediate)
    if (name === 'cut') choose(page, 'bayinbuluke')
    else {
      visitor.updatePin({ place: '巴音布鲁克', vibe: 'nature' })
      page.onShow()
    }
    resolveCanvas(canvas())
    assert.equal(await pending, '')
    assert.equal(page.data.posterPath, '')
  }
  for (const name of ['cut', 'index']) {
    const page = loadPage(name)
    if (name === 'cut') choose(page, 'guiping')
    let resolveCanvas
    page.getPosterCanvas = () => new Promise((resolve) => { resolveCanvas = resolve })
    const pending = name === 'cut' ? page.ensurePoster() : page.generatePoster()
    await new Promise(setImmediate)
    page.onUnload()
    resolveCanvas(canvas())
    assert.equal(await pending, '')
    assert.equal(page.data.posterPath, '')
  }
})

test('Wrapped tracks remain reachable, replay clears continue, boundaries hold', () => {
  state.saveState({ story: { currentSlide: 6 } })
  const page = loadPage('index')
  assert.equal(page.data.viewportHeight, 667)
  for (let index = 0; index < 14; index++) {
    page.goTo(index)
    assert.equal(page.data.slide.number, String(index + 1).padStart(2, '0'))
    assert.equal(page.data.slide.progressTheme, page.data.slide.background === '#242522' ? 'light' : 'dark')
  }
  page.goTo(11)
  for (const index of [1, 2, 0]) {
    page.selectTrack({ currentTarget: { dataset: { index } } })
    assert.equal(page.data.slide.activeTrackIndex, index)
    assert.deepEqual(page.data.slide.secondaryTracks.map((track) => track.index), [0, 1, 2].filter((i) => i !== index))
  }
  page.replay()
  assert.equal(page.data.canContinue, false)
  assert.equal(page.data.continueSlide, 0)
  page.previous()
  assert.equal(page.data.currentSlide, 0)
  page.goTo(13)
  page.next()
  assert.equal(page.data.currentSlide, 13)
})

test('swipe plus synthetic tap advances only once; cancelled gestures do not advance', () => {
  const page = loadPage('index')
  page.touchStart({ touches: [{ pageX: 200, pageY: 200 }] })
  page.touchEnd({ changedTouches: [{ pageX: 100, pageY: 210 }] })
  page.tapStory({ detail: { x: 300 } })
  assert.equal(page.data.currentSlide, 1)
  page.touchStart({ touches: [{ pageX: 200, pageY: 200 }] })
  page.touchCancel()
  page.touchEnd({ changedTouches: [{ pageX: 100, pageY: 210 }] })
  assert.equal(page.data.currentSlide, 1)
})

test('main navigation reuses stack entries and standalone Cut has an exit', () => {
  let definition
  global.Component = (value) => { definition = value }
  require('../code/components/app-nav/app-nav')
  for (let i = 0; i < 15; i++) {
    pages.push({ route: 'pages/detail/detail' })
    definition.methods.goTo.call({ data: { active: '' } }, { currentTarget: { dataset: { key: 'map' } } })
    assert.equal(pages.length, 1)
  }
  pages.push({ route: 'pages/detail/detail' })
  definition.methods.goTo.call({ data: { active: '' } }, { currentTarget: { dataset: { key: 'me' } } })
  assert.deepEqual(pages, [{ route: 'pages/me/me' }])
  loadPage('cut').goBack()
  assert.deepEqual(pages, [{ route: 'pages/me/me' }])
})
