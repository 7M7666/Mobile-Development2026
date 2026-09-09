const retained = new Map()
let sequence = 0

function directory() { return wx.env && wx.env.USER_DATA_PATH ? wx.env.USER_DATA_PATH + '/summer2026-pieces' : '' }
function owned(path) {
  const dir = directory()
  return Boolean(dir && typeof path === 'string' && path.startsWith(dir + '/') && /^piece-[\w-]+\.jpg$/.test(path.slice(dir.length + 1)))
}
function retain(path) { if (path) retained.set(path, (retained.get(path) || 0) + 1) }
function release(path) {
  if (retained.get(path) > 1) retained.set(path, retained.get(path) - 1)
  else retained.delete(path)
  collect()
}
function collect() {
  const dir = directory()
  if (!dir || !wx.getFileSystemManager) return
  try {
    const visitor = require('./visitor-state')
    const current = visitor.loadVisitorState().piece.localFilePath
    // A failed state write must never remove the photo still referenced on disk.
    const stored = wx.getStorageSync(visitor.STORAGE_KEY)
    const durable = stored && stored.piece && stored.piece.localFilePath
    const fs = wx.getFileSystemManager()
    fs.readdirSync(dir).forEach((name) => {
      const path = dir + '/' + name
      if (owned(path) && path !== current && path !== durable && !retained.has(path)) {
        try { fs.unlinkSync(path) } catch (error) { /* Retry on the next collection. */ }
      }
    })
  } catch (error) { /* Missing directory or unavailable storage: keep files safely. */ }
}
async function save(tempFilePath) {
  const dir = directory()
  if (!dir) throw Error('Local photo storage unavailable')
  const fs = wx.getFileSystemManager()
  try { fs.accessSync(dir) } catch (error) { fs.mkdirSync(dir, true) }
  const path = dir + '/piece-' + Date.now() + '-' + (++sequence) + '.jpg'
  retain(path)
  try {
    await new Promise((resolve, reject) => fs.copyFile({ srcPath: tempFilePath, destPath: path, success: resolve, fail: reject }))
    return path
  } catch (error) { release(path); throw error }
}

module.exports = { save, retain, release, collect, owned }
