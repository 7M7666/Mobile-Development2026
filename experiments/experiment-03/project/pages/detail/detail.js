var common = require('../../utils/common.js')

Page({
  data: {
    news: {},
    isCollected: false
  },

  onLoad: function (options) {
    var id = options.id
    var result = common.getNewsDetail(id)

    if (result.code === '200') {
      this.saveHistory(result.news)
    }

    var key = 'news_' + id
    var saved = wx.getStorageSync(key)

    this.setData({
      news: result.news,
      isCollected: !!saved
    })
  },

  saveHistory: function (news) {
    var history = wx.getStorageSync('news_history') || []
    var list = []

    for (var i = 0; i < history.length; i++) {
      if (history[i].id !== news.id) {
        list.push(history[i])
      }
    }

    list.unshift(news)
    wx.setStorageSync('news_history', list.slice(0, 5))
  },

  toggleCollect: function () {
    var news = this.data.news
    var key = 'news_' + news.id

    if (this.data.isCollected) {
      wx.removeStorageSync(key)

      this.setData({
        isCollected: false
      })
    } else {
      wx.setStorageSync(key, news)

      this.setData({
        isCollected: true
      })
    }
  },

  onShareAppMessage: function () {
    var news = this.data.news

    return {
      title: news.title,
      path: '/pages/detail/detail?id=' + news.id
    }
  }
})
