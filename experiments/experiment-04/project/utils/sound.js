const AUDIO_SOURCES = {
  push: '/assets/audio/push.wav',
  clear: '/assets/audio/clear.wav',
}

function createSoundManager() {
  const contexts = {}
  let enabled = true

  function getContext(name) {
    if (contexts[name]) {
      return contexts[name]
    }

    const context = wx.createInnerAudioContext()
    context.src = AUDIO_SOURCES[name]
    contexts[name] = context
    return context
  }

  return {
    setEnabled(value) {
      enabled = value !== false
    },

    isEnabled() {
      return enabled
    },

    play(name) {
      if (!enabled || !AUDIO_SOURCES[name]) {
        return
      }

      const context = getContext(name)
      context.stop()
      context.seek(0)
      context.play()
    },

    destroy() {
      Object.keys(contexts).forEach(name => contexts[name].destroy())
    },
  }
}

module.exports = {
  createSoundManager,
}
