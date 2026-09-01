const { getDefaultProgress, loadProgress, saveProgress } = require('./utils/storage')
const { createSoundManager } = require('./utils/sound')

App({
  globalData: {
    progress: getDefaultProgress(),
    activeGamePage: null,
    soundManager: null,
  },

  onLaunch() {
    this.globalData.progress = loadProgress()
    this.globalData.soundManager = createSoundManager()
    this.globalData.soundManager.setEnabled(this.globalData.progress.soundOn)
  },

  onHide() {
    const activeGamePage = this.globalData.activeGamePage
    if (activeGamePage) {
      activeGamePage.pauseExperience()
    }
  },

  onShow() {
    const activeGamePage = this.globalData.activeGamePage
    if (activeGamePage) {
      activeGamePage.resumeExperience()
    }
  },

  saveProgress(progress) {
    this.globalData.progress = saveProgress(progress)
    if (this.globalData.soundManager) {
      this.globalData.soundManager.setEnabled(this.globalData.progress.soundOn)
    }
    return this.globalData.progress
  },
})
