const { levels } = require('../../data/levels')
const { formatTime } = require('../../utils/storage')

Page({
  data: {
    levelCards: [],
  },

  onShow() {
    this.refreshLevels()
  },

  refreshLevels() {
    const progress = getApp().globalData.progress
    const levelCards = levels.map(level => {
      const cleared = progress.clearedLevels.includes(level.id)
      const available = level.id <= progress.unlockedLevel
      const record = progress.levelProgress[level.id]

      return {
        id: level.id,
        displayId: String(level.id).padStart(2, '0'),
        name: level.name,
        status: cleared ? 'CLEARED' : available ? 'AVAILABLE' : 'LOCKED',
        locked: !available,
        bestMoves: record && record.bestMoves !== undefined ? record.bestMoves : '--',
        bestTime: record && record.bestTime !== undefined ? formatTime(record.bestTime) : '--:--',
      }
    })

    this.setData({ levelCards })
  },

  selectLevel(event) {
    const levelId = Number(event.currentTarget.dataset.id)
    const progress = getApp().globalData.progress

    if (levelId > progress.unlockedLevel) {
      wx.showToast({
        title: 'Complete the previous level first.',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({ url: `/pages/game/game?level=${levelId}` })
  },
})
