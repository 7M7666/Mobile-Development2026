const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test, beforeEach } = require('node:test')
const root = path.resolve(__dirname, '../code')
let visitor, cut, poster, storage, pageDef, calls, fileCount, invalid, chooseMode, saveFileFails, confirm, writeFails, drawLog
const event = (dataset = {}, extra = {}) => ({ currentTarget: { dataset }, ...extra })
function fresh(relative) { const p = path.join(root, relative); delete require.cache[require.resolve(p)]; return require(p) }
function canvas(failSource) {
  const ctx = new Proxy({ measureText: (s) => ({ width: Array.from(s).length * 26 }), fillText: (s, x, y) => drawLog.push({ s, x, y }) }, { get: (t, k) => t[k] || (() => {}) })
  return { getContext: () => ctx, createImage() {
    const image = { width: 1200, height: 800 }
    Object.defineProperty(image, 'src', { set(src) {
      assert.ok(src && (src.startsWith('saved-') || fs.existsSync(path.join(root, src))))
      queueMicrotask(() => src === failSource ? image.onerror(Error('read failed')) : image.onload())
    } }); return image
  } }
}
function page() {
  fresh('pages/cut/cut.js')
  const p = { ...pageDef, data: structuredClone(pageDef.data), setData(v) { assert.ok(!this.unloaded); Object.assign(this.data, v) }, getPosterCanvas: async () => canvas() }
  p.onLoad(); return p
}
function textPiece(p, type = 'text', value = '那个晚上，我一点也不想回家。') { p.setData({ editor: type, draft: value }); p.savePiece() }
function ready(p) { textPiece(p); p.goStep(event({ step: 4 })) }
function full() {
  visitor.updatePin({ place: '东京', vibe: 'quiet' }); visitor.updateRoute({ days: 7, priorities: ['nature', 'quiet'], order: ['bayinbuluke', 'urumqi', 'guiping', 'nanning'] })
  visitor.recordDetailVisit('urumqi'); visitor.recordDetailVisit('urumqi'); visitor.recordDwellTime('bayinbuluke', 120)
  visitor.recordDecision('bayinbuluke', 'stop_sunset'); visitor.setSoundtrack('02')
}
beforeEach(() => {
  storage = {}; calls = []; fileCount = 0; invalid = new Set(); chooseMode = 'success'; saveFileFails = false; confirm = true; writeFails = false; drawLog = []
  global.Page = (v) => { pageDef = v }; global.getCurrentPages = () => [{}]
  global.wx = {
    env: { USER_DATA_PATH: 'saved-root' },
    getStorageSync: (key) => structuredClone(storage[key]), setStorageSync: (key, v) => { if (writeFails) throw Error('quota'); storage[key] = structuredClone(v) },
    getWindowInfo: () => ({ windowHeight: 667, screenHeight: 700, safeArea: { bottom: 680 } }), getMenuButtonBoundingClientRect: () => ({ bottom: 52 }),
    showToast: (v) => calls.push(['toast', v.title]), showLoading() {}, hideLoading() {},
    showModal: (v) => { calls.push(['confirm', v.content]); v.success({ confirm }) },
    getImageInfo: (v) => invalid.has(v.src) ? v.fail({ errMsg: 'missing' }) : v.success({ width: 1000, height: 700 }),
    chooseMedia: (v) => { calls.push(['choose', v]); if (chooseMode !== 'success') v.fail({ errMsg: chooseMode }); else v.success({ tempFiles: [{ tempFilePath: 'temp-photo' }] }) },
    getFileSystemManager: () => ({ accessSync() {}, mkdirSync() {}, readdirSync: () => [], unlinkSync() {}, copyFile: (v) => saveFileFails ? v.fail({ errMsg: 'quota' }) : v.success(), access: (v) => invalid.has(v.path) ? v.fail({}) : v.success(), saveFile: (v) => { calls.push(['saveFile', v.tempFilePath]); if (saveFileFails) v.fail({ errMsg: 'quota' }); else v.success({ savedFilePath: 'saved-' + (++fileCount) }) } }),
    canvasToTempFilePath: (v) => { calls.push(['export', v]); v.success({ tempFilePath: 'poster-' + calls.length }) },
    previewImage: (v) => calls.push(['preview', v.current]), saveImageToPhotosAlbum: (v) => { calls.push(['save', v.filePath]); v.success() },
    reLaunch: (v) => calls.push(['relaunch', v.url]), navigateTo: (v) => calls.push(['navigate', v.url])
  }
  visitor = fresh('services/visitor-state.js'); cut = fresh('services/your-cut.js'); poster = fresh('services/summer-poster.js')
})

test('recommendation: sparse/full deterministic, four unique valid resources, soundtrack excluded', () => {
  for (const setup of [() => {}, full]) {
    setup(); const a = cut.recommend(); assert.equal(a.length, 4); assert.equal(new Set(a).size, 4)
    for (let i = 0; i < 10; i++) assert.deepEqual(cut.recommend(), a)
    const model = cut.getModel(); assert.ok(model.photos.every((p) => visitor.PLACE_IDS.includes(p.placeId) && fs.existsSync(path.join(root, p.src))))
    visitor.setSoundtrack('03'); assert.deepEqual(cut.recommend(), a)
  }
})
test('replacement: every place including Bayinbuluke/Urumqi stays in its own valid pool', () => {
  const summer = require('../code/data/summer2026')
  for (const placeId of visitor.PLACE_IDS) {
    const ids = summer.photos.filter((p) => p.placeId === placeId).slice(0, 4).map((p) => p.id)
    visitor.setCut({ photoIds: ids, order: ids }); const model = cut.getModel(); const options = cut.candidates(ids[0])
    assert.ok(options.length); assert.ok(options.every((p) => p.placeId === placeId && !ids.includes(p.id)))
    assert.equal(cut.replace(ids[0], ids[1]), null); assert.equal(cut.replace(ids[0], 'missing'), null)
    const wrong = summer.photos.find((p) => p.placeId !== placeId); assert.equal(cut.replace(ids[0], wrong.id), null)
    cut.replace(ids[0], options[0].id); assert.equal(cut.getModel().order[0], options[0].id)
    assert.equal(new Set(cut.getModel().photoIds).size, 4); assert.notEqual(model.signature, cut.getModel().signature)
  }
})
test('recommendations and kept choices restore across page instances and new runtime', () => {
  const a = page(); const id = a.data.model.photoIds[0]; a.keepPhoto(event({ id })); a.openReplace(event({ id })); a.replacePhoto(event({ id: a.data.candidates[0].id }))
  const ids = a.data.model.photoIds; full(); a.onShow(); assert.deepEqual(a.data.model.photoIds, ids)
  const b = page(); assert.deepEqual(b.data.model.photoIds, ids); assert.equal(b.data.model.trace.length, 4)
  visitor = fresh('services/visitor-state.js'); cut = fresh('services/your-cut.js'); assert.deepEqual(cut.getModel().photoIds, ids)
})
test('photo choose persists saved path, replace and reload; never stores temporary path', async () => {
  const p = page(); await p.editPiece(event({ type: 'photo' }))
  const firstPath = p.data.model.piece.localFilePath; assert.match(firstPath, /^saved-root\/summer2026-pieces\/piece-/); assert.equal(p.data.model.piece.type, 'photo')
  const options = calls.find(([k]) => k === 'choose')[1]; assert.equal(options.count, 1); assert.deepEqual(options.mediaType, ['image'])
  await p.editPiece(event({ type: 'photo' })); assert.notEqual(p.data.model.piece.localFilePath, firstPath); assert.equal(page().data.model.piece.localFilePath, p.data.model.piece.localFilePath)
  assert.equal(storage[visitor.STORAGE_KEY].piece.localFilePath, p.data.model.piece.localFilePath)
})
test('photo cancellation, picker failure, invalid temp and persistence failure preserve current piece', async () => {
  const p = page(); textPiece(p); const before = p.data.model.piece
  for (const mode of ['cancel', 'permission denied', 'invalid', 'save failure']) {
    chooseMode = mode === 'cancel' || mode === 'permission denied' ? mode : 'success'; invalid = new Set(mode === 'invalid' ? ['temp-photo'] : []); saveFileFails = mode === 'save failure'
    await p.editPiece(event({ type: 'photo' })); assert.deepEqual(p.data.model.piece, before); assert.equal(p.data.busy, false)
    if (mode !== 'cancel') assert.match(p.data.notice, /请重新选择/)
  }
})
test('place/text validate trim, empty, Unicode length; Map pin can be reused', async () => {
  visitor.updatePin({ place: '东京' }); const p = page(); await p.editPiece(event({ type: 'place' })); assert.equal(p.data.draft, '东京'); p.usePin(); p.savePiece()
  assert.equal(p.data.model.piece.place, '东京'); textPiece(p, 'place', '  南宁  '); assert.equal(p.data.model.piece.place, '南宁')
  for (const value of ['   ', '地'.repeat(31)]) { textPiece(p, 'place', value); assert.equal(p.data.model.piece.place, '南宁') }
  textPiece(p, 'text', '  那个晚上。  '); assert.equal(p.data.model.piece.text, '那个晚上。'); assert.equal(p.data.model.piece.place, null)
  for (const value of [' ', '夏'.repeat(41)]) { textPiece(p, 'text', value); assert.equal(p.data.model.piece.text, '那个晚上。') }
  textPiece(p, 'text', '夏'.repeat(40)); assert.equal(p.data.model.piece.text.length, 40)
})
test('switch type confirmation/cancel, remove and restore keep exactly one active piece', async () => {
  const p = page(); textPiece(p); confirm = false; await p.editPiece(event({ type: 'place' })); assert.equal(p.data.editor, '')
  confirm = true; await p.editPiece(event({ type: 'place' })); p.setData({ draft: '东京' }); p.savePiece(); assert.equal(p.data.model.piece.text, null)
  p.removePiece(); assert.equal(p.data.model.elements.length, 4); assert.equal(p.data.model.piece.type, null)
  p.restorePiece(); assert.equal(p.data.model.elements.length, 5); assert.equal(p.data.model.piece.place, '东京')
})
test('arrange: repeated/fast native handler drag, cancellation, delayed rects and reload preserve unique slots', () => {
  const p = page(); ready(p); p.goStep(event({ step: 3 }))
  wx.createSelectorQuery = () => { const q = { in() { return q }, selectAll() { return q }, boundingClientRect(cb) { q.cb = cb; return q }, exec() { q.cb(p.data.model.order.map((id, i) => ({ left: 0, right: 100, top: i * 80, bottom: i * 80 + 80 }))) } }; return q }
  for (let i = 0; i < 60; i++) {
    const id = p.data.model.order[0]; p.touchSlotStart(event({ id }, { touches: [{ clientX: 50, clientY: 40 }] })); p.startSlotDrag(event({ id })); p.moveSlotDrag({ touches: [{ clientX: 50, clientY: 360 }] }); p.endSlotDrag(); p.endSlotDrag()
    assert.equal(p.data.model.order[4], id); assert.equal(new Set(p.data.model.order).size, 5); assert.equal(p.data.model.elements.length, 5)
  }
  const before = p.data.model.order; p.touchSlotStart(event({ id: before[0] }, { touches: [{ clientX: 50, clientY: 40 }] })); p.startSlotDrag(event({ id: before[0] })); p.cancelDrag(); p.endSlotDrag(); assert.deepEqual(p.data.model.order, before)
  assert.deepEqual(page().data.model.order, before)
})
test('piece and Cut never affect Visitor Score, evidence or interaction count; reset retains Trace', async () => {
  full(); const before = visitor.loadVisitorState(); const p = page(); ready(p); cut.move('piece', p.data.model.order[0]); await p.resetCut()
  const after = visitor.loadVisitorState(); for (const key of ['pin', 'route', 'decisions', 'behavior', 'scores', 'session', 'soundtrack']) assert.deepEqual(after[key], before[key])
  assert.equal(after.piece.type, null); assert.equal(p.data.posterPath, ''); assert.equal(p.data.step, 1)
  visitor.resetVisitorState(); assert.equal(visitor.loadVisitorState().pin.place, ''); assert.equal(visitor.loadVisitorState().cut.photoIds.length, 0)
})
test('all three piece types render/export with four system photos and user element in every slot', async () => {
  full()
  for (const piece of [{ type: 'photo', localFilePath: 'saved-1' }, { type: 'place', place: '东京' }, { type: 'text', text: '那个晚上，我一点也不想回家。' }]) {
    visitor.setPiece(piece); cut.persist(cut.getModel())
    for (let index = 0; index < 5; index++) {
      cut.move('piece', cut.getModel().order[index]); const model = cut.getModel(); assert.equal(model.elements.length, 5)
      await poster.generateYourCutPoster(canvas(), model)
    }
  }
  assert.equal(calls.filter(([k]) => k === 'export').length, 15); assert.ok(drawLog.some((v) => v.s === 'YOUR PLACE')); assert.ok(drawLog.some((v) => v.s === 'YOUR LINE'))
  assert.ok(drawLog.every((v) => v.y <= 1920)); assert.ok(!drawLog.some((v) => /undefined|N\/A|UNKNOWN/.test(v.s)))
})
test('missing Type/Pin/Route/Soundtrack omit blocks; long Chinese text renders without blank substitute', async () => {
  visitor.setPiece({ type: 'text', text: '夏'.repeat(40) }); assert.deepEqual(cut.getModel().trace, [])
  await poster.generateYourCutPoster(canvas(), cut.getModel())
  assert.ok(drawLog.some((v) => v.s.includes('夏'))); full()
  for (const field of ['pin', 'route', 'soundtrack']) {
    const state = visitor.loadVisitorState(); state[field] = visitor.getDefaultState()[field]; visitor.saveVisitorState(state)
    assert.ok(cut.getModel().trace.every((v) => v.value))
  }
})
test('photo invalid on reentry, cached generation and Canvas read failure stay recoverable', async () => {
  const p = page(); await p.editPiece(event({ type: 'photo' })); p.goStep(event({ step: 4 })); await p.ensurePoster()
  invalid.add(p.data.model.piece.localFilePath); await p.checkPiece(); assert.equal(p.data.posterPath, ''); assert.equal(p.data.pieceInvalid, true)
  assert.equal(await p.ensurePoster(), ''); assert.match(p.data.notice, /请重新选择/)
  invalid.clear(); await p.editPiece(event({ type: 'photo' })); p.goStep(event({ step: 4 })); p.getPosterCanvas = async () => canvas(p.data.model.piece.localFilePath)
  assert.equal(await p.ensurePoster(), ''); assert.match(p.data.notice, /请重新选择/)
  p.getPosterCanvas = async () => canvas(); assert.ok(await p.ensurePoster())
})
test('preview/save and repeated saves use one actual album request, cache reuse is current', async () => {
  const p = page(); ready(p); await p.previewPoster(); const cached = p.data.posterPath
  await Promise.all(Array.from({ length: 12 }, () => p.savePoster()))
  assert.equal(calls.filter(([k]) => k === 'save').length, 1); assert.equal(p.data.posterPath, cached); assert.equal(p.posterSaving, false)
  assert.equal(calls.filter(([k]) => k === 'export').length, 1)
})
test('signature invalidates for every photo/order/Type/Pin/Route/song/piece/path change', async () => {
  const p = page(); ready(p)
  const edits = [
    () => cut.replace(p.data.model.photoIds[0], cut.candidates(p.data.model.photoIds[0])[0].id),
    () => cut.move('piece', p.data.model.order[0]),
    () => visitor.updatePin({ place: '东京', vibe: 'city' }),
    () => visitor.updateRoute({ days: 7, priorities: ['quiet'] }),
    () => visitor.setSoundtrack('02'),
    () => visitor.setPiece({ type: 'place', place: '桂平' }),
    () => visitor.setPiece({ type: 'photo', localFilePath: 'saved-1' }),
    () => visitor.setPiece({ type: 'photo', localFilePath: 'saved-2' })
  ]
  for (const edit of edits) { const old = await p.ensurePoster(); assert.ok(old); edit(); p.refreshCut(); assert.equal(p.data.posterPath, ''); assert.notEqual(await p.ensurePoster(), old) }
})
test('generation edited/unloaded during await never previews or commits stale poster', async () => {
  for (const unload of [false, true]) {
    const p = page(); ready(p); let release
    p.getPosterCanvas = () => new Promise((r) => { release = r })
    const pending = p.previewPoster(); await new Promise(setImmediate)
    if (unload) p.onUnload(); else { visitor.setSoundtrack('03'); p.refreshCut() }
    release(canvas()); await pending; assert.equal(p.data.posterPath, '')
  }
  assert.equal(calls.filter(([k]) => k === 'preview').length, 0)
})
test('storage errors remain visible and successful retry persists piece and arrangement', () => {
  const p = page(); writeFails = true; textPiece(p, 'place', '东京'); assert.match(p.data.notice, /未能写入本地/)
  assert.equal(cut.getModel().piece.place, '东京'); writeFails = false; textPiece(p, 'place', '东京'); assert.equal(storage[visitor.STORAGE_KEY].piece.place, '东京')
})
test('four-step WXML bindings isolate replace controls and share aspect-fill slot geometry', () => {
  const wxml = fs.readFileSync(path.join(root, 'pages/cut/cut.wxml'), 'utf8'); const p = page()
  for (const match of wxml.matchAll(/(?:bind|catch)(?:tap|input|touchstart|touchmove|touchend|touchcancel|longpress)="([A-Za-z]+)"/g)) assert.equal(typeof p[match[1]], 'function', match[1])
  assert.match(wxml, /scroll-y="\{\{!dragId\}\}"/); assert.match(wxml, /mode="aspectFill"/)
  assert.equal(cut.SLOTS.length, 5); assert.ok(cut.SLOTS.every((s) => s.x + s.w <= 100 && s.y + s.h <= 100))
})

test('deferred drag geometry cannot affect a cancelled or newer gesture', () => {
  const p = page(); ready(p); p.goStep(event({ step: 3 })); let callback
  wx.createSelectorQuery = () => { const q = { in() { return q }, selectAll() { return q }, boundingClientRect(cb) { callback = cb; return q }, exec() {} }; return q }
  const before = p.data.model.order.slice(), id = before[0]
  p.touchSlotStart(event({ id }, { touches: [{ clientX: 50, clientY: 40 }] })); p.startSlotDrag(event({ id })); p.cancelDrag()
  callback(before.map((_, i) => ({ left: 0, right: 100, top: i * 80, bottom: i * 80 + 80 }))); p.endSlotDrag()
  assert.deepEqual(p.data.model.order, before); assert.equal(p.data.dragId, '')
})
test('photo removed from any slot restores that slot; reset confirmation cancellation preserves result', async () => {
  const p = page(); await p.editPiece(event({ type: 'photo' })); cut.move('piece', p.data.model.order[0]); p.refreshCut()
  const before = p.data.model.order.slice(); p.removePiece(); assert.equal(p.data.model.elements.length, 4); p.restorePiece()
  assert.deepEqual(p.data.model.order, before); confirm = false; await p.resetCut(); assert.deepEqual(p.data.model.order, before)
})
test('concurrent Canvas exports are serialized so redraw cannot change an in-flight poster', async () => {
  visitor.setPiece({ type: 'place', place: '东京' }); const first = cut.getModel()
  visitor.setPiece({ type: 'text', text: '一起看完这个夏天。' }); const second = cut.getModel()
  const exports = []; wx.canvasToTempFilePath = (v) => exports.push(v)
  const c = canvas(), a = poster.generateYourCutPoster(c, first), b = poster.generateYourCutPoster(c, second)
  await new Promise(setImmediate); assert.equal(exports.length, 1); assert.ok(!drawLog.some((v) => v.s === 'YOUR LINE'))
  exports[0].success({ tempFilePath: 'first.png' }); assert.equal(await a, 'first.png')
  await new Promise(setImmediate); assert.equal(exports.length, 2); exports[1].success({ tempFilePath: 'second.png' }); assert.equal(await b, 'second.png')
})
test('saved-file access failure is detected even when image metadata could still be cached', async () => {
  const p = page(); await p.editPiece(event({ type: 'photo' })); wx.getFileSystemManager = () => ({ access: (v) => v.fail({ errMsg: 'deleted' }) })
  await p.checkPiece(); assert.equal(p.data.pieceInvalid, true); assert.match(p.data.notice, /请重新选择/)
})

test('automatic board follows current ranking after Pin, Route, Type and Behavior edits; KEEP and REPLACE lock it', () => {
  const p = page(), initial = p.data.model.photoIds.slice()
  for (const edit of [() => visitor.updatePin({ place: '巴音布鲁克', vibe: 'nature' }),
    () => visitor.updateRoute({ days: 7, order: ['urumqi', 'guiping', 'nanning', 'bayinbuluke'] }),
    () => visitor.recordDecision('bayinbuluke', 'stop_sunset'), () => visitor.recordDetailVisit('urumqi')]) {
    edit(); p.onShow(); assert.deepEqual(p.data.model.photoIds, cut.recommend())
  }
  assert.notDeepEqual(p.data.model.photoIds, initial)
  const kept = p.data.model.photoIds.slice(); p.keepPhoto(event({ id: kept[0] })); full(); p.onShow()
  assert.deepEqual(p.data.model.photoIds, kept)
  visitor.resetCut(); p.refreshCut(); const id = p.data.model.photoIds[0]
  cut.replace(id, cut.candidates(id)[0].id); const replaced = cut.getModel().photoIds
  visitor.updateRoute({ order: ['nanning', 'guiping', 'bayinbuluke', 'urumqi'] }); p.onShow()
  assert.deepEqual(p.data.model.photoIds, replaced)
})

test('unchanged Cut reentry does not repeatedly write Visitor storage', () => {
  const p = page(); let writes = 0
  const original = wx.setStorageSync
  wx.setStorageSync = (...args) => { writes++; original(...args) }
  for (let i = 0; i < 20; i++) p.onShow()
  assert.equal(writes, 0)
})

test('late picker callback cannot overwrite a newer Piece, including change and change back', async () => {
  for (const restore of [false, true]) {
    const p = page(); textPiece(p); const before = visitor.loadVisitorState().piece
    let picker; wx.chooseMedia = (v) => { picker = v }
    const pending = p.editPiece(event({ type: 'photo' })); await new Promise(setImmediate)
    visitor.setPiece({ type: 'place', place: '新的地点' }); if (restore) visitor.setPiece(before)
    const expected = visitor.loadVisitorState().piece
    picker.success({ tempFiles: [{ tempFilePath: 'temp-photo' }] }); await pending
    assert.deepEqual(visitor.loadVisitorState().piece, expected); assert.equal(p.data.busy, false)
  }
})

test('drag selector result after unload cannot setData or change arrangement', () => {
  const p = page(); ready(p); p.goStep(event({ step: 3 })); let callback
  wx.createSelectorQuery = () => { const q = { in() { return q }, selectAll() { return q }, boundingClientRect(cb) { callback = cb; return q }, exec() {} }; return q }
  const before = p.data.model.order.slice(), id = before[0]
  p.touchSlotStart(event({ id }, { touches: [{ clientX: 50, clientY: 40 }] })); p.startSlotDrag(event({ id })); p.onUnload()
  callback(before.map((_, i) => ({ left: 0, right: 100, top: i * 80, bottom: i * 80 + 80 })))
  assert.deepEqual(cut.getModel().order, before)
})

test('owned photo cleanup protects live, durable, undo and in-flight references and external files', async () => {
  const files = require('../code/services/piece-files'), disk = new Set(), removed = []
  wx.getFileSystemManager = () => ({ accessSync() {}, access: (v) => disk.has(v.path) ? v.success() : v.fail({}),
    mkdirSync() {}, copyFile(v) { disk.add(v.destPath); v.success() },
    readdirSync: () => [...disk].map((p) => p.split('/').at(-1)).concat('unrelated.jpg'),
    unlinkSync(p) { removed.push(p); disk.delete(p) } })
  const a = await files.save('album-original'); visitor.setPiece({ type: 'photo', localFilePath: a }); files.release(a)
  const p = page(); p.removePiece(); assert.ok(disk.has(a), 'undo retains photo'); p.restorePiece(); assert.ok(disk.has(a))
  files.retain(a); visitor.setPiece({ type: 'text', text: '新的内容' }); assert.ok(disk.has(a), 'renderer retains photo')
  files.release(a); assert.ok(!disk.has(a))
  const b = await files.save('album-original'); visitor.setPiece({ type: 'photo', localFilePath: b }); files.release(b)
  writeFails = true; visitor.setPiece({ type: 'text', text: '暂存内容' }); files.collect(); assert.ok(disk.has(b), 'durable reference retained')
  writeFails = false; visitor.setPiece({ type: 'text', text: '已保存内容' }); files.collect(); assert.ok(!disk.has(b))
  const abandoned = await files.save('album-original'); files.release(abandoned); assert.ok(!disk.has(abandoned))
  assert.ok(removed.every(files.owned)); assert.ok(!removed.some((p) => p.endsWith('unrelated.jpg')))
  assert.equal(files.owned('album-original'), false)
})

test('multiline quote stays clipped and within its block in all five slots', async () => {
  visitor.setPiece({ type: 'text', text: Array(20).fill('夏').join('\n') }); cut.persist(cut.getModel())
  let checked = 0
  for (let i = 0; i < 5; i++) {
    cut.move('piece', cut.getModel().order[i])
    const c = canvas(), stack = []; let clip = null, pendingRect = null, font = ''
    const ctx = new Proxy({ measureText: (s) => ({ width: s.length * (parseFloat(font.split(' ')[1]) || 20) }),
      save() { stack.push(clip) }, restore() { clip = stack.pop() }, rect(x, y, w, h) { pendingRect = { x, y, w, h } }, clip() { clip = pendingRect },
      fillText(s, x, y) { if (clip) { checked++; assert.ok(x >= clip.x && y <= clip.y + clip.h); assert.ok(parseFloat(font.split(' ')[1]) >= 14) } }
    }, { get: (t, k) => k === 'font' ? font : t[k] || (() => {}), set(t, k, v) { if (k === 'font') font = v; else t[k] = v; return true } })
    c.getContext = () => ctx; await poster.generateYourCutPoster(c, cut.getModel())
  }
  assert.ok(checked > 5)
})
