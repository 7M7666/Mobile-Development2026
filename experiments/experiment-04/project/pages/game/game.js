const { levels } = require('../../data/levels')
const { checkWin, isTarget, isWall, resetLevel, tryMove } = require('../../utils/game')
const { formatTime } = require('../../utils/storage')

const MAX_UNDO_HISTORY = 100
const SWIPE_THRESHOLD = 28
const MOVE_DURATION = 100
const CLEAR_PULSE_DURATION = 300
const IDLE_DELAY = 2400
const IDLE_DURATION = 1000
const ASSETS = {
  floor: '../../assets/tiles/floor-wood.png',
  wall: '../../assets/tiles/wall-wood.png',
  targetFish: '../../assets/fish/target-fish-blue.png',
  bowlEmpty: '../../assets/bowl/bowl-empty.png',
  bowlFull: '../../assets/bowl/bowl-full.png',
  catDefault: '../../assets/cat/cat-default.png',
  catIdle1: '../../assets/cat/cat-idle-1.png',
  catIdle2: '../../assets/cat/cat-idle-2.png',
  catWalk1: '../../assets/cat/cat-walk-1.png',
  catWalk2: '../../assets/cat/cat-walk-2.png',
  catWalk3: '../../assets/cat/cat-walk-3.png',
}

function clonePosition(position) {
  return { row: position.row, col: position.col }
}

function clonePositions(positions) {
  return positions.map(clonePosition)
}

function interpolatePosition(start, end, progress) {
  return {
    row: start.row + (end.row - start.row) * progress,
    col: start.col + (end.col - start.col) * progress,
  }
}

Page({
  data: {
    levelId: 1,
    levelName: '',
    moves: 0,
    pushes: 0,
    timeText: '00:00',
    hasUndo: false,
    isCleared: false,
    isFinalLevel: false,
    hasNextLevel: true,
    statusText: '',
    isBusy: false,
    soundOn: true,
  },

  onLoad(options) {
    const requestedLevelId = Number(options.level)
    const progress = getApp().globalData.progress
    const requestedLevel = levels.find(level => level.id === requestedLevelId)
    const levelId = requestedLevel && requestedLevel.id <= progress.unlockedLevel
      ? requestedLevel.id
      : 1

    this.loadLevel(levelId)
  },

  onReady() {
    this.initCanvas()
  },

  onShow() {
    getApp().globalData.activeGamePage = this
    this.resumeExperience()
  },

  onHide() {
    this.pauseExperience()
    if (getApp().globalData.activeGamePage === this) {
      getApp().globalData.activeGamePage = null
    }
  },

  onUnload() {
    this.pauseExperience()
    this.cancelAnimationFrames()
    if (getApp().globalData.activeGamePage === this) {
      getApp().globalData.activeGamePage = null
    }
  },

  loadLevel(levelId) {
    const level = levels.find(item => item.id === levelId) || levels[0]

    this.stopTimer()
    this.currentLevel = level
    this.initialState = {
      staticMap: level.staticMap,
      targets: level.targets.map(clonePosition),
      player: clonePosition(level.playerStart),
      boxes: level.boxesStart.map(clonePosition),
    }
    this.gameState = resetLevel(this.initialState)
    this.moves = 0
    this.pushes = 0
    this.elapsed = 0
    this.timerRunning = false
    this.timerStartedAt = null
    this.timerHasStarted = false
    this.undoStack = []
    this.deferredClear = false
    this.clearSoundPlayed = false
    this.syncVisualState()

    const app = getApp()
    app.saveProgress({ ...app.globalData.progress, lastLevel: level.id })
    this.setData({
      levelId: level.id,
      levelName: level.name,
      moves: 0,
      pushes: 0,
      timeText: '00:00',
      hasUndo: false,
      isCleared: false,
      isFinalLevel: false,
      hasNextLevel: level.id < levels.length,
      statusText: `LEVEL ${level.id}: ${level.name}`,
      isBusy: false,
      soundOn: app.globalData.progress.soundOn,
    })
    this.render()
    this.resetIdle()
  },

  initCanvas() {
    wx.createSelectorQuery()
      .select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec(result => {
        const canvasInfo = result[0]
        if (!canvasInfo || !canvasInfo.node) {
          return
        }

        const pixelRatio = wx.getSystemInfoSync().pixelRatio || 1
        this.canvas = canvasInfo.node
        this.ctx = this.canvas.getContext('2d')
        this.canvasWidth = canvasInfo.width
        this.canvasHeight = canvasInfo.height
        this.canvas.width = this.canvasWidth * pixelRatio
        this.canvas.height = this.canvasHeight * pixelRatio
        this.ctx.scale(pixelRatio, pixelRatio)
        this.ctx.imageSmoothingEnabled = false
        this.loadAssets()
        this.render()
      })
  },

  loadAssets() {
    if (!this.canvas || this.assetsLoading) {
      return
    }

    this.assetsLoading = true
    this.images = {}
    let remaining = Object.keys(ASSETS).length
    const finishLoading = () => {
      remaining -= 1
      if (remaining === 0) {
        this.assetsReady = true
        this.render()
      }
    }

    Object.keys(ASSETS).forEach(name => {
      const image = this.canvas.createImage()
      image.onload = finishLoading
      image.onerror = finishLoading
      image.src = ASSETS[name]
      this.images[name] = image
    })
  },

  requestFrame(callback) {
    if (this.canvas && this.canvas.requestAnimationFrame) {
      return { id: this.canvas.requestAnimationFrame(callback), canvasFrame: true }
    }
    return { id: setTimeout(() => callback(Date.now()), 16), canvasFrame: false }
  },

  cancelFrame(frame) {
    if (!frame) {
      return
    }
    if (frame.canvasFrame && this.canvas && this.canvas.cancelAnimationFrame) {
      this.canvas.cancelAnimationFrame(frame.id)
      return
    }
    clearTimeout(frame.id)
  },

  cancelAnimationFrames() {
    this.cancelFrame(this.motionFrame)
    this.cancelFrame(this.idleFrame)
    this.cancelFrame(this.clearFrame)
    this.motionFrame = null
    this.idleFrame = null
    this.clearFrame = null
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  },

  syncVisualState() {
    if (!this.gameState) {
      return
    }
    this.playerVisual = clonePosition(this.gameState.player)
    this.boxVisuals = clonePositions(this.gameState.boxes)
    this.idleOffset = 0
    this.idleFrameIndex = 0
  },

  isBusy() {
    return this.isAnimating || this.isCelebrating
  },

  resetIdle() {
    this.cancelFrame(this.idleFrame)
    this.idleFrame = null
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    this.idleActive = false
    this.idleOffset = 0

    if (!this.pageVisible || this.data.isCleared || this.isBusy()) {
      return
    }
    this.idleTimer = setTimeout(() => this.startIdle(), IDLE_DELAY)
  },

  startIdle() {
    this.idleTimer = null
    if (!this.pageVisible || this.data.isCleared || this.isBusy()) {
      return
    }

    this.idleActive = true
    this.idleStartedAt = Date.now()
    this.runIdleFrame()
  },

  runIdleFrame() {
    if (!this.idleActive || !this.pageVisible || this.isBusy() || this.data.isCleared) {
      return
    }
    const elapsed = Date.now() - this.idleStartedAt
    this.idleFrameIndex = Math.floor(elapsed / (IDLE_DURATION / 2)) % 2
    this.render()
    this.idleFrame = this.requestFrame(() => this.runIdleFrame())
  },

  pauseExperience() {
    this.pageVisible = false
    this.pauseTimer()
    this.cancelFrame(this.idleFrame)
    this.idleFrame = null
    this.idleActive = false
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }

    const pendingClear = this.animationState && this.animationState.willClear
      ? true
      : this.isCelebrating
    this.cancelFrame(this.motionFrame)
    this.cancelFrame(this.clearFrame)
    this.motionFrame = null
    this.clearFrame = null
    this.animationState = null
    this.isAnimating = false
    this.isCelebrating = false
    this.clearFeedback = null
    this.syncVisualState()
    this.deferredClear = pendingClear || this.deferredClear
    this.setData({ isBusy: false })
    this.render()
  },

  resumeExperience() {
    this.pageVisible = true
    this.resumeTimer()
    if (this.deferredClear) {
      this.deferredClear = false
      this.beginClearFeedback(this.lastMovedBoxIndex)
      return
    }
    this.resetIdle()
  },

  handleCanvasTouchStart(event) {
    const touch = event.touches && event.touches[0]
    if (!touch) {
      return
    }
    this.touchStart = { x: touch.clientX, y: touch.clientY }
  },

  handleCanvasTouchEnd(event) {
    const touch = event.changedTouches && event.changedTouches[0]
    if (!touch || !this.touchStart) {
      return
    }

    const dx = touch.clientX - this.touchStart.x
    const dy = touch.clientY - this.touchStart.y
    this.touchStart = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
      return
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      this.move(dx > 0 ? 'right' : 'left')
      return
    }
    if (Math.abs(dy) > Math.abs(dx)) {
      this.move(dy > 0 ? 'down' : 'up')
    }
  },

  move(direction) {
    this.resetIdle()
    if (this.data.isCleared || this.isBusy() || !this.gameState) {
      return
    }

    const result = tryMove(this.gameState, direction)
    if (!result.moved) {
      this.setData({ statusText: 'Blocked.' })
      return
    }

    const playerStart = clonePosition(this.gameState.player)
    const boxesStart = clonePositions(this.gameState.boxes)
    const movedBoxIndex = result.pushed
      ? result.state.boxes.findIndex((box, index) => box.row !== boxesStart[index].row || box.col !== boxesStart[index].col)
      : -1
    this.saveUndoSnapshot()
    this.gameState = result.state
    this.moves += 1
    if (result.pushed) {
      this.pushes += 1
    }
    if (!this.timerHasStarted) {
      this.startTimer()
    }

    this.updateStats({ statusText: result.pushed ? 'Box pushed.' : 'Player moved.' })
    if (result.pushed) {
      getApp().globalData.soundManager.play('push')
    }
    this.startMovementAnimation(playerStart, boxesStart, checkWin(this.gameState.boxes, this.gameState.targets), movedBoxIndex)
  },

  startMovementAnimation(playerStart, boxesStart, willClear, movedBoxIndex) {
    this.isAnimating = true
    this.lastMovedBoxIndex = movedBoxIndex
    this.animationState = {
      startedAt: Date.now(),
      playerStart,
      playerEnd: clonePosition(this.gameState.player),
      boxesStart,
      boxesEnd: clonePositions(this.gameState.boxes),
      willClear,
      movedBoxIndex,
    }
    this.setData({ isBusy: true })
    this.runMovementFrame()
  },

  runMovementFrame() {
    const animation = this.animationState
    if (!animation) {
      return
    }

    const elapsed = Date.now() - animation.startedAt
    const progress = Math.min(1, elapsed / MOVE_DURATION)
    const easedProgress = 1 - Math.pow(1 - progress, 3)
    this.walkFrameIndex = Math.min(2, Math.floor(progress * 3))
    this.playerVisual = interpolatePosition(animation.playerStart, animation.playerEnd, easedProgress)
    this.boxVisuals = animation.boxesStart.map((box, index) => (
      interpolatePosition(box, animation.boxesEnd[index], easedProgress)
    ))
    this.render()

    if (progress < 1) {
      this.motionFrame = this.requestFrame(() => this.runMovementFrame())
      return
    }

    this.motionFrame = null
    this.animationState = null
    this.isAnimating = false
    this.walkFrameIndex = 0
    this.syncVisualState()
    this.setData({ isBusy: false })
    this.render()
    if (animation.willClear) {
      this.beginClearFeedback(animation.movedBoxIndex)
      return
    }
    this.resetIdle()
  },

  beginClearFeedback(movedBoxIndex) {
    if (this.data.isCleared || this.isCelebrating) {
      return
    }

    this.isCelebrating = true
    this.clearFeedback = {
      startedAt: Date.now(),
      boxIndex: movedBoxIndex,
    }
    this.setData({ isBusy: true })
    this.runClearFrame()
  },

  runClearFrame() {
    if (!this.clearFeedback) {
      return
    }
    const elapsed = Date.now() - this.clearFeedback.startedAt
    const progress = Math.min(1, elapsed / CLEAR_PULSE_DURATION)
    this.clearPulseScale = 1 + Math.sin(progress * Math.PI) * 0.1
    this.render()

    if (progress < 1) {
      this.clearFrame = this.requestFrame(() => this.runClearFrame())
      return
    }

    this.clearFrame = null
    this.clearFeedback = null
    this.clearPulseScale = 1
    this.isCelebrating = false
    this.setData({ isBusy: false })
    if (!this.clearSoundPlayed) {
      this.clearSoundPlayed = true
      getApp().globalData.soundManager.play('clear')
    }
    this.completeLevel()
  },

  saveUndoSnapshot() {
    this.undoStack.push({
      player: clonePosition(this.gameState.player),
      boxes: this.gameState.boxes.map(clonePosition),
      moves: this.moves,
      pushes: this.pushes,
      elapsed: this.getElapsed(),
      timerRunning: this.timerRunning === true,
      timerHasStarted: this.timerHasStarted === true,
    })
    if (this.undoStack.length > MAX_UNDO_HISTORY) {
      this.undoStack.shift()
    }
  },

  undoMove() {
    this.resetIdle()
    if (this.data.isCleared || this.isBusy() || !this.undoStack.length) {
      return
    }

    const snapshot = this.undoStack.pop()
    this.stopTimer()
    this.gameState.player = clonePosition(snapshot.player)
    this.gameState.boxes = snapshot.boxes.map(clonePosition)
    this.moves = snapshot.moves
    this.pushes = snapshot.pushes
    this.elapsed = snapshot.elapsed
    this.timerHasStarted = snapshot.timerHasStarted
    this.timerStartedAt = null
    if (this.timerHasStarted) {
      this.resumeTimer()
    }

    this.updateStats({ statusText: 'Move undone.' })
    this.syncVisualState()
    this.render()
  },

  getElapsed() {
    if (!this.timerRunning || !this.timerStartedAt) {
      return this.elapsed || 0
    }
    return this.elapsed + Math.max(0, Date.now() - this.timerStartedAt)
  },

  startTimer() {
    this.timerHasStarted = true
    this.timerRunning = true
    this.timerStartedAt = Date.now()
    this.startTimerTicker()
  },

  stopTimer() {
    if (this.timerRunning) {
      this.elapsed = this.getElapsed()
    }
    this.timerRunning = false
    this.timerStartedAt = null
    this.stopTimerTicker()
    return this.elapsed || 0
  },

  pauseTimer() {
    if (!this.timerRunning) {
      return
    }
    this.stopTimer()
    this.updateStats()
  },

  resumeTimer() {
    if (!this.timerHasStarted || this.timerRunning || this.data.isCleared) {
      return
    }
    this.timerRunning = true
    this.timerStartedAt = Date.now()
    this.startTimerTicker()
    this.updateStats()
  },

  startTimerTicker() {
    this.stopTimerTicker()
    this.timerInterval = setInterval(() => {
      if (this.timerRunning) {
        this.setData({ timeText: formatTime(this.getElapsed()) })
      }
    }, 250)
  },

  stopTimerTicker() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  },

  updateStats(extraData) {
    this.setData({
      moves: this.moves,
      pushes: this.pushes,
      timeText: formatTime(this.getElapsed()),
      hasUndo: !this.data.isCleared && this.undoStack.length > 0,
      ...extraData,
    })
  },

  completeLevel() {
    this.stopTimer()
    const app = getApp()
    const progress = app.globalData.progress
    const levelId = this.currentLevel.id
    const clearedLevels = progress.clearedLevels.includes(levelId)
      ? progress.clearedLevels.slice()
      : [...progress.clearedLevels, levelId]
    const previousRecord = progress.levelProgress[levelId] || {}
    const currentTime = this.elapsed
    const record = {
      cleared: true,
      bestMoves: previousRecord.bestMoves === undefined
        ? this.moves : Math.min(previousRecord.bestMoves, this.moves),
      bestPushes: previousRecord.bestPushes === undefined
        ? this.pushes : Math.min(previousRecord.bestPushes, this.pushes),
      bestTime: previousRecord.bestTime === undefined
        ? currentTime : Math.min(previousRecord.bestTime, currentTime),
    }

    app.saveProgress({
      ...progress,
      unlockedLevel: levelId < levels.length
        ? Math.max(progress.unlockedLevel, levelId + 1) : progress.unlockedLevel,
      clearedLevels,
      lastLevel: levelId,
      levelProgress: { ...progress.levelProgress, [levelId]: record },
    })
    this.setData({
      isCleared: true,
      isFinalLevel: levelId === levels.length,
      hasUndo: false,
      timeText: formatTime(currentTime),
      statusText: levelId === levels.length ? 'All levels cleared.' : 'Level cleared.',
    })
  },

  resetGame() {
    if (this.isBusy()) {
      return
    }
    this.resetIdle()
    this.stopTimer()
    this.gameState = resetLevel(this.initialState)
    this.moves = 0
    this.pushes = 0
    this.elapsed = 0
    this.timerRunning = false
    this.timerStartedAt = null
    this.timerHasStarted = false
    this.undoStack = []
    this.clearSoundPlayed = false
    this.syncVisualState()
    this.setData({
      isCleared: false,
      isFinalLevel: false,
      moves: 0,
      pushes: 0,
      timeText: '00:00',
      hasUndo: false,
      statusText: `LEVEL ${this.currentLevel.id} reset.`,
    })
    this.render()
    this.resetIdle()
  },

  nextLevel() {
    if (!this.isBusy() && this.currentLevel.id < levels.length) {
      this.loadLevel(this.currentLevel.id + 1)
    }
  },

  openLevelSelect() {
    if (this.isBusy()) {
      return
    }
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

  render() {
    if (!this.ctx || !this.gameState || !this.assetsReady) {
      return
    }

    const { staticMap, targets } = this.gameState
    const boxes = this.boxVisuals || this.gameState.boxes
    const player = this.playerVisual || this.gameState.player
    const rows = staticMap.length
    const cols = staticMap[0].length
    const boardPadding = 16
    const tileSize = Math.floor(Math.min(
      (this.canvasWidth - boardPadding * 2) / cols,
      (this.canvasHeight - boardPadding * 2) / rows
    ))
    const boardWidth = cols * tileSize
    const boardHeight = rows * tileSize
    const offsetX = (this.canvasWidth - boardWidth) / 2
    const offsetY = (this.canvasHeight - boardHeight) / 2
    const ctx = this.ctx
    const images = this.images

    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    ctx.fillStyle = '#f5ead5'
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = offsetX + col * tileSize
        const y = offsetY + row * tileSize
        ctx.drawImage(images.floor, x, y, tileSize, tileSize)
      }
    }

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (!isWall(staticMap, row, col)) {
          continue
        }
        const x = offsetX + col * tileSize
        const y = offsetY + row * tileSize
        ctx.drawImage(images.wall, x, y, tileSize, tileSize)
      }
    }

    targets.forEach(target => {
      const inset = tileSize * 0.06
      const x = offsetX + target.col * tileSize + inset
      const y = offsetY + target.row * tileSize + inset
      ctx.drawImage(images.targetFish, x, y, tileSize - inset * 2, tileSize - inset * 2)
    })

    boxes.forEach((box, index) => {
      const x = offsetX + box.col * tileSize
      const y = offsetY + box.row * tileSize
      const inset = tileSize * 0.04
      const bowlImage = isTarget(targets, box.row, box.col) ? images.bowlFull : images.bowlEmpty
      const pulseScale = this.clearFeedback && this.clearFeedback.boxIndex === index
        ? this.clearPulseScale || 1
        : 1
      const size = (tileSize - inset * 2) * pulseScale
      const pulseInset = (tileSize - size) / 2
      ctx.drawImage(bowlImage, x + pulseInset, y + pulseInset, size, size)
    })

    const playerInset = tileSize * 0.04
    const playerX = offsetX + player.col * tileSize + playerInset
    const playerY = offsetY + player.row * tileSize + playerInset + (this.idleOffset || 0)
    const playerImage = this.isAnimating
      ? images[`catWalk${(this.walkFrameIndex || 0) + 1}`]
      : this.idleActive
        ? images[`catIdle${(this.idleFrameIndex || 0) + 1}`]
        : images.catDefault
    ctx.drawImage(playerImage, playerX, playerY, tileSize - playerInset * 2, tileSize - playerInset * 2)
  },
})
