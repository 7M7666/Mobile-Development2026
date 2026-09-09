const summerData = require('../../services/summer-data')
const visitor = require('../../services/visitor-state')

const archivePhotoIds = ['nanning-water-street', 'guiping-xishan-pavilion', 'urumqi-bazaar-carpets', 'xinjiang-grassland', 'golden-puppy']

Page({
  data: { stats: null, archivePhotos: [], places: [], moments: [], archiveMode: 'me', profile: null },
  onLoad() {
    const recap = summerData.getRecap()
    const photoById = recap.photos.reduce((result, photo) => { result[photo.id] = photo; return result }, {})
    this.setData({
      stats: recap.stats,
      archivePhotos: archivePhotoIds.map((id) => photoById[id]).filter(Boolean),
      places: recap.journeys.map((journey) => ({ id: journey.id, order: String(journey.order).padStart(2, '0'), name: journey.place ? journey.place.name : journey.placeId, photo: journey.coverPhoto })),
      moments: recap.curation.moments.map((moment) => ({ ...moment, photo: photoById[moment.photoId] }))
    })
  },
  onShow() { this.refreshProfile() },
  selectArchiveMode(event) {
    const mode = event.currentTarget.dataset.mode
    if (!['me', 'you'].includes(mode)) return
    this.refreshProfile()
    this.setData({ archiveMode: mode })
  },
  refreshProfile() {
    const state = visitor.loadVisitorState()
    const journeys = summerData.getJourneys()
    const choices = visitor.getChoiceSummary(state)
    choices.items = choices.items.map((item, index) => {
      const journey = journeys.find((journey) => journey.placeId === item.placeId)
      return { ...item, number: String(index + 1).padStart(2, '0'), journeyId: journey.id, photo: journey.coverPhoto }
    })
    const attention = visitor.getAttentionSummary(state)
    const signal = visitor.getNormalizedScores(state)
    const labels = { nature: '自然倾向', city: '城市倾向', quiet: '安静倾向', social: '社交倾向', planned: '计划倾向', spontaneous: '随性倾向' }
    const signalGroups = [['nature', 'city'], ['quiet', 'social'], ['planned', 'spontaneous']].map((keys) => ({
      id: keys[0], items: keys.map((id) => ({ id, label: labels[id], value: signal[id], stronger: signal[id] > signal[keys.find((key) => key !== id)] }))
    }))
    const vibe = visitor.VIBES.find((item) => item.id === state.pin.vibe)
    const result = visitor.buildRoute(state.route)
    const comparisons = []
    const topPlaceId = summerData.getRecap().curation.topPlaceId
    if (state.pin.place && visitor.PLACE_NAMES[topPlaceId]) comparisons.push({ id: 'pin', title: '地点', mine: visitor.PLACE_NAMES[topPlaceId], yours: state.pin.place, note: '我的精选地点 / 你的地点心愿' })
    if (state.route.order.length) comparisons.push({ id: 'route', title: '路线第一站', mine: journeys[0].place.name, yours: visitor.PLACE_NAMES[state.route.order[0]], note: '我的真实路线 / 你的排序' })
    choices.items.filter((item) => item.choice).forEach((item) => comparisons.push({ id: item.placeId, title: item.name, mine: item.comparisonLabel, yours: item.label, note: '情境互动对照' }))
    const focus = attention.longestDwell || attention.mostRevisited || attention.mostVisited
    const focusJourney = focus && journeys.find((item) => item.placeId === focus.placeId)
    const attentionVisual = attention.mostPreviewedPhoto ? {
      photo: attention.mostPreviewedPhoto, name: attention.mostPreviewedPhoto.placeName,
      caption: '你打开最多次的照片' + (attention.mostPreviewedPhoto.tied ? '之一' : '') + '。'
    } : focusJourney ? {
      photo: focusJourney.coverPhoto, name: focus.name,
      caption: attention.longestDwell ? '你在这里停留得最久' + (focus.tied ? '（并列）' : '') + '。' : '你打开过这一站的旅行记录。'
    } : null
    const displayComparisons = comparisons.filter((item) => item.id === 'pin')
      .concat(comparisons.filter((item) => !['pin', 'route'].includes(item.id)).slice(0, 2))
    const routeNames = (result.length ? [...new Set(result.map((item) => item.placeId))] : state.route.order).map((id) => visitor.PLACE_NAMES[id])
    this.setData({ profile: {
      pin: state.pin, pinVibe: vibe ? `${vibe.label} · ${vibe.en}` : '',
      route: state.route, routeComplete: result.length > 0,
      routeNames,
      skippedNames: state.route.skipped.map((id) => visitor.PLACE_NAMES[id]).join(' · '),
      omittedNames: state.route.days ? state.route.order.slice(state.route.days).map((id) => visitor.PLACE_NAMES[id]).join(' · ') : '',
      priorities: state.route.priorities.map((id) => visitor.PRIORITIES.find((item) => item.id === id).label).join(' · '),
      choices, attention, attentionVisual, comparisons, displayComparisons, signalGroups,
      myRouteNames: journeys.map((item) => item.place.name),
      complete: Boolean(state.pin.place && result.length && choices.completed === 4 && attention.hasData),
      type: visitor.getVisitorType(state), evidence: visitor.getVisitorEvidence(state)
    } })
  },
  continueTrace(event) {
    const kind = event.currentTarget.dataset.kind
    if (kind === 'map' || kind === 'journey') {
      const url = kind === 'map' ? '/pages/home/home' : '/pages/timeline/timeline?mode=your'
      if (getCurrentPages().length > 1) wx.reLaunch({ url })
      else wx.redirectTo({ url })
      return
    }
    const state = visitor.loadVisitorState()
    const placeId = kind === 'choices'
      ? visitor.PLACE_IDS.find((id) => !state.decisions[id]) || visitor.PLACE_IDS[0]
      : visitor.PLACE_IDS.find((id) => !state.behavior.detailVisits[id]) || visitor.PLACE_IDS[0]
    const journey = summerData.getJourneys().find((item) => item.placeId === placeId)
    if (journey) wx.navigateTo({ url: `/pages/detail/detail?id=${journey.id}` })
  },
  openDetail(event) { const id = event.currentTarget.dataset.id; if (id) wx.navigateTo({ url: `/pages/detail/detail?id=${id}` }) },
  openWrapped() { wx.navigateTo({ url: '/pages/index/index' }) },
  openWrappedSlide(event) { wx.navigateTo({ url: `/pages/index/index?slide=${event.currentTarget.dataset.slide}` }) },
  openCut() { wx.navigateTo({ url: '/pages/cut/cut' }) }
})
