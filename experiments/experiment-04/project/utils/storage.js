const STORAGE_KEY = 'meowPushProgressV1'
const STORAGE_VERSION = 1

function getDefaultProgress() {
  return {
    version: STORAGE_VERSION,
    unlockedLevel: 1,
    clearedLevels: [],
    lastLevel: 1,
    levelProgress: {},
    soundOn: true,
  }
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

function normalizeRecord(record) {
  if (!record || typeof record !== 'object') {
    return null
  }

  const normalized = {
    cleared: record.cleared === true,
  }

  if (isNonNegativeInteger(record.bestMoves)) {
    normalized.bestMoves = record.bestMoves
  }
  if (isNonNegativeInteger(record.bestPushes)) {
    normalized.bestPushes = record.bestPushes
  }
  if (isNonNegativeInteger(record.bestTime)) {
    normalized.bestTime = record.bestTime
  }

  return normalized
}

function normalizeProgress(raw) {
  const defaults = getDefaultProgress()

  if (!raw || typeof raw !== 'object' || raw.version !== STORAGE_VERSION) {
    return defaults
  }

  const clearedLevels = Array.isArray(raw.clearedLevels)
    ? [...new Set(raw.clearedLevels.filter(levelId => Number.isInteger(levelId) && levelId > 0))]
      .sort((first, second) => first - second)
    : []
  const levelProgress = {}

  if (raw.levelProgress && typeof raw.levelProgress === 'object' && !Array.isArray(raw.levelProgress)) {
    Object.keys(raw.levelProgress).forEach(levelId => {
      if (!/^\d+$/.test(levelId) || Number(levelId) < 1) {
        return
      }

      const record = normalizeRecord(raw.levelProgress[levelId])
      if (record) {
        levelProgress[levelId] = record
      }
    })
  }

  Object.keys(levelProgress).forEach(levelId => {
    if (levelProgress[levelId].cleared && !clearedLevels.includes(Number(levelId))) {
      clearedLevels.push(Number(levelId))
    }
  })
  clearedLevels.sort((first, second) => first - second)

  const highestCleared = clearedLevels.length ? clearedLevels[clearedLevels.length - 1] : 0
  const unlockedLevel = Number.isInteger(raw.unlockedLevel) && raw.unlockedLevel >= 1
    ? Math.max(raw.unlockedLevel, highestCleared)
    : Math.max(defaults.unlockedLevel, highestCleared)
  const lastLevel = Number.isInteger(raw.lastLevel) && raw.lastLevel >= 1
    ? Math.min(raw.lastLevel, unlockedLevel)
    : defaults.lastLevel

  return {
    version: STORAGE_VERSION,
    unlockedLevel,
    clearedLevels,
    lastLevel,
    levelProgress,
    soundOn: raw.soundOn !== false,
  }
}

function loadProgress() {
  try {
    return normalizeProgress(wx.getStorageSync(STORAGE_KEY))
  } catch (error) {
    return getDefaultProgress()
  }
}

function saveProgress(progress) {
  const normalized = normalizeProgress(progress)

  try {
    wx.setStorageSync(STORAGE_KEY, normalized)
  } catch (error) {
    return normalized
  }

  return normalized
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

module.exports = {
  STORAGE_KEY,
  getDefaultProgress,
  normalizeProgress,
  loadProgress,
  saveProgress,
  formatTime,
}
