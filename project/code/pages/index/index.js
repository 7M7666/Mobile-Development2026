const summer = require('../../data/summer2026')
const state = require('../../services/summer-state')
const poster = require('../../services/summer-poster')

const photoById = summer.photos.reduce((result, photo) => {
  result[photo.id] = photo
  return result
}, {})

const placeById = summer.places.reduce((result, place) => {
  result[place.id] = place
  return result
}, {})

const timelinePlaces = summer.timeline.stopIds.map((id) => placeById[id])

const topPlace = {
  ...placeById[summer.curation.topPlaceId],
  photo: photoById[summer.curation.topPlacePhotoId],
  displayLines: summer.curation.topPlaceDisplayLines
}

const summerType = summer.curation.summerType
const planVsReality = summer.curation.planVsReality
const soundtrack = summer.curation.soundtrack

const storyMoments = summer.curation.moments.map((moment) => {
  const photo = photoById[moment.photoId]

  if (!photo) {
    throw new Error(`Missing Story Moment photo: ${moment.photoId}`)
  }

  return {
    ...moment,
    number: `0${moment.order}`,
    name: moment.title,
    photo
  }
})

const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const slideBackgrounds = {
  '01': '#242522',
  '02': '#242522',
  '03': '#FF5944',
  '04': '#A7B59F',
  '05': '#ECEDE7',
  '06': '#9891F5',
  '07': '#E9C52C',
  '08': '#9891F5',
  '09': '#242522',
  '10': '#FF5944',
  '11': '#E9C52C',
  '12': '#242522',
  '13': '#9891F5',
  '14': '#A8D900'
}

function formatStoryDate(value) {
  const [, month, day] = value.split('-')

  return {
    month: monthNames[Number(month) - 1],
    day
  }
}

const storyFacts = {
  year: summer.meta.year,
  days: summer.meta.inclusiveDays,
  placeCount: summer.places.length,
  photoCount: summer.summary.photoCount,
  archivePhotoCount: summer.totals.curatedPhotoCount,
  places: summer.places,
  timelinePlaces,
  moments: storyMoments,
  momentCount: summer.curation.moments.length,
  momentLabel: summer.curation.moments.length === 1 ? 'MOMENT' : 'MOMENTS',
  biggestDay: {
    ...summer.curation.biggestDay,
    displayDate: formatStoryDate(summer.curation.biggestDay.date)
  },
  soundtrack,
  startDate: formatStoryDate(summer.meta.startDate),
  endDate: formatStoryDate(summer.meta.endDate)
}

const placeCollage = [
  { ...placeById.nanning, photo: photoById['nanning-night-market'] },
  { ...placeById.guiping, photo: photoById['guiping-longchi'] },
  { ...placeById.urumqi, photo: photoById['urumqi-bazaar-minarets'] },
  { ...placeById.bayinbuluke, photo: photoById['xinjiang-bayinbuluke'] }
]

const contactSheet = [
  'nanning-old-town', 'guiping-xishan-overlook', 'urumqi-bazaar-dusk', 'xinjiang-bbq',
  'xinjiang-naan', 'golden-puppy', 'xinjiang-small-lake', 'xinjiang-pilaf'
].map((id) => photoById[id])

const endingPhotos = [
  ['NANNING', 'nanning-water-street'],
  ['NANNING', 'nanning-old-town'],
  ['GUIPING', 'guiping-xishan-pavilion'],
  ['GUIPING', 'guiping-longchi'],
  ['URUMQI', 'urumqi-bazaar-carpets'],
  ['URUMQI', 'urumqi-bazaar-minarets'],
  ['BAYINBULUKE', 'xinjiang-gongnaizi'],
  ['BAYINBULUKE', 'xinjiang-grassland']
].map(([place, id]) => ({ ...photoById[id], place }))

const endingColumns = {
  left: endingPhotos.slice(0, 4),
  right: endingPhotos.slice(4, 8)
}
const posterFallbackPhotos = endingPhotos.slice(0, 4)

const slides = [
  {
    number: '01',
    name: 'Cover',
    page: 'cover',
    progressTheme: 'dark',
    tap: false,
    year: storyFacts.year,
    days: storyFacts.days,
    placeCount: storyFacts.placeCount,
    photoCount: storyFacts.photoCount
  },
  { number: '02', name: 'Intro', page: 'placeholder', progressTheme: 'dark', tap: true, coverPhoto: photoById['xinjiang-cloud'] },
  {
    number: '03',
    name: 'Days',
    page: 'placeholder',
    progressTheme: 'dark',
    tap: true,
    startDate: storyFacts.startDate,
    endDate: storyFacts.endDate,
    days: storyFacts.days,
    ticks: Array.from({ length: storyFacts.days }, (item, index) => index + 1)
  },
  {
    number: '04',
    name: 'Timeline',
    page: 'placeholder',
    progressTheme: 'dark',
    tap: true,
    places: storyFacts.timelinePlaces,
    ledger: storyFacts.timelinePlaces.map((place, index) => ({
      number: `0${index + 1}`,
      name: place.name,
      month: index < 2 ? 'JUL' : 'AUG',
      note: index === 0 ? '暑假的起点，老街和城市日常。' : index === 1 ? '和家人一起的一站。' : index === 2 ? '进入新疆后的城市生活。' : '最长的一段路，也是最开阔的一站。'
    }))
  },
  {
    number: '05',
    name: 'Places Intro',
    page: 'placeholder',
    progressTheme: 'dark',
    tap: true,
    placeCount: storyFacts.placeCount,
    places: placeCollage
  },
  {
    number: '06',
    name: 'Summer Map',
    page: 'summer-map',
    progressTheme: 'dark',
    tap: true,
    route: storyFacts.timelinePlaces.map((place, index) => ({
      number: `0${index + 1}`,
      name: place.name
    }))
  },
  {
    number: '07',
    name: 'Top Place',
    page: 'top-place',
    progressTheme: 'dark',
    tap: true,
    year: storyFacts.year,
    topPlace: { ...topPlace, photo: photoById['xinjiang-grassland'] },
    reasons: ['BIGGEST DAY / AUG 01', '500+ KM ON THE ROAD', 'FIRST 1.5 KM GRASS SLIDE'],
    why: '这一站最远，路上花的时间最多，看到的风景也最开阔。整个暑假里最特别的一天也发生在这里，所以最后留下来的 Top Place，是巴音布鲁克。'
  },
  {
    number: '08',
    name: 'Biggest Day',
    page: 'biggest',
    progressTheme: 'dark',
    tap: true,
    biggestDay: storyFacts.biggestDay,
    photo: photoById['xinjiang-bayinbuluke'],
    supportPhoto: photoById['xinjiang-gongnaizi'],
    why: '8 月 1 日把最长的一段路、第一次草滑和最开阔的风景放在了一起。它不只是行程里的一天，而是这个暑假记忆密度最高的一天。'
  },
  {
    number: '09',
    name: 'Top Moments',
    page: 'moments',
    progressTheme: 'light',
    tap: true,
    moments: storyFacts.moments,
    momentCount: storyFacts.momentCount,
    momentLabel: storyFacts.momentLabel
  },
  {
    number: '10',
    name: 'Photo Number',
    page: 'photo-number',
    progressTheme: 'dark',
    tap: true,
    momentCount: storyFacts.momentCount,
    momentLabel: storyFacts.momentLabel,
    photoCount: summer.summary.photoCount,
    archivePhotoCount: storyFacts.archivePhotoCount,
    photoSamples: contactSheet
  },
  {
    number: '11',
    name: 'Planned vs Reality',
    page: 'planned-reality',
    progressTheme: 'dark',
    tap: true,
    planVsReality,
    realityPhoto: photoById['playing-games']
  },
  {
    number: '12',
    name: 'Summer Soundtrack',
    page: 'soundtrack',
    progressTheme: 'dark',
    tap: true,
    soundtrack: {
      tracks: storyFacts.soundtrack.tracks.map((track) => ({
        ...track,
        reason: {
          'WE LIKE 2 PARTY': '最像朋友聚在一起时的那部分暑假。',
          SNOOZE: '适合路上和安静下来的时候听。',
          'WAIT FOR IT': '最像从一个地方走向下一个地方的情绪。'
        }[track.title]
      }))
    }
  },
  {
    number: '13',
    name: 'Summer Type',
    page: 'summer-type',
    progressTheme: 'light',
    tap: true,
    summerType,
    why: '计划里是雅思，真正占满暑假的却是旅行、朋友、食物和临时决定。所以我把这个夏天叫做 OFF SCRIPT。',
    typePhotos: [photoById['guangxi-friends-cards'], photoById['xinjiang-cloud']]
  },
  {
    number: '14',
    name: 'Final Poster',
    page: 'final',
    progressTheme: 'dark',
    tap: true,
    finalPoster: {
      year: storyFacts.year,
      days: storyFacts.days,
      placeCount: storyFacts.placeCount,
      photoCount: storyFacts.photoCount,
      topPlace: topPlace.name,
      biggestDay: storyFacts.biggestDay.displayDate,
      summerType: summerType.name
    },
    endingColumns
  }
]

function getSlide(index, activeTrackIndex = 0) {
  const slide = { ...slides[index], background: slideBackgrounds[slides[index].number] || '#ECEDE7' }

  if (slide.page === 'final') {
    return { ...slide, endingColumns: getFinalPosterColumns() }
  }

  if (slide.page !== 'soundtrack') return slide

  const tracks = slide.soundtrack.tracks

  return {
    ...slide,
    activeTrackIndex,
    activeTrack: tracks[activeTrackIndex],
    secondaryTracks: tracks.slice(1).map((track, trackIndex) => ({
      ...track,
      index: trackIndex + 1
    }))
  }
}

function getProgress(current) {
  return slides.map((item, index) => {
    let state = 'upcoming'

    if (index < current) {
      state = 'done'
    } else if (index === current) {
      state = 'current'
    }

    return { index, state }
  })
}

function getSafeArea() {
  const info = wx.getWindowInfo
    ? wx.getWindowInfo()
    : wx.getSystemInfoSync()
  const statusBar = info.statusBarHeight || 0
  const screenHeight = info.screenHeight || info.windowHeight || 0
  const bottom = info.safeArea
    ? Math.max(screenHeight - info.safeArea.bottom, 0)
    : 0
  const menu = wx.getMenuButtonBoundingClientRect()
  const top = Math.max(statusBar, menu.bottom || 0) + 8

  return {
    top,
    bottom,
    viewportHeight: screenHeight || info.windowHeight,
    viewportWidth: info.windowWidth || 0
  }
}

function getStoredState() {
  return state.loadState({
    maxSlide: slides.length - 1,
    placeIds: summer.places.map((place) => place.id),
    vibeIds: ['quiet', 'wild', 'warm', 'random'],
    photoIds: summer.photos.map((photo) => photo.id)
  })
}

function getFinalPosterColumns() {
  const stored = getStoredState()
  const usedPhotoIds = new Set()
  const photos = stored.yourCut.resultPhotoIds
    .map((id) => photoById[id])
    .concat(endingPhotos)
    .filter((photo) => {
      if (!photo || usedPhotoIds.has(photo.id)) return false
      usedPhotoIds.add(photo.id)
      return true
    })
    .slice(0, 8)

  return {
    left: photos.slice(0, 4),
    right: photos.slice(4, 8)
  }
}

function getPosterModel() {
  const stored = getStoredState()
  const selectedPhotos = stored.yourCut.resultPhotoIds
    .map((id) => photoById[id])
    .filter(Boolean)
  const usedPhotoIds = new Set()
  const photos = selectedPhotos
    .concat(posterFallbackPhotos)
    .filter((photo) => {
      if (usedPhotoIds.has(photo.id)) return false
      usedPhotoIds.add(photo.id)
      return true
    })
    .slice(0, 4)

  return {
    days: summer.meta.inclusiveDays,
    placeCount: summer.places.length,
    photoCount: summer.summary.photoCount,
    topPlace: topPlace.name,
    summerType: summerType.name,
    photos,
    usingYourCut: selectedPhotos.length > 0
  }
}

function getSaveFailureType(error) {
  const message = String(error && (error.errMsg || error.message) || '').toLowerCase()

  if (message.indexOf('cancel') !== -1) return 'cancelled'
  if (/auth|permission|scope\.writephotosalbum/.test(message)) return 'permission'
  return 'failed'
}

function handlePosterSaveFailure(error) {
  const type = getSaveFailureType(error)

  if (type === 'cancelled') {
    wx.showToast({ title: 'SAVE CANCELLED', icon: 'none' })
    return
  }

  if (type === 'permission') {
    if (!wx.showModal) {
      wx.showToast({ title: 'PHOTO ACCESS NEEDED', icon: 'none' })
      return
    }

    wx.showModal({
      title: 'PHOTO ACCESS NEEDED',
      content: 'Allow photo access in Settings to save this poster.',
      confirmText: 'OPEN SETTINGS',
      cancelText: 'NOT NOW',
      success: (result) => {
        if (result.confirm && wx.openSetting) wx.openSetting({})
      }
    })
    return
  }

  wx.showToast({ title: 'SAVE FAILED', icon: 'none' })
}

Page({
  data: {
    currentSlide: 0,
    totalSlides: slides.length,
    animationKey: 0,
    slide: getSlide(0),
    progress: getProgress(0),
    dots: Array.from({ length: 20 }, (item, index) => index),
    top: 0,
    bottom: 0,
    viewportHeight: 0,
    viewportWidth: 0,
    canContinue: false,
    continueSlide: 0,
    posterGenerating: false,
    posterPath: ''
  },

  onLoad(options = {}) {
    this.setSafeArea()
    this.setPageBackground(this.data.slide)
    const stored = getStoredState()
    const canContinue = stored.story.currentSlide > 0 && stored.story.currentSlide < slides.length - 1
    this.setData({ canContinue, continueSlide: canContinue ? stored.story.currentSlide : 0 })
    const requestedSlide = Number(options.slide)
    if (Number.isInteger(requestedSlide) && requestedSlide >= 0 && requestedSlide < slides.length) {
      this.goTo(requestedSlide)
    }
  },

  onResize() {
    this.setSafeArea()
  },

  onShow() {
    if (this.data.currentSlide !== slides.length - 1) return
    this.setData({ slide: getSlide(this.data.currentSlide) })
  },

  setSafeArea() {
    this.setData(getSafeArea())
  },

  goTo(index) {
    const last = this.data.totalSlides - 1
    const current = Math.min(Math.max(index, 0), last)

    if (current === this.data.currentSlide) {
      return
    }

    const slide = getSlide(current)
    this.setData({
      currentSlide: current,
      slide,
      progress: getProgress(current),
      animationKey: this.data.animationKey + 1
    })
    this.setPageBackground(slide)
    state.saveState({ story: { currentSlide: current } })
  },

  setPageBackground(slide) {
    if (!wx.setBackgroundColor || !slide || !slide.background) return

    wx.setBackgroundColor({
      backgroundColor: slide.background,
      backgroundColorTop: slide.background,
      backgroundColorBottom: slide.background
    })
  },

  next() {
    this.goTo(this.data.currentSlide + 1)
  },

  previous() {
    this.goTo(this.data.currentSlide - 1)
  },

  touchStart(event) {
    const touch = event.touches && event.touches[0]
    this.touchOrigin = touch ? {
      x: Number.isFinite(touch.pageX) ? touch.pageX : touch.clientX,
      y: Number.isFinite(touch.pageY) ? touch.pageY : touch.clientY
    } : null
  },

  touchEnd(event) {
    const touch = event.changedTouches && event.changedTouches[0]
    if (!touch || !this.touchOrigin) return
    const endX = Number.isFinite(touch.pageX) ? touch.pageX : touch.clientX
    const endY = Number.isFinite(touch.pageY) ? touch.pageY : touch.clientY
    const deltaX = endX - this.touchOrigin.x
    const deltaY = endY - this.touchOrigin.y
    this.touchOrigin = null
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) return
    if (deltaX < 0) this.next()
    else this.previous()
  },

  tapStory(event) {
    const x = event.detail && Number.isFinite(event.detail.x) ? event.detail.x : 0

    if (x > 0 && x < this.data.viewportWidth / 2) {
      this.previous()
      return
    }

    this.next()
  },

  start() {
    this.goTo(1)
  },

  continueStory() {
    this.goTo(this.data.continueSlide)
  },

  openCut() {
    wx.navigateTo({
      url: '/pages/cut/cut',
      fail: () => wx.showToast({ title: 'CUT COULDN’T OPEN', icon: 'none' })
    })
  },

  stopStoryTap() {},

  selectTrack(event) {
    const activeTrackIndex = Number(event.currentTarget.dataset.index)
    const soundtrackSlide = slides[11]

    if (!Number.isInteger(activeTrackIndex) || !soundtrackSlide.soundtrack.tracks[activeTrackIndex]) return

    this.setData({ activeTrackIndex, slide: getSlide(11, activeTrackIndex) })
  },

  exitWrapped() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }

    wx.reLaunch({ url: '/pages/home/home' })
  },

  backToSummer() {
    wx.reLaunch({ url: '/pages/home/home' })
  },

  getPosterCanvas() {
    return new Promise((resolve) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#summer-poster-canvas')
        .fields({ node: true, size: true })
        .exec((result) => resolve(result[0] && result[0].node ? result[0].node : null))
    })
  },

  async generatePoster() {
    if (this.data.posterGenerating) return

    this.setData({ posterGenerating: true })

    try {
      const canvas = await this.getPosterCanvas()
      if (!canvas) throw new Error('Canvas unavailable')
      const posterPath = await poster.generateSummerPoster(canvas, getPosterModel())
      this.setData({ posterPath })
    } catch (error) {
      wx.showToast({ title: 'POSTER COULDN’T GENERATE', icon: 'none' })
    } finally {
      this.setData({ posterGenerating: false })
    }
  },

  handlePosterAction() {
    if (this.data.posterPath) {
      this.previewPoster()
      return
    }

    this.generatePoster()
  },

  previewPoster() {
    if (!this.data.posterPath) return
    wx.previewImage({ current: this.data.posterPath, urls: [this.data.posterPath] })
  },

  savePoster() {
    if (!this.data.posterPath) return
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterPath,
      success: () => wx.showToast({ title: 'SAVED TO PHOTOS', icon: 'none' }),
      fail: handlePosterSaveFailure
    })
  },

  replay() {
    const slide = getSlide(0)
    this.setData({
      currentSlide: 0,
      slide,
      progress: getProgress(0),
      animationKey: this.data.animationKey + 1
    })
    this.setPageBackground(slide)
    state.saveState({ story: { currentSlide: 0 } })
  }
})
