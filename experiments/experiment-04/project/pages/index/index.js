Page({
  data: {
    primaryActionText: 'START',
    clearedCount: 0,
    soundOn: true,
  },

  onShow() {
    const progress = getApp().globalData.progress
    const hasHistory = progress.clearedLevels.length > 0 || Object.keys(progress.levelProgress).length > 0
    this.setData({
      primaryActionText: hasHistory ? 'CONTINUE' : 'START',
      clearedCount: progress.clearedLevels.length,
      soundOn: progress.soundOn,
    })
  },

  startGame() {
    const progress = getApp().globalData.progress
    const levelId = progress.lastLevel >= 1 && progress.lastLevel <= progress.unlockedLevel
      ? progress.lastLevel
      : progress.unlockedLevel
    wx.navigateTo({ url: `/pages/game/game?level=${levelId}` })
  },

  openLevelSelect() {
    wx.navigateTo({ url: '/pages/levels/levels' })
  },

  toggleSound() {
    const app = getApp()
    const progress = app.saveProgress({
      ...app.globalData.progress,
      soundOn: !app.globalData.progress.soundOn,
    })
    this.setData({ soundOn: progress.soundOn })
  },
})
