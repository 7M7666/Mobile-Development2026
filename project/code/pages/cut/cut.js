const visitor = require('../../services/visitor-state')
const cut = require('../../services/your-cut')
const poster = require('../../services/summer-poster')
const files = require('../../services/piece-files')
const navigation = require('../../services/navigation')

function safe() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  const statusBar = info.statusBarHeight || 0
  const screenHeight = info.screenHeight || info.windowHeight || 0
  const bottom = info.safeArea ? Math.max(screenHeight - info.safeArea.bottom, 0) : 0
  const menu = wx.getMenuButtonBoundingClientRect()
  return { top: Math.max(statusBar, menu.bottom || 0) + 8, bottom }
}

function getSaveFailureType(error) {
  const message = String(error && (error.errMsg || error.message) || '').toLowerCase()

  if (message.indexOf('cancel') !== -1) return 'cancelled'
  if (/auth|permission|scope\.writephotosalbum/.test(message)) return 'permission'
  return 'failed'
}

function handlePosterSaveFailure(error) {
  console.error('[YOUR CUT POSTER] save failed', error)
  const type = getSaveFailureType(error)

  if (type === 'cancelled') {
    wx.showToast({ title: '已取消保存', icon: 'none' })
    return
  }

  if (type === 'permission') {
    if (!wx.showModal) {
      wx.showToast({ title: '需要相册权限', icon: 'none' })
      return
    }

    wx.showModal({
      title: '需要相册权限',
      content: '请在设置中允许保存到相册，再保存这张海报。',
      confirmText: '设置',
      cancelText: '取消',
      success: (result) => {
        if (result.confirm && wx.openSetting) wx.openSetting({
          fail: () => wx.showToast({ title: '暂时无法打开设置', icon: 'none' })
        })
      },
      fail: () => wx.showToast({ title: '需要相册权限', icon: 'none' })
    })
    return
  }

  wx.showToast({ title: '保存失败，请重试', icon: 'none' })
}

Page({
  data: { step: 1, steps: ['挑选片段', '加入你的内容', '调整排列', '生成海报'], model: null, top: 0, bottom: 0,
    editor: '', draft: '', notice: '', candidates: [], replacing: '', pieceInvalid: false, busy: false, canRestore: false,
    dragId: '', dragOverId: '', posterStatus: 'idle', posterPath: '', posterKey: '' },
  onLoad() { this.active = true; this.visibilityId = 0; this.setData(safe()); this.refreshCut(); this.checkPiece() },
  onShow() { this.active = true; this.navigating = false; files.collect(); if (this.data.model) { this.refreshCut(); this.checkPiece() } },
  onHide() { this.active = false; this.visibilityId += 1; this.cancelDrag() },
  onUnload() { this.cancelDrag(); this.active = false; this.visibilityId += 1; this.pieceRequestId = (this.pieceRequestId || 0) + 1; this.clearUndo(); this.unloaded = true; this.posterRequestId = (this.posterRequestId || 0) + 1; if (wx.hideLoading) wx.hideLoading() },
  onResize() { this.cancelDrag(); this.setData(safe()) },
  refreshCut() {
    if (this.unloaded) return
    const model = cut.getModel()
    if (!this.data.model || model.signature !== this.data.model.signature) this.invalidatePoster({ model, candidates: [], replacing: '', pieceInvalid: false })
    else this.setData({ model })
    if (JSON.stringify(visitor.loadVisitorState().cut) !== JSON.stringify({ photoIds: model.photoIds, automatic: model.automatic, order: model.order, kept: model.kept })) {
      this.saved(cut.persist(model))
    }
  },
  saved(result) { if (result && !result.persisted) this.setData({ notice: '暂存本次访问，未能写入本地；请稍后重试。' }) },
  async checkPiece() {
    const piece = this.data.model.piece
    const invalid = piece.type === 'photo' && !await cut.checkPhoto(piece.localFilePath)
    if (this.unloaded || piece.localFilePath !== this.data.model.piece.localFilePath) return
    this.setData({ pieceInvalid: invalid })
    if (invalid) this.invalidatePoster({ notice: '这张照片暂时无法使用，请重新选择。' })
  },
  goStep(event) {
    if (this.data.busy) return
    const step = Number(event.currentTarget.dataset.step)
    if (step < 1 || step > 4) return
    if (step >= 3 && (!this.data.model.piece.type || this.data.pieceInvalid)) {
      this.setData({ step: 2, notice: this.data.pieceInvalid ? '这张照片暂时无法使用，请重新选择。' : '先留下一张照片、一个地点，或一句话。' }); return
    }
    this.cancelDrag(); this.setData({ step, editor: '', notice: '', replacing: '', candidates: [] })
  },
  keepPhoto(event) {
    const id = event.currentTarget.dataset.id, model = this.data.model
    if (!model.photoIds.includes(id)) return
    this.saved(cut.persist(model, { kept: [...new Set(model.kept.concat(id))], automatic: false })); this.refreshCut()
  },
  openReplace(event) {
    const id = event.currentTarget.dataset.id
    this.setData({ replacing: id, candidates: cut.candidates(id), notice: '' })
  },
  closeReplace() { this.setData({ replacing: '', candidates: [] }) },
  replacePhoto(event) {
    this.saved(cut.replace(this.data.replacing, event.currentTarget.dataset.id)); this.refreshCut(); this.closeReplace()
  },
  confirm(content, title = '替换当前内容？', confirmText = '替换') {
    return new Promise((resolve) => wx.showModal({ title, content, confirmText, success: (result) => resolve(Boolean(result.confirm)), fail: () => resolve(false) }))
  },
  async editPiece(event) {
    if (this.data.busy) return
    const type = event.currentTarget.dataset.type
    if (!['photo', 'place', 'text'].includes(type)) return
    this.setData({ busy: true, notice: '' })
    const revision = visitor.getPieceRevision()
    const request = this.pieceRequestId = (this.pieceRequestId || 0) + 1
    const currentRequest = () => !this.unloaded && this.active && request === this.pieceRequestId && revision === visitor.getPieceRevision()
    try {
      const current = this.data.model.piece
      if (current.type && current.type !== type && !await this.confirm('只保留一种内容。保存新内容后，将替换当前的这一块夏天。')) return
      if (!currentRequest()) return
      if (type === 'photo') {
        const piece = await cut.choosePhoto()
        if (!currentRequest()) { files.release(piece.localFilePath); return }
        this.clearUndo(); this.saved(visitor.setPiece(piece)); files.release(piece.localFilePath); this.setData({ pieceInvalid: false, editor: '' }); this.refreshCut()
      } else this.setData({ editor: type, draft: type === 'place' ? (current.place || this.data.model.pinPlace || '') : (current.text || '') })
    } catch (error) {
      if (!this.unloaded && !/cancel/i.test(String(error.errMsg || error.message))) this.setData({ notice: '这张照片暂时无法使用，请重新选择。' })
    } finally { if (!this.unloaded) this.setData({ busy: false }) }
  },
  inputPiece(event) { this.setData({ draft: event.detail.value }) },
  usePin() { this.setData({ draft: this.data.model.pinPlace }) },
  savePiece() {
    const type = this.data.editor
    if (!['place', 'text'].includes(type)) return
    const result = visitor.setPiece(type === 'place' ? { type, place: this.data.draft } : { type, text: this.data.draft })
    if (!result.valid) { this.setData({ notice: type === 'place' ? '请输入 1–30 字的地点。' : '请留下一句 40 字以内的话。' }); return }
    this.clearUndo(); this.setData({ editor: '', notice: '', pieceInvalid: false }); this.saved(result); this.refreshCut()
  },
  cancelEdit() { this.setData({ editor: '', draft: '', notice: '' }) },
  removePiece() {
    if (this.data.busy) return
    this.clearUndo()
    this.removedPiece = this.data.model.piece
    files.retain(this.removedPiece.localFilePath)
    this.removedOrder = this.data.model.order
    this.saved(visitor.setPiece(null)); this.setData({ pieceInvalid: false, editor: '', step: 2, canRestore: true }); this.refreshCut()
  },
  restorePiece() {
    if (!this.removedPiece) return
    this.saved(visitor.setPiece(this.removedPiece)); files.release(this.removedPiece.localFilePath); this.removedPiece = null
    this.saved(cut.persist(cut.getModel(), { order: this.removedOrder }))
    this.setData({ canRestore: false }); this.refreshCut(); this.checkPiece()
  },
  clearUndo() {
    if (this.removedPiece) files.release(this.removedPiece.localFilePath)
    this.removedPiece = null
  },
  touchSlotStart(event) {
    const touch = event.touches && event.touches[0]
    if (touch) this.drag = { id: event.currentTarget.dataset.id, x: touch.clientX, y: touch.clientY, target: event.currentTarget.dataset.id }
  },
  startSlotDrag(event) {
    if (this.data.step !== 3) return
    const drag = this.drag
    if (!drag || drag.id !== event.currentTarget.dataset.id) return
    this.setData({ dragId: drag.id, dragOverId: drag.id })
    wx.createSelectorQuery().in(this).selectAll('.arrange-slot').boundingClientRect((rects) => {
      if (this.unloaded || !this.active || this.drag !== drag || !Array.isArray(rects) || rects.length !== this.data.model.elements.length) return
      drag.rects = rects.map((rect, index) => ({ ...rect, id: this.data.model.order[index] })); this.updateDrag()
    }).exec()
  },
  moveSlotDrag(event) {
    const touch = event.touches && event.touches[0]
    if (!touch || !this.drag) return
    this.drag.x = touch.clientX; this.drag.y = touch.clientY
    if (this.data.dragId) this.updateDrag()
  },
  updateDrag() {
    const drag = this.drag
    if (this.unloaded || !this.active || !drag || !drag.rects || !drag.rects.length) return
    const distance = (r) => Math.pow(drag.x - (r.left + r.right) / 2, 2) + Math.pow(drag.y - (r.top + r.bottom) / 2, 2)
    const target = drag.rects.reduce((a, b) => distance(a) < distance(b) ? a : b)
    drag.target = target.id; this.setData({ dragOverId: target.id })
  },
  endSlotDrag() {
    const drag = this.drag, active = this.data.dragId
    this.cancelDrag()
    if (drag && active) { this.saved(cut.move(drag.id, drag.target)); this.refreshCut() }
  },
  cancelDrag() { this.drag = null; if (!this.unloaded) this.setData({ dragId: '', dragOverId: '' }) },
  async resetCut() {
    if (this.data.busy) return
    this.setData({ busy: true })
    try {
      if (this.data.model.piece.type && !await this.confirm('重新做一版会移除当前 Piece 和排列；MAP、Journey、选择、浏览记录与歌曲都会保留。', '重新做一版？', '重新制作')) return
      if (this.unloaded) return
      const persisted = visitor.resetCut(); this.clearUndo()
      this.invalidatePoster({ step: 1, editor: '', pieceInvalid: false, canRestore: false, notice: '' }); this.refreshCut(); this.saved({ persisted })
    } finally { if (!this.unloaded) this.setData({ busy: false }) }
  },
  invalidatePoster(changes = {}) {
    this.posterRequestId = (this.posterRequestId || 0) + 1
    this.posterGeneration = null
    if (wx.hideLoading) wx.hideLoading()
    this.setData({ ...changes, posterStatus: 'idle', posterPath: '', posterKey: '' })
  },
  getPosterCanvas() {
    return new Promise((resolve) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#cut-poster-canvas')
        .fields({ node: true, size: true })
        .exec((result) => resolve(result[0] && result[0].node ? result[0].node : null))
    })
  },
  async ensurePoster() {
    if (this.unloaded) return ''
    this.refreshCut()
    await this.checkPiece()
    if (this.unloaded) return ''
    this.refreshCut()
    if (this.data.step !== 4 || this.data.model.photoIds.length !== 4 || !this.data.model.piece.type || this.data.pieceInvalid) {
      this.setData({ posterStatus: 'error', posterPath: '', posterKey: '' })
      wx.showToast({ title: this.data.pieceInvalid ? '请重新选择照片' : '请先加入你的一小块夏天', icon: 'none' })
      return Promise.resolve('')
    }

    const key = this.data.model.signature
    if (this.data.posterPath && this.data.posterKey === key) {
      if (this.data.posterStatus !== 'ready') this.setData({ posterStatus: 'ready' })
      return Promise.resolve(this.data.posterPath)
    }

    if (this.posterGeneration) return this.posterGeneration

    const requestId = (this.posterRequestId || 0) + 1
    const model = this.data.model
    this.posterRequestId = requestId
    this.setData({ posterStatus: 'generating', posterPath: '', posterKey: '' })
    if (wx.showLoading) wx.showLoading({ title: '正在生成', mask: true })

    files.retain(model.piece.localFilePath)
    this.posterGeneration = (async () => {
      try {
        if (model.piece.type === 'photo' && !await cut.checkPhoto(model.piece.localFilePath)) throw Error('这张照片暂时无法使用，请重新选择。')
        const canvas = await this.getPosterCanvas()
        if (!canvas) throw new Error('Canvas unavailable')
        if (this.unloaded || requestId !== this.posterRequestId || key !== cut.getModel().signature) return ''
        const posterPath = await poster.generateYourCutPoster(canvas, model)
        if (!posterPath) throw new Error('Poster export returned no path')
        if (this.unloaded || requestId !== this.posterRequestId || cut.getModel().signature !== key || this.data.step !== 4 || key !== this.data.model.signature) return ''
        this.setData({ posterStatus: 'ready', posterPath, posterKey: key })
        return posterPath
      } catch (error) {
        console.error('[YOUR CUT POSTER] generation failed', error)
        if (!this.unloaded && requestId === this.posterRequestId) {
          this.setData({ posterStatus: 'error', posterPath: '', posterKey: '' })
          this.setData({ notice: model.piece.type === 'photo' ? '这张照片暂时无法使用，请重新选择。' : '海报生成失败，请重试。' })
        }
        return ''
      } finally {
        files.release(model.piece.localFilePath)
        if (!this.unloaded && requestId === this.posterRequestId) {
          this.posterGeneration = null
          if (wx.hideLoading) wx.hideLoading()
        }
      }
    })()

    return this.posterGeneration
  },
  async previewPoster() {
    if (this.previewing) return
    this.previewing = true
    const visibility = this.visibilityId
    try {
    const posterPath = await this.ensurePoster()
    if (!posterPath || this.unloaded || !this.active || visibility !== this.visibilityId || this.data.posterKey !== cut.getModel().signature) return
    wx.previewImage({
      current: posterPath,
      urls: [posterPath],
      fail: (error) => {
        console.error('[YOUR CUT POSTER] preview failed', error)
        wx.showToast({ title: '预览失败，请重试', icon: 'none' })
      }
    })
    } finally { this.previewing = false }
  },
  async savePoster() {
    if (this.posterSaving) return
    this.posterSaving = true
    const visibility = this.visibilityId
    try {
      const posterPath = await this.ensurePoster()
      if (!posterPath || this.unloaded || !this.active || visibility !== this.visibilityId || this.data.posterKey !== cut.getModel().signature) return
      const requestId = this.posterRequestId
      this.setData({ posterStatus: 'saving' })
      try {
        await new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({
          filePath: posterPath,
          success: resolve,
          fail: reject
        }))
        if (this.unloaded || !this.active || visibility !== this.visibilityId || requestId !== this.posterRequestId) return
        this.setData({ posterStatus: 'saved' })
        wx.showToast({ title: '已保存到相册', icon: 'none' })
      } catch (error) {
        if (this.unloaded || !this.active || visibility !== this.visibilityId || requestId !== this.posterRequestId) return
        this.setData({ posterStatus: 'error' })
        handlePosterSaveFailure(error)
      }
    } finally {
      this.posterSaving = false
    }
  },
  goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack({ delta: 1 })
    else wx.reLaunch({ url: '/pages/me/me' })
  },
  openWrapped() { navigation.openPage(this, '/pages/index/index') }
})
