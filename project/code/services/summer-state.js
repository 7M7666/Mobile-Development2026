const STORAGE_KEY = 'summer2026_state_v1'
const VERSION = 1

function getDefaultState() {
  return {
    version: VERSION,
    story: { currentSlide: 0 },
    yourCut: { selectedPlace: null, selectedVibe: 'random', resultPhotoIds: [] },
    sound: { enabled: true },
    updatedAt: 0
  }
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function loadState(options = {}) {
  const fallback = getDefaultState()
  let stored

  try {
    stored = wx.getStorageSync(STORAGE_KEY)
  } catch (error) {
    return fallback
  }

  if (!isPlainObject(stored) || stored.version !== VERSION) return fallback

  const maxSlide = Number.isInteger(options.maxSlide) ? options.maxSlide : 13
  const placeIds = new Set(options.placeIds || [])
  const vibeIds = new Set(options.vibeIds || [])
  const photoIds = new Set(options.photoIds || [])
  const story = isPlainObject(stored.story) ? stored.story : {}
  const yourCut = isPlainObject(stored.yourCut) ? stored.yourCut : {}
  const sound = isPlainObject(stored.sound) ? stored.sound : {}
  const currentSlide = Number.isInteger(story.currentSlide) && story.currentSlide >= 0 && story.currentSlide <= maxSlide
    ? story.currentSlide
    : 0
  const selectedPlace = typeof yourCut.selectedPlace === 'string' && placeIds.has(yourCut.selectedPlace)
    ? yourCut.selectedPlace
    : null
  const selectedVibe = typeof yourCut.selectedVibe === 'string' && vibeIds.has(yourCut.selectedVibe)
    ? yourCut.selectedVibe
    : fallback.yourCut.selectedVibe
  const resultPhotoIds = Array.isArray(yourCut.resultPhotoIds)
    ? yourCut.resultPhotoIds.filter((id) => typeof id === 'string' && photoIds.has(id))
    : []

  return {
    version: VERSION,
    story: { currentSlide },
    yourCut: { selectedPlace, selectedVibe, resultPhotoIds },
    sound: { enabled: typeof sound.enabled === 'boolean' ? sound.enabled : true },
    updatedAt: Number.isFinite(stored.updatedAt) ? stored.updatedAt : 0
  }
}

function saveState(state) {
  let current = {}

  try {
    const stored = wx.getStorageSync(STORAGE_KEY)
    current = isPlainObject(stored) && stored.version === VERSION ? stored : {}
  } catch (error) {
    current = {}
  }

  const next = {
    ...getDefaultState(),
    ...current,
    ...state,
    story: { ...getDefaultState().story, ...current.story, ...state.story },
    yourCut: { ...getDefaultState().yourCut, ...current.yourCut, ...state.yourCut },
    sound: { ...getDefaultState().sound, ...current.sound, ...state.sound },
    version: VERSION,
    updatedAt: Date.now()
  }

  try {
    wx.setStorageSync(STORAGE_KEY, next)
  } catch (error) {
    return false
  }

  return true
}

module.exports = { STORAGE_KEY, VERSION, getDefaultState, loadState, saveState }
