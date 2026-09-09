const STORAGE_KEY = 'summer2026_visitor_v1'
const situations = require('../data/visitor-situations')
const summer = require('../data/summer2026')
const tracks = summer.curation.soundtrack.tracks
const PLACE_IDS = ['nanning', 'guiping', 'urumqi', 'bayinbuluke']
const photos = require('../data/summer2026').photos.filter((photo) => PLACE_IDS.includes(photo.placeId))
const photoById = photos.reduce((result, photo) => { result[photo.id] = photo; return result }, {})
const PLACE_NAMES = { nanning: '南宁', guiping: '桂平', urumqi: '乌鲁木齐', bayinbuluke: '巴音布鲁克' }
const VIBES = [
  { id: 'quiet', label: '安静', en: 'QUIET' },
  { id: 'wild', label: '野一点', en: 'WILD' },
  { id: 'warm', label: '温暖', en: 'WARM' },
  { id: 'city', label: '城市', en: 'CITY' },
  { id: 'slow', label: '慢下来', en: 'SLOW' },
  { id: 'surprise', label: '随机一点', en: 'SURPRISE' }
]
const PRIORITIES = [
  { id: 'nature', label: '自然' }, { id: 'food', label: '吃' },
  { id: 'city', label: '城市' }, { id: 'quiet', label: '安静' },
  { id: 'adventure', label: '冒险' }, { id: 'people', label: '人' },
  { id: 'random', label: '随机' }, { id: 'comfort', label: '舒适' }
]
let memory = null
let pendingWrite = false
let pieceRevision = 0
let pieceFingerprint = null
function getPieceRevision() {
  const fingerprint = JSON.stringify(loadVisitorState().piece)
  if (fingerprint !== pieceFingerprint) { pieceFingerprint = fingerprint; pieceRevision += 1 }
  return pieceRevision
}
const copy = (value) => JSON.parse(JSON.stringify(value))
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const text = (value, max) => typeof value === 'string' ? Array.from(value.trim()).slice(0, max).join('') : ''
const count = (value) => Number.isFinite(value) && value >= 0 ? value : 0
const unique = (value, allowed) => Array.isArray(value) ? [...new Set(value.filter((id) => allowed.includes(id)))] : []

function getDefaultState() {
  return {
    version: 1,
    pin: { place: '', vibe: '', note: '' },
    route: { days: null, priorities: [], order: [], skipped: [] },
    decisions: { nanning: null, guiping: null, urumqi: null, bayinbuluke: null },
    behavior: { detailVisits: {}, photoPreviews: {}, dwellTime: {}, revisitCount: {} },
    scores: { nature: 0, city: 0, quiet: 0, social: 0, planned: 0, spontaneous: 0 },
    soundtrack: null,
    piece: { type: null, value: null, localFilePath: null, place: null, text: null },
    cut: { photoIds: [], order: [], kept: [], automatic: true },
    session: { startedAt: null, interactionCount: 0 }
  }
}

function normalizeRoute(value) {
  const route = object(value)
  const days = [3, 5, 7].includes(route.days) ? route.days : null
  const skipped = unique(route.skipped, PLACE_IDS)
  const order = unique(route.order, PLACE_IDS).filter((id) => !skipped.includes(id))
  if (days || order.length || skipped.length) {
    PLACE_IDS.forEach((id) => { if (!order.includes(id) && !skipped.includes(id)) order.push(id) })
  }
  return { days, priorities: unique(route.priorities, PRIORITIES.map((item) => item.id)).slice(0, 2), order, skipped }
}

function normalize(value) {
  const state = getDefaultState()
  const raw = object(value)
  if (raw.version !== undefined && raw.version !== 1) return state
  const pin = object(raw.pin)
  state.pin = { place: text(pin.place, 30), vibe: VIBES.some((item) => item.id === pin.vibe) ? pin.vibe : '', note: text(pin.note, 40) }
  if (!state.pin.place) state.pin = getDefaultState().pin
  state.route = normalizeRoute(raw.route)
  PLACE_IDS.forEach((id) => {
    const choice = object(raw.decisions)[id]
    state.decisions[id] = situations[id].choices.some((item) => item.id === choice) ? choice : null
  })
  Object.keys(state.behavior).forEach((key) => {
    const values = object(object(raw.behavior)[key])
    const allowed = key === 'photoPreviews' ? photos.map((photo) => photo.id) : PLACE_IDS
    Object.keys(values).filter((id) => allowed.includes(id)).forEach((id) => {
      const value = Math.min(count(values[id]), 1000000000)
      if (value > 0) state.behavior[key][id] = key === 'dwellTime' ? value : Math.floor(value)
    })
  })
  state.behavior.revisitCount = {}
  PLACE_IDS.forEach((id) => {
    const visits = state.behavior.detailVisits[id] || 0
    if (visits > 1) state.behavior.revisitCount[id] = visits - 1
  })
  state.soundtrack = tracks.some((track) => track.number === raw.soundtrack) ? raw.soundtrack : null
  const piece = object(raw.piece)
  if (piece.type === 'photo' && text(piece.localFilePath, 2048)) state.piece = { ...state.piece, type: 'photo', localFilePath: text(piece.localFilePath, 2048) }
  if (piece.type === 'place' && text(piece.place, 30)) state.piece = { ...state.piece, type: 'place', place: text(piece.place, 30) }
  if (piece.type === 'text' && text(piece.text, 40)) state.piece = { ...state.piece, type: 'text', text: text(piece.text, 40) }
  const cut = object(raw.cut)
  const photoIds = unique(cut.photoIds, photos.map((photo) => photo.id)).slice(0, 4)
  state.cut = { photoIds, automatic: typeof cut.automatic === 'boolean' ? cut.automatic : photoIds.length !== 4, order: unique(cut.order, photoIds.concat(state.piece.type ? ['piece'] : [])), kept: unique(cut.kept, photoIds) }
  const session = object(raw.session)
  state.session = { startedAt: count(session.startedAt) || null, interactionCount: Math.floor(count(session.interactionCount)) }
  state.scores = scoreSignals(state).scores
  return state
}

function loadVisitorState() {
  if (pendingWrite && memory) return copy(memory)
  try { memory = normalize(wx.getStorageSync(STORAGE_KEY)) } catch (error) { memory = memory || getDefaultState() }
  return copy(memory)
}

function saveVisitorState(value) {
  memory = normalize(value === undefined ? loadVisitorState() : value)
  try {
    wx.setStorageSync(STORAGE_KEY, copy(memory))
    pendingWrite = false
    const fingerprint = JSON.stringify(memory.piece)
    if (fingerprint !== pieceFingerprint) { pieceFingerprint = fingerprint; pieceRevision += 1 }
    require('./piece-files').collect()
    return true
  } catch (error) {
    pendingWrite = true
    const fingerprint = JSON.stringify(memory.piece)
    if (fingerprint !== pieceFingerprint) { pieceFingerprint = fingerprint; pieceRevision += 1 }
    return false
  }
}

function resetVisitorState() { return saveVisitorState(getDefaultState()) }

function updateSection(key, value) {
  const previous = loadVisitorState()
  const next = normalize({ ...previous, [key]: { ...previous[key], ...object(value) } })
  const changed = JSON.stringify(previous[key]) !== JSON.stringify(next[key])
  if (changed) {
    next.session.startedAt = previous.session.startedAt || Date.now()
    next.session.interactionCount += 1
  }
  const persisted = saveVisitorState(next)
  return { state: copy(memory), persisted, changed }
}
function updatePin(value) { return updateSection('pin', value) }
function updateRoute(value) { return updateSection('route', value) }

function setPiece(value) {
  const piece = object(value)
  if (piece.type === 'place' && (!text(piece.place, 30) || Array.from(piece.place.trim()).length > 30)) return { ...rejectedUpdate(), valid: false }
  if (piece.type === 'text' && (!text(piece.text, 40) || Array.from(piece.text.trim()).length > 40)) return { ...rejectedUpdate(), valid: false }
  if (piece.type === 'photo' && !text(piece.localFilePath, 2048)) return { ...rejectedUpdate(), valid: false }
  if (piece.type && !['photo', 'place', 'text'].includes(piece.type)) return { ...rejectedUpdate(), valid: false }
  const state = loadVisitorState()
  const persisted = saveVisitorState({ ...state, piece: { ...getDefaultState().piece, ...piece } })
  return { state: copy(memory), persisted, valid: true }
}
function setCut(value) {
  const state = loadVisitorState()
  const persisted = saveVisitorState({ ...state, cut: value })
  return { state: copy(memory), persisted }
}
function resetCut() {
  const state = loadVisitorState()
  return saveVisitorState({ ...state, cut: getDefaultState().cut, piece: getDefaultState().piece })
}

function rejectedUpdate() { return { state: loadVisitorState(), persisted: !pendingWrite, changed: false } }
function recordDecision(placeId, choice) {
  if (!PLACE_IDS.includes(placeId) || !situations[placeId].choices.some((item) => item.id === choice)) return rejectedUpdate()
  return updateSection('decisions', { [placeId]: choice })
}
function recordDetailVisit(placeId) {
  if (!PLACE_IDS.includes(placeId)) return rejectedUpdate()
  const behavior = loadVisitorState().behavior
  return updateSection('behavior', { detailVisits: { ...behavior.detailVisits, [placeId]: (behavior.detailVisits[placeId] || 0) + 1 } })
}
function recordPhotoPreview(placeId, photoId) {
  if (!PLACE_IDS.includes(placeId) || !Object.prototype.hasOwnProperty.call(photoById, photoId) || photoById[photoId].placeId !== placeId) return rejectedUpdate()
  const behavior = loadVisitorState().behavior
  return updateSection('behavior', { photoPreviews: { ...behavior.photoPreviews, [photoId]: (behavior.photoPreviews[photoId] || 0) + 1 } })
}
function recordDwellTime(placeId, duration) {
  if (!PLACE_IDS.includes(placeId) || !Number.isFinite(duration) || duration <= 0) return rejectedUpdate()
  const state = loadVisitorState()
  const dwellTime = { ...state.behavior.dwellTime, [placeId]: (state.behavior.dwellTime[placeId] || 0) + Math.min(duration, 600) }
  // 停留是时间测量，不另计一次用户交互。
  const next = normalize({ ...state, behavior: { ...state.behavior, dwellTime } })
  const persisted = saveVisitorState(next)
  return { state: copy(memory), persisted, changed: true }
}

function attentionFrom(state) {
  function top(values, ids) {
    const maximum = Math.max(0, ...ids.map((id) => values[id] || 0))
    if (!maximum) return null
    const tiedIds = ids.filter((id) => values[id] === maximum)
    const id = tiedIds[0]
    return { placeId: id, name: PLACE_NAMES[id], count: maximum, tiedIds, tied: tiedIds.length > 1 }
  }
  const mostVisited = top(state.behavior.detailVisits, PLACE_IDS)
  const mostRevisited = top(state.behavior.revisitCount, PLACE_IDS)
  const longestDwell = top(state.behavior.dwellTime, PLACE_IDS)
  const previewTop = top(state.behavior.photoPreviews, photos.map((photo) => photo.id))
  const mostPreviewedPhoto = previewTop ? {
    ...photoById[previewTop.placeId], count: previewTop.count,
    tied: previewTop.tied, tiedIds: previewTop.tiedIds,
    placeName: PLACE_NAMES[photoById[previewTop.placeId].placeId]
  } : null
  return { mostVisited, mostRevisited, mostPreviewedPhoto, longestDwell,
    hasData: Boolean(mostVisited || mostPreviewedPhoto || longestDwell) }
}
function getAttentionSummary(value) { return attentionFrom(normalize(value === undefined ? loadVisitorState() : value)) }
function getChoiceSummary(value) {
  const state = normalize(value === undefined ? loadVisitorState() : value)
  const items = PLACE_IDS.map((placeId) => {
    const situation = situations[placeId]
    const choice = situation.choices.find((item) => item.id === state.decisions[placeId])
    const comparison = situation.choices.find((item) => item.id === situation.comparisonChoice)
    return { placeId, name: PLACE_NAMES[placeId], choice: choice ? choice.id : null,
      label: choice ? choice.label : '还没有选择', comparisonChoice: comparison.id,
      comparisonLabel: comparison.label, comparisonKind: situation.comparisonKind,
      same: choice ? choice.id === comparison.id : null }
  })
  const completed = items.filter((item) => item.choice).length
  const same = items.filter((item) => item.same === true).length
  return { items, completed, total: 4, same, different: completed - same }
}

function scoreSignals(state) {
  const explicit = getDefaultState().scores
  const implicit = getDefaultState().scores
  const evidence = []
  function add(weights, message, type) {
    Object.keys(weights).forEach((key) => { explicit[key] += weights[key] })
    evidence.push({ type, text: message, reason: message, weights })
  }
  const vibeWeights = { quiet: { quiet: 3 }, wild: { spontaneous: 3, nature: 1 }, warm: { social: 1, quiet: 1 }, city: { city: 3, social: 1 }, slow: { quiet: 3, planned: 1 }, surprise: { spontaneous: 3 } }
  const priorityWeights = { nature: { nature: 4 }, food: { city: 1, social: 2 }, city: { city: 4 }, quiet: { quiet: 4 }, adventure: { spontaneous: 3, nature: 1 }, people: { social: 4 }, random: { spontaneous: 4 }, comfort: { planned: 2, quiet: 1 } }
  state.route.priorities.forEach((id) => add(priorityWeights[id], '路线优先考虑“' + PRIORITIES.find((item) => item.id === id).label + '”。', 'priority'))
  const route = state.route
  if (route.order.length) {
    const first = route.order[0]
    add(first === 'bayinbuluke' ? { nature: 2 } : first === 'urumqi' ? { city: 2 } : {}, '你把' + PLACE_NAMES[first] + '排在第一站。', 'route_first')
    if (route.order.length === 4) add({ planned: 2 }, '你保留了四个地点，并排好了顺序。', 'route_keep')
    if (route.days === 3 && route.order.length <= 2) add({ quiet: 1 }, '你在三天的路线里只保留了' + route.order.length + '个地点。', 'route_slow')
  }
  if (route.skipped.length >= 2) add({ spontaneous: 1 }, '你跳过了' + route.skipped.map((id) => PLACE_NAMES[id]).join('、') + '，重新取舍了路线。', 'route_skip')
  PLACE_IDS.forEach((placeId) => {
    const choice = situations[placeId].choices.find((item) => item.id === state.decisions[placeId])
    if (choice) add(choice.weights, '在' + PLACE_NAMES[placeId] + '的情境里，你选择了“' + choice.label + '”。', 'decision')
  })
  const vibe = VIBES.find((item) => item.id === state.pin.vibe)
  if (state.pin.place && vibe) add(vibeWeights[vibe.id], '你给“' + state.pin.place + '”选择了“' + vibe.label + '”。', 'pin')
  else if (state.pin.place) add({}, '你在地图旁留下了“' + state.pin.place + '”。', 'pin')

  const placeDimension = { nanning: 'city', guiping: 'social', urumqi: 'city', bayinbuluke: 'nature' }
  PLACE_IDS.forEach((id) => { if ((state.behavior.detailVisits[id] || 0) > 1) implicit[placeDimension[id]] += 0.5 })
  const previewTotals = getDefaultState().scores
  photos.forEach((photo) => {
    const dimension = /自然|草原|湖|山|风景/.test((photo.tags || []).join(' ')) ? 'nature' : placeDimension[photo.placeId]
    previewTotals[dimension] += state.behavior.photoPreviews[photo.id] || 0
  })
  Object.keys(implicit).forEach((key) => { if (previewTotals[key] >= 2) implicit[key] += 1 })
  const attention = attentionFrom(state)
  // 满一分钟才贡献分数；并列最长按地点固定顺序取一处，避免重复加权。
  if (attention.longestDwell && attention.longestDwell.count >= 60) implicit[placeDimension[attention.longestDwell.placeId]] += 1
  const scores = {}
  Object.keys(explicit).forEach((key) => { implicit[key] = Math.min(2, implicit[key]); scores[key] = explicit[key] + implicit[key] })
  if (attention.mostRevisited) evidence.push({ type: 'attention', text: '你最常回到' + attention.mostRevisited.name + (attention.mostRevisited.tied ? '（并列）' : '') + '。' })
  if (attention.mostPreviewedPhoto) evidence.push({ type: 'attention', text: '你打开最多次的照片是“' + attention.mostPreviewedPhoto.title + '”' + (attention.mostPreviewedPhoto.tied ? '（并列）' : '') + '。' })
  if (attention.longestDwell) evidence.push({ type: 'attention', text: '你在' + attention.longestDwell.name + '停留得最久' + (attention.longestDwell.tied ? '（并列）' : '') + '。' })
  if (!evidence.length && attention.mostVisited) evidence.push({ type: 'attention', text: '你打开过' + attention.mostVisited.name + '的地点记录。' })
  return { scores, explicit, implicit, evidence }
}

function calculateVisitorScores(value) { return scoreSignals(normalize(value === undefined ? loadVisitorState() : value)).scores }
function getNormalizedScores(value) {
  const scores = calculateVisitorScores(value)
  const normalized = {}
  Object.keys(scores).forEach((key) => { normalized[key] = Math.round(100 * scores[key] / (scores[key] + 8)) })
  return normalized
}
function getVisitorEvidence(value) {
  const state = normalize(value === undefined ? loadVisitorState() : value)
  const signals = scoreSignals(state)
  const priorityEvidence = signals.evidence.filter((item) => item.type === 'priority')
  if (priorityEvidence.length > 1) {
    signals.evidence = signals.evidence.filter((item) => item.type !== 'priority')
    signals.evidence.unshift({ type: 'priority', text: '路线优先考虑“' + state.route.priorities.map((id) => PRIORITIES.find((item) => item.id === id).label).join('”和“') + '”。' })
  }
  const exploring = PLACE_IDS.filter((id) => ['go_random', 'keep_exploring', 'change_plan'].includes(state.decisions[id]))
  if (exploring.length >= 2) {
    signals.evidence = signals.evidence.filter((item) => item.type !== 'decision')
    signals.evidence.push({ type: 'decision', text: '在' + exploring.map((id) => PLACE_NAMES[id]).join('、') + '的' + exploring.length + '个情境里，你选择了继续探索或临时改变计划。' })
  }
  // 类别优先，类别内取实际贡献最大的证据；最多五条，稀疏数据不凑数。
  const priorities = ['priority', 'route_first', 'route_skip', 'route_keep', 'route_slow', 'decision', 'pin', 'attention']
  const representatives = []
  priorities.forEach((type) => {
    const items = signals.evidence.filter((item) => item.type === type)
    items.sort((a, b) => Object.values(b.weights || {}).reduce((x, y) => x + y, 0) - Object.values(a.weights || {}).reduce((x, y) => x + y, 0))
    if (items.length) representatives.push(items[0])
  })
  return representatives.slice(0, 5).map((item) => ({ ...item, reason: item.text }))
}
function getVisitorType(value) {
  const state = normalize(value === undefined ? loadVisitorState() : value)
  const signals = scoreSignals(state)
  // 有显式偏好时由显式分数决定类型，浏览不能推翻主动选择；纯浏览才使用隐式分数。
  const scores = Object.values(signals.explicit).some((score) => score > 0) ? signals.explicit : signals.implicit
  if (!Object.values(scores).some((score) => score > 0)) return null
  const types = [
    { id: 'quiet-wanderer', label: '安静的漫游者', en: 'THE QUIET WANDERER', description: '你更容易被自然、慢节奏和临时发生的瞬间留下。', score: scores.nature * 0.75 + Math.min(scores.nature, scores.quiet) * 1.25 + Math.min(scores.nature, scores.spontaneous) * 0.25 },
    { id: 'city-explorer', label: '城市探索者', en: 'THE CITY EXPLORER', description: '你更愿意通过街道、食物和人与城市建立联系。', score: scores.city + scores.social * 0.75 },
    { id: 'off-script', label: '随性旅行者', en: 'THE OFF-SCRIPT TRAVELER', description: '你并不急着把旅行按计划走完，临时改变往往更吸引你。', score: scores.spontaneous * 1.2 },
    { id: 'slow-observer', label: '慢旅行观察者', en: 'THE SLOW OBSERVER', description: '你不一定想去最多的地方，但愿意把时间留在少数几个瞬间。', score: scores.quiet + Math.min(scores.quiet, scores.planned) * 0.25 },
    { id: 'route-maker', label: '路线设计者', en: 'THE ROUTE MAKER', description: '你会先决定怎么走，再把每一站放到自己的节奏里。', score: scores.planned * 1.25 }
  ]
  // 同分固定优先级就是上面的数组顺序。
  return types.reduce((best, item) => item.score > best.score ? item : best)
}

function getVibeMatch(pin) {
  // 每一行按 PLACE_IDS 排列，分值为预设体验相似度 / 100，与距离或概率无关。
  const weights = { quiet: [40, 65, 30, 90], wild: [40, 45, 75, 90], warm: [75, 90, 65, 50], city: [80, 55, 95, 20], slow: [55, 75, 35, 90], surprise: [55, 45, 90, 80] }
  const reasons = { quiet: '巴音布鲁克的草原、湖泊与自然风景最贴近安静的感觉', wild: '巴音布鲁克的开阔草原与公路最贴近野一点的感觉', warm: '桂平的家乡与相聚记忆最贴近温暖的感觉', city: '乌鲁木齐的城市街巷与美食最贴近城市的感觉', slow: '巴音布鲁克的自然风景最适合慢下来', surprise: '乌鲁木齐的街巷与不同美食最适合随机探索' }
  const vibe = VIBES.find((item) => item.id === object(pin).vibe)
  if (!object(pin).place || !vibe) return null
  const row = weights[vibe.id]
  const percent = Math.max(...row)
  const placeId = PLACE_IDS[row.indexOf(percent)]
  return { placeId, name: PLACE_NAMES[placeId], percent, reason: `你选择了“${vibe.label}”；${reasons[vibe.id]}。固定匹配规则给出 ${percent}/100 分，仅表示体验相似度。` }
}

function buildRoute(value) {
  const route = normalizeRoute(value)
  if (!route.days || !route.order.length) return []
  const selected = route.order.slice(0, route.days)
  const extra = route.days - selected.length
  const result = []
  selected.forEach((id, index) => {
    const stays = 1 + (index === 0 ? extra : 0)
    for (let i = 0; i < stays; i += 1) result.push({ day: String(result.length + 1).padStart(2, '0'), placeId: id, name: PLACE_NAMES[id] })
  })
  return result
}

function setSoundtrack(trackId) {
  if (!tracks.some((track) => track.number === trackId)) return rejectedUpdate()
  const state = loadVisitorState()
  const changed = state.soundtrack !== trackId
  state.soundtrack = trackId
  if (changed) {
    state.session.startedAt = state.session.startedAt || Date.now()
    state.session.interactionCount += 1
  }
  const persisted = saveVisitorState(state)
  return { state: copy(memory), persisted, changed }
}

function getWrappedSummary(value) {
  const state = normalize(value === undefined ? loadVisitorState() : value)
  const attention = getAttentionSummary(state)
  const routeDays = buildRoute(state.route)
  const routeIds = [...new Set(routeDays.map((day) => day.placeId))]
  const route = routeDays.length ? {
    days: state.route.days, stops: routeIds.map((id) => ({ id, name: PLACE_NAMES[id] })),
    path: routeIds.map((id) => PLACE_NAMES[id]).join(' → '),
    skipped: state.route.skipped.map((id) => PLACE_NAMES[id]).join(' · ')
  } : null
  const vibe = VIBES.find((item) => item.id === state.pin.vibe)
  const pin = state.pin.place ? { ...state.pin, vibeLabel: vibe ? vibe.label + ' · ' + vibe.en : '' } : null
  const vibeMatch = getVibeMatch(state.pin)
  const visitedFocus = attention.mostVisited && !attention.mostVisited.tied ? attention.mostVisited : null
  const dwellFocus = attention.longestDwell && attention.longestDwell.count >= 60 && !attention.longestDwell.tied ? attention.longestDwell : null
  const previewFocus = attention.mostPreviewedPhoto && !attention.mostPreviewedPhoto.tied ? attention.mostPreviewedPhoto : null
  const revisitFocus = attention.mostRevisited && !attention.mostRevisited.tied ? attention.mostRevisited : null
  const emphasisId = state.route.order[0] || (revisitFocus || dwellFocus || previewFocus || visitedFocus || {}).placeId || null
  const emphasis = emphasisId ? {
    placeId: emphasisId,
    text: state.route.order.length ? '你把' + PLACE_NAMES[emphasisId] + '排在第一站。' : '你的浏览痕迹更多地留在了' + PLACE_NAMES[emphasisId] + '。'
  } : null
  const attentionMatch = revisitFocus || dwellFocus || previewFocus || visitedFocus
  const match = vibeMatch ? { ...vibeMatch, source: 'vibe' } : attentionMatch ? {
    placeId: attentionMatch.placeId, name: PLACE_NAMES[attentionMatch.placeId], source: 'attention', reason: '来自你已留下的地点浏览记录。'
  } : null
  const decision = getChoiceSummary(state).items.find((item) => item.placeId === 'bayinbuluke' && item.choice) || null
  let moment = null
  if (attention.mostPreviewedPhoto) {
    const photo = attention.mostPreviewedPhoto
    moment = { photo, source: 'preview', title: photo.count >= 2 ? '你反复打开的这一刻' : '你打开过的这一刻',
      caption: photo.title, reason: '这张照片，是你回看最多的' + (photo.tied ? '照片之一。' : '一张。'),
      detail: '你一共打开了它 ' + photo.count + ' 次。' }
  } else {
    const returning = attention.mostRevisited || (attention.mostVisited && attention.mostVisited.count > 1 ? attention.mostVisited : null)
    const dwelling = attention.longestDwell && attention.longestDwell.count >= 60 ? attention.longestDwell : null
    const focus = returning || dwelling
    const journey = focus && summer.journeys.find((item) => item.placeId === focus.placeId)
    const photo = journey && photoById[journey.coverPhotoId]
    if (photo) moment = returning ? {
      photo, source: 'revisit', title: '你总会回到这里', caption: focus.name,
      reason: '你最常重新打开的' + (focus.tied ? '地方之一是' : '是') + focus.name + '。',
      detail: '不是某一张照片，而是这个地方本身一次次把你带了回来。'
    } : {
      photo, source: 'dwell', title: '你在这里停得最久', caption: focus.name,
      reason: '在所有地点里，你把最多时间留在了' + focus.name + (focus.tied ? '，也留在了另外几站。' : '。'), detail: ''
    }
  }
  const sameOrder = JSON.stringify(state.route.order) === JSON.stringify(summer.timeline.stopIds)
  const routeNarrative = route ? {
    sameOrder, days: state.route.days, path: route.path, skipped: route.skipped,
    priorities: state.route.priorities.map((id) => PRIORITIES.find((item) => item.id === id).label).join(' / '),
    headline: sameOrder ? '而你，保留了我的路线顺序。' : '而你，又改写了我的路线。',
    bridge: sameOrder ? (state.route.priorities.length ? '你保留了我的顺序，但理由已经不同。' : '你保留了我的顺序，把节奏留给自己。') : '你没有照着我的顺序走。'
  } : null
  const normalizedScores = getNormalizedScores(state)
  const signalLabels = { nature: '自然', city: '城市', quiet: '安静', social: '社交', planned: '计划', spontaneous: '随性' }
  const signals = Object.keys(signalLabels).map((id, index) => ({ id, label: signalLabels[id], value: normalizedScores[id], index }))
    .sort((a, b) => b.value - a.value || a.index - b.index)
  const soundtrackIndex = tracks.findIndex((track) => track.number === state.soundtrack)
  const soundtrack = soundtrackIndex >= 0 ? { ...tracks[soundtrackIndex], index: soundtrackIndex } : null
  return {
    hasTrace: Boolean(pin || state.route.order.length || state.route.priorities.length || state.route.skipped.length || state.route.days || getChoiceSummary(state).completed || attention.hasData || soundtrack),
    interactionCount: state.session.interactionCount,
    // startedAt 是首次互动时间，并非前台使用时长；不据此估算分钟数。
    durationText: '', pin, route, routeNarrative, vibeMatch, match, emphasis, decision, moment,
    previewCount: Object.keys(state.behavior.photoPreviews).filter((id) => state.behavior.photoPreviews[id] > 0).length,
    mostPreviewedPhoto: attention.mostPreviewedPhoto,
    type: getVisitorType(state), normalizedScores, signals, evidence: getVisitorEvidence(state), soundtrack
  }
}

module.exports = { getPieceRevision, setPiece, setCut, resetCut, getWrappedSummary, setSoundtrack, STORAGE_KEY, PLACE_IDS, PLACE_NAMES, VIBES, PRIORITIES, getDefaultState, loadVisitorState, saveVisitorState, resetVisitorState, updatePin, updateRoute, recordDecision, recordDetailVisit, recordPhotoPreview, recordDwellTime, getNormalizedScores, getAttentionSummary, getChoiceSummary, calculateVisitorScores, getVisitorType, getVisitorEvidence, getVibeMatch, normalizeRoute, buildRoute }
