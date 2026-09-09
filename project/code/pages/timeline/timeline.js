const summerData = require('../../services/summer-data')
const visitor = require('../../services/visitor-state')

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
    journeyMode: 'my', dayOptions: [3, 5, 7], route: visitor.getDefaultState().route,
    priorityOptions: [], activeStops: [], skippedStops: [], routeResult: [], routePath: '',
    skippedNames: '', omittedNames: '', routeError: '', routeSaved: '', generated: false, dragId: '', dragOverId: '', pressedId: '',
    filters: ['ALL', 'JUL', 'AUG'],
    activeFilter: 'ALL',
    journeys: [],
    emptyMessage: ''
  },

  onLoad(options = {}) {
    if (options.mode === 'your') this.setData({ journeyMode: 'your' })
    this.allJourneys = summerData.getJourneys().map(journeyView)
    this.applyFilter()
  },

  onShow() {
    const route = visitor.loadVisitorState().route
    this.setData({ generated: Boolean(route.days), routeError: '', routeSaved: '' })
    this.renderRoute(route)
  },
  onHide() { this.cancelDrag() },
  onUnload() { this.cancelDrag() },
  selectMode(event) {
    const mode = event.currentTarget.dataset.mode
    if (!['my', 'your'].includes(mode)) return
    this.cancelDrag()
    this.setData({ journeyMode: mode })
  },
  renderRoute(value) {
    const route = visitor.normalizeRoute(value)
    const order = route.order.length || route.skipped.length ? route.order : visitor.PLACE_IDS
    const stops = (ids) => ids.map((id) => {
      const journey = this.allJourneys.find((item) => item.placeId === id)
      return { id, name: visitor.PLACE_NAMES[id], cover: journey && journey.coverPhoto ? journey.coverPhoto.src : '' }
    })
    const result = this.data.generated ? visitor.buildRoute(route) : []
    this.setData({ route, activeStops: stops(order), skippedStops: stops(route.skipped),
      priorityOptions: visitor.PRIORITIES.map((item) => ({ ...item, selected: route.priorities.includes(item.id) })),
      routeResult: result, routePath: [...new Set(result.map((item) => item.name))].join(' → '),
      skippedNames: route.skipped.map((id) => visitor.PLACE_NAMES[id]).join(' · '),
      omittedNames: route.days ? route.order.slice(route.days).map((id) => visitor.PLACE_NAMES[id]).join(' · ') : '' })
  },
  persistRoute(patch) {
    const result = visitor.updateRoute({ ...this.data.route, order: this.data.activeStops.map((item) => item.id), ...patch })
    this.setData({ routeError: '', routeSaved: result.persisted ? '已自动保存到本机' : '暂存本次访问，未能写入本地；可再次点保存重试。' })
    this.renderRoute(result.state.route)
  },
  selectDays(event) {
    const days = Number(event.currentTarget.dataset.days)
    if ([3, 5, 7].includes(days)) this.persistRoute({ days })
  },
  selectPriority(event) {
    const id = event.currentTarget.dataset.id
    if (!visitor.PRIORITIES.some((item) => item.id === id)) return
    const priorities = [...this.data.route.priorities]
    const index = priorities.indexOf(id)
    if (index >= 0) priorities.splice(index, 1)
    else if (priorities.length >= 2) { wx.showToast({ title: '最多选择两个。', icon: 'none' }); return }
    else priorities.push(id)
    this.persistRoute({ priorities })
  },
  toggleStop(event) {
    this.cancelDrag()
    const id = event.currentTarget.dataset.id
    if (!visitor.PLACE_IDS.includes(id)) return
    let order = this.data.activeStops.map((item) => item.id)
    let skipped = [...this.data.route.skipped]
    if (skipped.includes(id)) { skipped = skipped.filter((item) => item !== id); order.push(id) }
    else { order = order.filter((item) => item !== id); skipped.push(id) }
    this.persistRoute({ order, skipped })
  },
  generateRoute() {
    if (!this.data.route.days) { this.setData({ routeError: '请先选择旅行天数。' }); return }
    if (!this.data.activeStops.length) { this.setData({ routeError: '至少保留一个地点，才能生成路线。' }); return }
    this.setData({ generated: true })
    this.persistRoute({})
  },
  touchRouteStart(event) {
    const touch = event.touches && event.touches[0]
    const id = event.currentTarget.dataset.id
    if (!touch || !this.data.activeStops.some((item) => item.id === id)) return
    this.drag = { id, y: touch.clientY, target: id, rects: null }
    this.setData({ pressedId: id })
  },
  startRouteDrag(event) {
    const drag = this.drag
    if (!drag || drag.id !== event.currentTarget.dataset.id) return
    this.setData({ dragId: drag.id, dragOverId: drag.id })
    wx.createSelectorQuery().in(this).selectAll('.route-sort-card').boundingClientRect((rects) => {
      if (this.drag !== drag || !Array.isArray(rects) || rects.length !== this.data.activeStops.length) return
      drag.rects = rects.map((rect, index) => ({ top: rect.top, bottom: rect.bottom, id: this.data.activeStops[index].id }))
      this.updateDragTarget()
    }).exec()
  },
  updateDragTarget() {
    const drag = this.drag
    if (!drag || !drag.rects || !drag.rects.length) return
    const closest = drag.rects.reduce((best, rect) => Math.abs(drag.y - (rect.top + rect.bottom) / 2) < Math.abs(drag.y - (best.top + best.bottom) / 2) ? rect : best)
    drag.target = closest.id
    if (this.data.dragOverId !== closest.id) this.setData({ dragOverId: closest.id })
  },
  moveRouteDrag(event) {
    const touch = event.touches && event.touches[0]
    if (!this.drag || !touch || !Number.isFinite(touch.clientY)) return
    this.drag.y = touch.clientY
    if (this.data.dragId) this.updateDragTarget()
  },
  endRouteDrag() {
    const drag = this.drag
    const active = Boolean(this.data.dragId)
    this.cancelDrag()
    if (!drag || !active) return
    const order = this.data.activeStops.map((item) => item.id)
    const from = order.indexOf(drag.id)
    const to = order.indexOf(drag.target)
    if (from < 0 || to < 0 || from === to) return
    order.splice(from, 1)
    order.splice(to, 0, drag.id)
    this.persistRoute({ order })
  },
  cancelDrag() {
    this.drag = null
    if (this.data.dragId || this.data.pressedId) this.setData({ dragId: '', dragOverId: '', pressedId: '' })
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
