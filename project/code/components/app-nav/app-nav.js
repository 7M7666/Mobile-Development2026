const routes = {
  map: '/pages/home/home',
  journey: '/pages/timeline/timeline',
  wrapped: '/pages/index/index',
  me: '/pages/me/me'
}

Component({
  properties: {
    active: {
      type: String,
      value: ''
    }
  },

  data: {
    items: [
      { key: 'map', label: 'MAP', chinese: '地图', mark: '●' },
      { key: 'journey', label: 'JOURNEY', chinese: '旅程', mark: '↗' },
      { key: 'wrapped', label: 'WRAPPED', chinese: '回顾', mark: '▶' },
      { key: 'me', label: 'ARCHIVE', chinese: '档案', mark: '★' }
    ]
  },

  methods: {
    goTo(event) {
      const key = event.currentTarget.dataset.key
      const url = routes[key]

      if (!url || key === this.data.active) {
        return
      }

      if (key === 'wrapped') {
        wx.navigateTo({ url })
        return
      }

      const pages = getCurrentPages()
      const targetIndex = pages.findIndex((page) => `/${page.route}` === url)
      if (targetIndex >= 0 && targetIndex < pages.length - 1) {
        wx.navigateBack({ delta: pages.length - 1 - targetIndex })
      } else if (pages.length > 1) {
        wx.reLaunch({ url })
      } else {
        wx.redirectTo({ url })
      }
    }
  }
})
