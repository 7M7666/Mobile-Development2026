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
      { key: 'map', label: 'MAP', mark: '●' },
      { key: 'journey', label: 'JOURNEY', mark: '↗' },
      { key: 'wrapped', label: 'WRAPPED', mark: '▶' },
      { key: 'me', label: 'ME', mark: '★' }
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

      wx.redirectTo({ url })
    }
  }
})
