const summerData = require('../../services/summer-data')

const archivePhotoIds = ['nanning-water-street', 'guiping-xishan-pavilion', 'urumqi-bazaar-carpets', 'xinjiang-grassland', 'golden-puppy']

Page({
  data: { stats: null, archivePhotos: [], places: [], moments: [] },
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
  openDetail(event) { const id = event.currentTarget.dataset.id; if (id) wx.navigateTo({ url: `/pages/detail/detail?id=${id}` }) },
  openWrapped() { wx.navigateTo({ url: '/pages/index/index' }) },
  openWrappedSlide(event) { wx.navigateTo({ url: `/pages/index/index?slide=${event.currentTarget.dataset.slide}` }) },
  openCut() { wx.navigateTo({ url: '/pages/cut/cut' }) }
})
