const summerData = require('../../services/summer-data')

function monthOf(journey) {
  if (journey.month) return journey.month
  const value = journey.date || journey.dateRange || ''
  const match = /-(\d{2})-/.exec(value)
  return match ? match[1] : ''
}

function journeyView(journey) {
  const photoTags = journey.photos.reduce((result, photo) => result.concat(photo.tags), [])
  const tags = [...new Set(journey.tags.concat(photoTags))].slice(0, 3)

  return {
    ...journey,
    name: journey.place ? journey.place.name : journey.placeId,
    city: journey.place ? journey.place.city : null,
    month: journey.date ? monthOf(journey) : (journey.order <= 2 ? '07' : '08'),
    dateLabel: journey.dateRange || journey.date || (journey.order <= 2 ? 'JUL / ARCHIVE' : 'AUG / ARCHIVE'),
    title: journey.title || `SUMMER STOP ${String(journey.order).padStart(2, '0')}`,
    memory: journey.intro || (journey.coverPhoto ? journey.coverPhoto.title : 'MEMORY NOTE TO BE ADDED.'),
    theme: {
      nanning: 'nanning',
      guiping: 'guiping',
      urumqi: 'urumqi',
      bayinbuluke: 'bayinbuluke'
    }[journey.placeId] || 'neutral',
    accent: {
      nanning: '#FF5944',
      guiping: '#A7B59F',
      urumqi: '#9891F5',
      bayinbuluke: '#A8D900'
    }[journey.placeId] || '#242522',
    tags
  }
}

Page({
  data: {
    filters: ['ALL', 'JUL', 'AUG'],
    activeFilter: 'ALL',
    journeys: [],
    emptyMessage: ''
  },

  onLoad() {
    this.allJourneys = summerData.getJourneys().map(journeyView)
    this.applyFilter()
  },

  selectFilter(event) {
    const filter = event.currentTarget.dataset.filter
    if (!filter || filter === this.data.activeFilter) return
    this.setData({ activeFilter: filter }, () => this.applyFilter())
  },

  applyFilter() {
    const filter = this.data.activeFilter
    const targetMonth = filter === 'JUL' ? '07' : filter === 'AUG' ? '08' : ''
    const journeys = targetMonth
      ? this.allJourneys.filter((journey) => journey.month === targetMonth)
      : this.allJourneys

    this.setData({
      journeys,
      emptyMessage: targetMonth && !journeys.length
        ? `NO CONFIRMED ${filter} STOP DATES YET.`
        : ''
    })
  },

  openDetail(event) {
    const id = event.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  }
})
