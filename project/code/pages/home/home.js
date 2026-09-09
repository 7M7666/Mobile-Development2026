const summerData = require('../../services/summer-data')
const visitor = require('../../services/visitor-state')

Page({
  data: { markers: [], polyline: [], stops: [], mapCenter: { latitude: 33.1, longitude: 98.3 }, mapScale: 3,
    pin: { place: '', vibe: '', note: '' }, pinDraft: { place: '', vibe: '', note: '' },
    vibes: visitor.VIBES, pinSheetOpen: false, pinError: '', pinVibeLabel: '', match: null, matchExpanded: false },

  onShow() { this.restorePin() },
  onHide() { this.setData({ pinSheetOpen: false }) },

  restorePin() {
    const pin = visitor.loadVisitorState().pin
    const vibe = visitor.VIBES.find((item) => item.id === pin.vibe)
    this.setData({ pin, pinVibeLabel: vibe ? `${vibe.label} · ${vibe.en}` : '', match: visitor.getVibeMatch(pin), matchExpanded: false })
  },
  openPinSheet() { this.setData({ pinSheetOpen: true, pinDraft: { ...this.data.pin }, pinError: '' }) },
  closePinSheet() { this.setData({ pinSheetOpen: false }) },
  stopSheetTouch() {},
  inputPinPlace(event) { this.setData({ pinDraft: { ...this.data.pinDraft, place: event.detail.value }, pinError: '' }) },
  inputPinNote(event) { this.setData({ pinDraft: { ...this.data.pinDraft, note: event.detail.value } }) },
  selectPinVibe(event) {
    const vibe = event.currentTarget.dataset.id
    if (visitor.VIBES.some((item) => item.id === vibe)) this.setData({ pinDraft: { ...this.data.pinDraft, vibe } })
  },
  savePin() {
    const draft = this.data.pinDraft
    const place = typeof draft.place === 'string' ? draft.place.trim() : ''
    const note = typeof draft.note === 'string' ? draft.note.trim() : ''
    if (!place) { this.setData({ pinError: '请先输入一个地点，不能只填空格。' }); return }
    if (Array.from(place).length > 30 || Array.from(note).length > 40) {
      this.setData({ pinError: '地点最多 30 字，一句话最多 40 字。' }); return
    }
    const result = visitor.updatePin({ place, vibe: draft.vibe, note })
    this.restorePin()
    this.closePinSheet()
    wx.showToast({ title: result.persisted ? '已保存你的夏天' : '暂存本次访问，未能写入本地', icon: 'none' })
  },
  toggleMatch() { this.setData({ matchExpanded: !this.data.matchExpanded }) },
  openMatch() {
    if (!this.data.match) return
    const journey = summerData.getJourneys().find((item) => item.placeId === this.data.match.placeId)
    if (journey) this.openDetailById(journey.id)
  },

  onLoad() {
    const model = summerData.getMapModel()
    const stops = model.journeys.map((journey) => ({
      id: journey.id,
      order: String(journey.order).padStart(2, '0'),
      name: journey.place ? journey.place.name : journey.placeId,
      city: journey.place && journey.place.city ? journey.place.city : journey.place.province,
      cover: journey.coverPhoto ? journey.coverPhoto.src : ''
    }))
    this.setData({
      markers: model.markers.map((marker) => ({
        id: marker.order,
        latitude: marker.latitude,
        longitude: marker.longitude,
        title: `${marker.order}. ${marker.name}`,
        callout: { content: `${String(marker.order).padStart(2, '0')}  ${marker.name}`, display: 'ALWAYS', color: '#242522', fontSize: 11, borderRadius: 0, bgColor: '#ECEDE7', padding: 6 },
        width: 24,
        height: 24,
        anchor: { x: .5, y: .5 }
      })),
      polyline: model.polyline.length > 1 ? [{ points: model.polyline, color: '#242522', width: 4, dottedLine: true }] : [],
      stops
    })
  },

  openMarker(event) {
    const markerId = Number(event.detail.markerId)
    const stop = this.data.stops.find((item) => Number(item.order) === markerId)
    if (stop) this.openDetailById(stop.id)
  },

  openDetail(event) { this.openDetailById(event.currentTarget.dataset.id) },
  openDetailById(id) { if (id) wx.navigateTo({ url: `/pages/detail/detail?id=${id}` }) },
  openJourney() { wx.redirectTo({ url: '/pages/timeline/timeline' }) }
})
