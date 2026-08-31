Page({
  data: {
    hasUserInfo: false,

    userInfo: {
      avatarUrl: '',
      nickName: ''
    },

    collectList: [],
    historyList: []
  },

  onShow: function () {
    var info = wx.getStorageInfoSync()
    var keys = info.keys
    var list = []

    for (var i = 0; i < keys.length; i++) {

      if (
        keys[i].indexOf('news_') === 0 &&
        keys[i] !== 'news_history'
      ) {

        var news = wx.getStorageSync(keys[i])

        if (news) {
          list.push(news)
        }
      }
    }

    var history = wx.getStorageSync('news_history') || []

    this.setData({
      collectList: list,
      historyList: history
    })
  },

  onChooseAvatar: function (e) {
    var avatarUrl = e.detail.avatarUrl

    this.setData({
      'userInfo.avatarUrl': avatarUrl
    })
  },

  onInputChange: function (e) {
    var nickName = e.detail.value

    this.setData({
      'userInfo.nickName': nickName
    })
  },

  login: function () {
    var userInfo = this.data.userInfo

    if (!userInfo.avatarUrl || !userInfo.nickName) {

      wx.showToast({
        title: '请完善头像和昵称',
        icon: 'none'
      })

      return
    }

    this.setData({
      hasUserInfo: true
    })
  },

  logout: function () {
    this.setData({
      hasUserInfo: false,

      userInfo: {
        avatarUrl: '',
        nickName: ''
      }
    })
  },

  goDetail: function (e) {
    var id = e.currentTarget.dataset.id

    wx.navigateTo({
      url: '/pages/detail/detail?id=' + id
    })
  }
})
