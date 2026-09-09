const summer = require('../data/summer2026')
const visitor = require('./visitor-state')
const files = require('./piece-files')
const photos = summer.photos.filter((photo) => visitor.PLACE_IDS.includes(photo.placeId))
const byId = photos.reduce((all, photo) => { all[photo.id] = photo; return all }, {})
// Coordinates are shared by the mobile preview and the 1080px poster.
const SLOTS = [
  { name: 'HERO', label: '主图', x: 0, y: 0, w: 57, h: 46, rotation: 0 },
  { name: 'TALL', label: '竖图', x: 61, y: 3, w: 37, h: 57, rotation: 3 },
  { name: 'SMALL', label: '小片段', x: 0, y: 51, w: 35, h: 33, rotation: 0 },
  { name: 'ROTATED', label: '横片段', x: 40, y: 66, w: 54, h: 32, rotation: -3 },
  { name: 'ACCENT', label: '点睛片段', x: 37, y: 44, w: 28, h: 24, rotation: -4 }
]
const typeVibes = { 'quiet-wanderer': 'quiet', 'city-explorer': 'warm', 'off-script': 'random', 'slow-observer': 'quiet', 'route-maker': 'wild' }

function recommend(state = visitor.loadVisitorState()) {
  const type = visitor.getVisitorType(state)
  const attention = visitor.getAttentionSummary(state)
  const match = visitor.getVibeMatch(state.pin)
  const choices = visitor.getChoiceSummary(state).items.filter((item) => item.choice).map((item) => item.placeId)
  const focus = [attention.mostPreviewedPhoto, attention.mostRevisited, attention.longestDwell, attention.mostVisited].filter(Boolean)
  function rank(photo) {
    const routeIndex = state.route.order.indexOf(photo.placeId)
    return [
      type && photo.vibes.includes(typeVibes[type.id]) ? 1 : 0,
      routeIndex < 0 ? 0 : 4 - routeIndex,
      focus.reduce((sum, item, index) => sum + ((item.id === photo.id || item.placeId === photo.placeId) ? 4 - index : 0), 0),
      match && photo.placeId === match.placeId ? 1 : 0,
      choices.includes(photo.placeId) ? 1 : 0,
      photo.priority || 0
    ]
  }
  return photos.slice().sort((a, b) => {
    const ar = rank(a), br = rank(b)
    for (let i = 0; i < ar.length; i++) if (ar[i] !== br[i]) return br[i] - ar[i]
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }).slice(0, 4).map((photo) => photo.id)
}

function getModel(state = visitor.loadVisitorState()) {
  const automatic = state.cut.automatic && !state.cut.kept.length
  const photoIds = !automatic && state.cut.photoIds.length === 4 ? state.cut.photoIds : recommend(state)
  const ids = photoIds.concat(state.piece.type ? ['piece'] : [])
  const order = state.cut.order.filter((id) => ids.includes(id))
  ids.forEach((id) => { if (!order.includes(id)) order.push(id) })
  const summary = visitor.getWrappedSummary(state)
  const trace = []
  if (summary.type) trace.push({ label: '你的版本', value: summary.type.label })
  if (summary.pin) trace.push({ label: '你的地点', value: summary.pin.place })
  if (summary.route) trace.push({ label: '你的路线', value: summary.route.path })
  if (summary.soundtrack) trace.push({ label: '你的歌', value: summary.soundtrack.title })
  const evidence = visitor.getVisitorEvidence(state).find((item) => item.type === 'attention' || item.type === 'decision')
  const elements = order.map((id, index) => {
    const piece = id === 'piece'
    const slot = SLOTS[index]
    const words = piece ? (state.piece.place || state.piece.text || '') : ''
    const textSize = state.piece.type === 'place' && Array.from(words).length <= 8 ? 36 : index === 4 && Array.from(words).length > 24 ? 17 : 20
    return { id, type: piece ? state.piece.type : 'photo', src: piece ? state.piece.localFilePath : byId[id].src,
      title: piece ? (state.piece.place || state.piece.text || '你的照片') : byId[id].title,
      user: piece, slot, textSize, style: `left:${slot.x}%;top:${slot.y}%;width:${slot.w}%;height:${slot.h}%;transform:rotate(${slot.rotation}deg);` }
  })
  return { version: 2, automatic, photoIds, order, kept: state.cut.kept.filter((id) => photoIds.includes(id)), piece: state.piece,
    photos: photoIds.map((id) => ({ ...byId[id], kept: state.cut.kept.includes(id), placeName: visitor.PLACE_NAMES[byId[id].placeId] })),
    elements, trace, footnote: evidence ? evidence.text : '', pinPlace: state.pin.place,
    sparse: !summary.type, signature: JSON.stringify({ version: 2, photoIds, order, type: summary.type && summary.type.id,
      pin: state.pin, route: state.route, soundtrack: state.soundtrack, piece: state.piece, footnote: evidence ? evidence.text : '' }) }
}

function persist(model, changes = {}) {
  return visitor.setCut({ photoIds: model.photoIds, order: model.order, kept: model.kept, automatic: model.automatic, ...changes })
}
function candidates(photoId, model = getModel()) {
  const photo = byId[photoId]
  return photo ? photos.filter((item) => item.placeId === photo.placeId && !model.photoIds.includes(item.id)) : []
}
function replace(photoId, replacementId) {
  const model = getModel()
  if (!model.photoIds.includes(photoId) || !candidates(photoId, model).some((photo) => photo.id === replacementId)) return null
  return persist(model, { photoIds: model.photoIds.map((id) => id === photoId ? replacementId : id),
    order: model.order.map((id) => id === photoId ? replacementId : id), kept: [...new Set(model.kept.filter((id) => id !== photoId).concat(replacementId))], automatic: false })
}
function move(fromId, toId) {
  const model = getModel(), order = model.order.slice()
  const from = order.indexOf(fromId), to = order.indexOf(toId)
  if (from < 0 || to < 0) return null
  order.splice(from, 1); order.splice(to, 0, fromId)
  return persist(model, { order })
}
function checkPhoto(path) {
  return new Promise((resolve) => {
    if (!path || !wx.getImageInfo || !wx.getFileSystemManager) return resolve(false)
    wx.getFileSystemManager().access({ path, success: () => {
      wx.getImageInfo({ src: path, success: (info) => resolve(info.width > 0 && info.height > 0), fail: () => resolve(false) })
    }, fail: () => resolve(false) })
  }).catch(() => false)
}
async function choosePhoto() {
  const result = await new Promise((resolve, reject) => wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album'], success: resolve, fail: reject }))
  const file = result.tempFiles && result.tempFiles[0]
  if (!file || !await checkPhoto(file.tempFilePath)) throw Error('这张照片暂时无法使用，请重新选择。')
  const path = await files.save(file.tempFilePath)
  if (!await checkPhoto(path)) { files.release(path); throw Error('这张照片暂时无法使用，请重新选择。') }
  return { type: 'photo', localFilePath: path }
}

module.exports = { SLOTS, recommend, getModel, persist, candidates, replace, move, checkPhoto, choosePhoto }
