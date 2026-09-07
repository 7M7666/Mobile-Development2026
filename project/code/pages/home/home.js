const summerData = require('../../services/summer-data')

Page({
  data: { markers: [], polyline: [], stops: [], mapCenter: { latitude: 33.1, longitude: 98.3 }, mapScale: 3 },

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
