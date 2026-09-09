const summerData = require('../../services/summer-data')
const visitor = require('../../services/visitor-state')
const situations = require('../../data/visitor-situations')

const placeThemes = {
  nanning: 'nanning',
  guiping: 'guiping',
  urumqi: 'urumqi',
  bayinbuluke: 'bayinbuluke'
}

function uniqueTags(journey) {
  const tags = journey.tags.slice()
  journey.photos.forEach((photo) => tags.push(...photo.tags))
  return [...new Set(tags)].slice(0, 8)
}

function buildGalleryRows(photos) {
  const rows = []
  let row = []
  let ratioTotal = 0

  const commit = () => {
    if (!row.length) return
    const gap = 12
    const availableWidth = 686 - gap * (row.length - 1)
    const rowHeight = Math.min(390, Math.max(210, availableWidth / ratioTotal))
    rows.push({
      key: `row-${rows.length}`,
      height: Math.round(rowHeight),
      photos: row.map((photo) => ({
        ...photo,
        width: Math.round(photo.ratio * rowHeight)
      }))
    })
    row = []
    ratioTotal = 0
  }

  photos.forEach((photo, index) => {
    const ratio = photo.width && photo.height ? photo.width / photo.height : 1
    const galleryPhoto = { ...photo, ratio }

    if (ratio >= 1.35) {
      commit()
      row.push(galleryPhoto)
      ratioTotal = ratio
      commit()
      return
    }

    row.push(galleryPhoto)
    ratioTotal += ratio
    if (ratioTotal >= 1.5 || row.length >= 2 || index === photos.length - 1) commit()
  })

  commit()
  return rows
}

function readImageInfo(photo) {
  return new Promise((resolve) => {
    wx.getImageInfo({
      src: photo.src,
      success: (info) => resolve({ ...photo, width: info.width, height: info.height }),
      fail: () => resolve({ ...photo, width: 1, height: 1 })
    })
  })
}

Page({
  data: {
    situation: null, decision: null, decisionRestored: false, choosing: true, decisionSaveNotice: '',
    journey: null,
    selectedPhotos: [],
    galleryRows: [],
    galleryUrls: [],
    tags: [],
    topMoment: null,
    error: false
  },

  onLoad(options = {}) {
    const journey = summerData.getJourneys().find((item) => item.id === options.id)
    if (!journey) {
      this.setData({ error: true })
      return
    }

    const moments = summerData.getWrapped().curation.moments
    const topMoment = moments.find((moment) => journey.photoIds.indexOf(moment.photoId) !== -1) || null
    const coverPhoto = journey.coverPhoto
    const seenSources = new Set(coverPhoto ? [coverPhoto.src] : [])
    const selectedPhotos = journey.photos.filter((photo) => {
      if ((coverPhoto && photo.id === coverPhoto.id) || seenSources.has(photo.src)) return false
      seenSources.add(photo.src)
      return true
    })

    this.setData({
      situation: situations[journey.placeId],
      journey: {
        ...journey,
        name: journey.place ? journey.place.name : journey.placeId,
        city: journey.place ? journey.place.city : null,
        province: journey.place ? journey.place.province : null,
        theme: placeThemes[journey.placeId] || 'neutral',
        themeColor: {
          nanning: '#FF5944',
          guiping: '#A7B59F',
          urumqi: '#9891F5',
          bayinbuluke: '#A8D900'
        }[journey.placeId] || '#ECEDE7',
        dateLabel: journey.dateRange || journey.date || 'DATE TO BE CONFIRMED',
        title: journey.title || `SUMMER STOP ${String(journey.order).padStart(2, '0')}`
      },
      selectedPhotos,
      galleryUrls: [coverPhoto, ...selectedPhotos].filter(Boolean).map((photo) => photo.src),
      tags: uniqueTags(journey),
      topMoment
    })

    if (!this.visitRecorded) {
      visitor.recordDetailVisit(journey.placeId)
      this.visitRecorded = true
    }

    Promise.all(selectedPhotos.map(readImageInfo)).then((photos) => {
      if (this.unloaded) return
      this.setData({
        galleryRows: buildGalleryRows(photos),
        galleryUrls: [coverPhoto, ...photos].filter(Boolean).map((photo) => photo.src)
      })
    })
  },

  onShow() {
    if (!this.data.journey || this.unloaded) return
    this.restoreDecision(true)
    if (this.dwellStartedAt == null) this.dwellStartedAt = Date.now()
  },
  onHide() { this.finishDwell() },
  onUnload() { this.finishDwell(); this.unloaded = true },
  finishDwell() {
    if (this.dwellStartedAt == null || !this.data.journey) return
    const startedAt = this.dwellStartedAt
    this.dwellStartedAt = null
    visitor.recordDwellTime(this.data.journey.placeId, Math.max(0, (Date.now() - startedAt) / 1000))
  },
  restoreDecision(restored) {
    const decision = visitor.getChoiceSummary().items.find((item) => item.placeId === this.data.journey.placeId)
    this.setData({ decision, decisionRestored: Boolean(restored && decision.choice), choosing: !decision.choice })
  },
  selectDecision(event) {
    if (!this.data.journey || !this.data.choosing) return
    if (!this.data.situation.choices.some((item) => item.id === event.currentTarget.dataset.choice)) return
    const result = visitor.recordDecision(this.data.journey.placeId, event.currentTarget.dataset.choice)
    if (!result.changed && !result.state.decisions[this.data.journey.placeId]) return
    this.restoreDecision(false)
    this.setData({ decisionSaveNotice: result.persisted ? '已保存到你的档案' : '暂存本次访问，未能写入本地；请重新选择以重试。' })
  },
  reselectDecision() { this.setData({ choosing: true, decisionSaveNotice: '' }) },

  previewPhoto(event) {
    const current = event.currentTarget.dataset.src
    const journey = this.data.journey
    const photo = journey && journey.photos.find((item) => item.src === current)
    if (!photo || !this.data.galleryUrls.includes(current)) return
    wx.previewImage({ current, urls: this.data.galleryUrls, success: () => visitor.recordPhotoPreview(journey.placeId, photo.id) })
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({ url: '/pages/home/home' })
  }
})
