const summer = require('../../data/summer2026')
const state = require('../../services/summer-state')
const poster = require('../../services/summer-poster')

const vibes = [
  { id: 'quiet', number: '01', label: 'QUIET', note: 'slow it down' },
  { id: 'wild', number: '02', label: 'WILD', note: 'go somewhere' },
  { id: 'warm', number: '03', label: 'WARM', note: 'people & food' },
  { id: 'random', number: '04', label: 'SURPRISE ME', note: 'let summer decide' }
]

const vibeLabels = { quiet: 'QUIET', wild: 'WILD', warm: 'WARM', random: 'SURPRISE ME' }
const vibeThemeColors = { quiet: '#A7B59F', wild: '#9891F5', warm: '#FF5944', random: '#E9C52C' }

function safe() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  const statusBar = info.statusBarHeight || 0
  const screenHeight = info.screenHeight || info.windowHeight || 0
  const bottom = info.safeArea ? Math.max(screenHeight - info.safeArea.bottom, 0) : 0
  const menu = wx.getMenuButtonBoundingClientRect()
  return { top: Math.max(statusBar, menu.bottom || 0) + 8, bottom }
}

function getPlaces() {
  const photoById = summer.photos.reduce((result, photo) => { result[photo.id] = photo; return result }, {})

  return summer.journeys.map((journey) => ({
    id: journey.placeId,
    query: journey.placeId,
    number: String(journey.order).padStart(2, '0'),
    name: summer.places.find((place) => place.id === journey.placeId).name,
    photo: photoById[journey.coverPhotoId]
  }))
}

function getResultPhotos(cut, photoIds) {
  const rankedById = cut.rankedPhotos.reduce((result, photo) => { result[photo.id] = photo; return result }, {})
  const photos = photoIds.length ? photoIds.map((id) => rankedById[id]).filter(Boolean) : cut.selectedPhotos

  return photos.map((photo, index) => ({ ...photo, rank: `0${index + 1}` }))
}

function getYourCutPosterModel(data) {
  return {
    placeLabel: data.placeLabel,
    vibeLabel: data.vibeLabel,
    themeColor: vibeThemeColors[data.vibe],
    photos: data.resultPhotos
  }
}

function getPosterKey(data) {
  return [data.selectedPlace, data.vibe, data.resultPhotoIds.join(',')].join('|')
}

function getSaveFailureType(error) {
  const message = String(error && (error.errMsg || error.message) || '').toLowerCase()

  if (message.indexOf('cancel') !== -1) return 'cancelled'
  if (/auth|permission|scope\.writephotosalbum/.test(message)) return 'permission'
  return 'failed'
}

function handlePosterSaveFailure(error) {
  console.error('[YOUR CUT POSTER] save failed', error)
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
  data: { mode: 'input', query: '', selectedPlace: '', selectionHint: false, vibe: 'random', vibeLabel: 'SURPRISE ME', vibes, places: [], cut: null, resultPhotos: [], resultPhotoIds: [], placeLabel: '', empty: false, photoUrls: [], showWhy: false, posterStatus: 'idle', posterPath: '', posterKey: '', top: 0, bottom: 0 },

  onLoad() {
    const places = getPlaces()
    const stored = state.loadState({
      placeIds: places.map((place) => place.id),
      vibeIds: vibes.map((vibe) => vibe.id),
      photoIds: summer.photos.map((photo) => photo.id)
    })
    const selectedPlace = stored.yourCut.selectedPlace || ''
    const vibe = stored.yourCut.selectedVibe
    const query = selectedPlace
    const selected = places.find((place) => place.id === selectedPlace)
    const cut = selectedPlace && stored.yourCut.resultPhotoIds.length
      ? summer.buildCut(query, vibe)
      : null
    const resultPhotos = cut ? getResultPhotos(cut, stored.yourCut.resultPhotoIds) : []

    this.setData({
      ...safe(),
      places,
      selectedPlace,
      query,
      vibe,
      vibeLabel: vibeLabels[vibe],
      cut,
      resultPhotos,
      resultPhotoIds: resultPhotos.map((photo) => photo.id),
      mode: cut && resultPhotos.length ? 'result' : 'input',
      placeLabel: selected ? selected.name : '',
      empty: Boolean(cut && !resultPhotos.length),
      photoUrls: resultPhotos.map((photo) => photo.src)
    })
  },

  onResize() { this.setData(safe()) },

  pickPlace(event) {
    const selectedPlace = event.currentTarget.dataset.id
    this.invalidatePoster({ query: event.currentTarget.dataset.query, selectedPlace, selectionHint: false })
    state.saveState({ yourCut: { selectedPlace, selectedVibe: this.data.vibe, resultPhotoIds: [] } })
  },

  pickVibe(event) {
    const vibe = event.currentTarget.dataset.vibe
    this.invalidatePoster({ vibe, vibeLabel: vibeLabels[vibe] })
    state.saveState({ yourCut: { selectedPlace: this.data.selectedPlace || null, selectedVibe: vibe, resultPhotoIds: [] } })
  },

  makeCut() {
    if (!this.data.query) { this.setData({ selectionHint: true }); return }
    const cut = summer.buildCut(this.data.query, this.data.vibe)
    const selectedPlace = this.data.places.find((place) => place.id === this.data.selectedPlace)
    const resultPhotos = getResultPhotos(cut, [])
    this.invalidatePoster({ mode: 'result', cut, resultPhotos, resultPhotoIds: resultPhotos.map((photo) => photo.id), placeLabel: selectedPlace ? selectedPlace.name : cut.title, empty: resultPhotos.length === 0, photoUrls: resultPhotos.map((photo) => photo.src), showWhy: false })
    state.saveState({ yourCut: { selectedPlace: this.data.selectedPlace, selectedVibe: this.data.vibe, resultPhotoIds: resultPhotos.map((photo) => photo.id) } })
  },

  previewPhoto(event) { wx.previewImage({ current: event.currentTarget.dataset.src, urls: this.data.photoUrls }) },
  toggleWhy() { this.setData({ showWhy: !this.data.showWhy }) },
  makeAnother() { this.invalidatePoster({ mode: 'input', selectionHint: false, showWhy: false }) },
  resetCut() {
    this.invalidatePoster({ mode: 'input', query: '', selectedPlace: '', vibe: 'random', vibeLabel: vibeLabels.random, cut: null, resultPhotos: [], resultPhotoIds: [], placeLabel: '', empty: false, photoUrls: [], showWhy: false })
    state.saveState({ yourCut: { selectedPlace: null, selectedVibe: 'random', resultPhotoIds: [] } })
  },
  invalidatePoster(changes = {}) {
    this.posterRequestId = (this.posterRequestId || 0) + 1
    this.posterGeneration = null
    if (wx.hideLoading) wx.hideLoading()
    this.setData({ ...changes, posterStatus: 'idle', posterPath: '', posterKey: '' })
  },
  getPosterCanvas() {
    return new Promise((resolve) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#cut-poster-canvas')
        .fields({ node: true, size: true })
        .exec((result) => resolve(result[0] && result[0].node ? result[0].node : null))
    })
  },
  ensurePoster() {
    if (this.data.mode !== 'result' || this.data.resultPhotoIds.length !== 5 || this.data.resultPhotos.length !== 5) {
      console.error('[YOUR CUT POSTER] invalid result state', this.data.resultPhotoIds)
      this.setData({ posterStatus: 'error', posterPath: '', posterKey: '' })
      wx.showToast({ title: 'POSTER GENERATION FAILED', icon: 'none' })
      return Promise.resolve('')
    }

    const key = getPosterKey(this.data)
    if (this.data.posterPath && this.data.posterKey === key) {
      if (this.data.posterStatus !== 'ready') this.setData({ posterStatus: 'ready' })
      return Promise.resolve(this.data.posterPath)
    }

    if (this.posterGeneration) return this.posterGeneration

    const requestId = (this.posterRequestId || 0) + 1
    const model = getYourCutPosterModel(this.data)
    this.posterRequestId = requestId
    this.setData({ posterStatus: 'generating', posterPath: '', posterKey: '' })
    if (wx.showLoading) wx.showLoading({ title: 'GENERATING...', mask: true })

    this.posterGeneration = (async () => {
      try {
        const canvas = await this.getPosterCanvas()
        if (!canvas) throw new Error('Canvas unavailable')
        const posterPath = await poster.generateYourCutPoster(canvas, model)
        if (!posterPath) throw new Error('Poster export returned no path')
        if (requestId !== this.posterRequestId || this.data.mode !== 'result' || key !== getPosterKey(this.data)) return ''
        this.setData({ posterStatus: 'ready', posterPath, posterKey: key })
        return posterPath
      } catch (error) {
        console.error('[YOUR CUT POSTER] generation failed', error)
        if (requestId === this.posterRequestId) {
          this.setData({ posterStatus: 'error', posterPath: '', posterKey: '' })
          wx.showToast({ title: 'POSTER GENERATION FAILED', icon: 'none' })
        }
        return ''
      } finally {
        if (requestId === this.posterRequestId) {
          this.posterGeneration = null
          if (wx.hideLoading) wx.hideLoading()
        }
      }
    })()

    return this.posterGeneration
  },
  async previewPoster() {
    const posterPath = await this.ensurePoster()
    if (!posterPath) return
    wx.previewImage({
      current: posterPath,
      urls: [posterPath],
      fail: (error) => {
        console.error('[YOUR CUT POSTER] preview failed', error)
        wx.showToast({ title: 'POSTER PREVIEW FAILED', icon: 'none' })
      }
    })
  },
  async savePoster() {
    if (this.data.posterStatus === 'saving') {
      wx.showToast({ title: 'SAVING...', icon: 'none' })
      return
    }

    const posterPath = await this.ensurePoster()
    if (!posterPath) return
    this.setData({ posterStatus: 'saving' })

    if (!wx.saveImageToPhotosAlbum) {
      const error = new Error('saveImageToPhotosAlbum unavailable')
      console.error('[YOUR CUT POSTER] save failed', error)
      this.setData({ posterStatus: 'error' })
      wx.showToast({ title: 'SAVE FAILED', icon: 'none' })
      return
    }

    wx.saveImageToPhotosAlbum({
      filePath: posterPath,
      success: () => {
        this.setData({ posterStatus: 'saved' })
        wx.showToast({ title: 'SAVED TO PHOTOS', icon: 'none' })
      },
      fail: (error) => {
        this.setData({ posterStatus: 'error' })
        handlePosterSaveFailure(error)
      }
    })
  },
  goBack() { wx.navigateBack({ delta: 1 }) },
  openWrapped() { wx.navigateTo({ url: '/pages/index/index' }) }
})
