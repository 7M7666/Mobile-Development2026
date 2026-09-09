function openPage(page, url) {
  if (page.navigating) return
  const pages = getCurrentPages()
  const route = url.split('?')[0].replace(/^\//, '')
  const index = pages.findIndex((item) => item.route === route)
  if (index === pages.length - 1 && index >= 0) return
  page.navigating = true
  const complete = () => { page.navigating = false }
  const fail = () => wx.showToast({ title: '页面暂时无法打开，请重试', icon: 'none' })
  if (index >= 0) wx.navigateBack({ delta: pages.length - 1 - index, complete, fail })
  else wx.navigateTo({ url, complete, fail })
}

module.exports = { openPage }
