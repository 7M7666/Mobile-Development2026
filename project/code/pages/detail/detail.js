const summerData = require('../../services/summer-data')

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
    journey: null,
    selectedPhotos: [],
    galleryRows: [],
    galleryUrls: [],
    tags: [],
    topMoment: null,
    error: false
  },

  onLoad(options) {
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

    Promise.all(selectedPhotos.map(readImageInfo)).then((photos) => {
      this.setData({
        galleryRows: buildGalleryRows(photos),
        galleryUrls: [coverPhoto, ...photos].filter(Boolean).map((photo) => photo.src)
      })
    })
  },

  previewPhoto(event) {
    const current = event.currentTarget.dataset.src
    wx.previewImage({ current, urls: this.data.galleryUrls })
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({ url: '/pages/home/home' })
  }
})
