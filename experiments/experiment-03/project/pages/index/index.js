var common = require('../../utils/common.js')

Page({
  data: {
    newsList: [],
    filteredNewsList: [],
    categories: ['全部', '要闻', '科研', '校园', '学生'],
    currentCategory: '全部',
    searchKeyword: '',
    bannerList: [
      {
        id: '122559',
        image: '/images/研究生开学4.jpg',
        title: '海大园迎来2026级研究生'
      },
      {
        id: '122559',
        image: '/images/研究生开学1.jpg',
        title: '中国海洋大学2026级研究生开学典礼举行'
      },
      {
        id: '122559',
        image: '/images/研究生开学3.jpg',
        title: '新学期，新起点'
      },
      {
        id: '122559',
        image: '/images/研究生开学2.jpg',
        title: '2026级研究生开启海大新生活'
      }
    ]
  },
  onLoad: function () {
    var list = common.getNewsList()
    var today = new Date()
    var year = today.getFullYear()
    var month = today.getMonth() + 1
    var day = today.getDate()
    if (month < 10) {
      month = '0' + month
    }
    if (day < 10) {
      day = '0' + day
    }
    var date = year + '.' + month + '.' + day
    this.setData({
      newsList: list,
      currentDate: date
    }, () => {
      this.applyFilters()
    })
  },
  changeCategory: function (e) {
    var category = e.currentTarget.dataset.category
    this.setData({
      currentCategory: category
    }, () => {
      this.applyFilters()
    })
  },
  onSearchInput: function (e) {
    this.setData({
      searchKeyword: e.detail.value
    }, () => {
      this.applyFilters()
    })
  },
  clearSearch: function () {
    this.setData({
      searchKeyword: ''
    }, () => {
      this.applyFilters()
    })
  },
  applyFilters: function () {
    var list = this.data.newsList
    var category = this.data.currentCategory
    var keyword = this.data.searchKeyword.trim().toLowerCase()

    if (category !== '全部') {
      list = list.filter(function (item) {
        return item.category === category
      })
    }

    if (keyword) {
      list = list.filter(function (item) {
        return item.title.toLowerCase().indexOf(keyword) !== -1 ||
          item.content.toLowerCase().indexOf(keyword) !== -1
      })
    }

    this.setData({
      filteredNewsList: list
    })
  },
  goDetail: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/detail/detail?id=' + id
    })
  }
})
