const slides = [
  { number: '01', name: 'Cover' },
  { number: '02', name: 'Intro' },
  { number: '03', name: 'Days' },
  { number: '04', name: 'Timeline' },
  { number: '05', name: 'Places Intro' },
  { number: '06', name: 'Summer Map' },
  { number: '07', name: 'Top Place' },
  { number: '08', name: 'Biggest Day' },
  { number: '09', name: 'Top Moments' },
  { number: '10', name: 'Photo Number' },
  { number: '11', name: 'Planned vs Reality' },
  { number: '12', name: 'Summer Soundtrack' },
  { number: '13', name: 'Summer Type' },
  { number: '14', name: 'Final Poster' }
]

function getProgress(current) {
  return slides.map((item, index) => {
    let state = 'upcoming'

    if (index < current) {
      state = 'done'
    } else if (index === current) {
      state = 'current'
    }

    return { index, state }
  })
}

function getSafeArea() {
  const info = wx.getWindowInfo
    ? wx.getWindowInfo()
    : wx.getSystemInfoSync()
  const statusBar = info.statusBarHeight || 0
  const screenHeight = info.screenHeight || info.windowHeight || 0
  const bottom = info.safeArea
    ? Math.max(screenHeight - info.safeArea.bottom, 0)
    : 0
  const menu = wx.getMenuButtonBoundingClientRect()
  const top = Math.max(statusBar, menu.bottom || 0) + 8

  return { top, bottom }
}

Page({
  data: {
    currentSlide: 0,
    totalSlides: slides.length,
    animationKey: 0,
    slide: slides[0],
    progress: getProgress(0),
    showTap: true,
    top: 0,
    bottom: 0
  },

  onLoad() {
    this.setSafeArea()
  },

  onResize() {
    this.setSafeArea()
  },

  setSafeArea() {
    this.setData(getSafeArea())
  },

  goTo(index) {
    const last = this.data.totalSlides - 1
    const current = Math.min(Math.max(index, 0), last)

    if (current === this.data.currentSlide) {
      return
    }

    this.setData({
      currentSlide: current,
      slide: slides[current],
      progress: getProgress(current),
      animationKey: this.data.animationKey + 1
    })
  },

  next() {
    this.goTo(this.data.currentSlide + 1)
  },

  previous() {
    this.goTo(this.data.currentSlide - 1)
  },

  replay() {
    this.setData({
      currentSlide: 0,
      slide: slides[0],
      progress: getProgress(0),
      animationKey: this.data.animationKey + 1
    })
  }
})
