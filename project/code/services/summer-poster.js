const POSTER_WIDTH = 1080
const POSTER_HEIGHT = 1920
const cutExports = new WeakMap()

function getAspectFillCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceAspect = sourceWidth / sourceHeight
  const targetAspect = targetWidth / targetHeight

  if (sourceAspect > targetAspect) {
    const width = sourceHeight * targetAspect
    return { sx: (sourceWidth - width) / 2, sy: 0, sWidth: width, sHeight: sourceHeight }
  }

  const height = sourceWidth / targetAspect
  return { sx: 0, sy: (sourceHeight - height) / 2, sWidth: sourceWidth, sHeight: height }
}

function loadCanvasImage(canvas, src, allowFallback = false) {
  return new Promise((resolve, reject) => {
    if (!src) {
      const error = new Error('Photo source unavailable')
      if (allowFallback) resolve(null)
      else reject(error)
      return
    }

    const image = canvas.createImage()
    image.onload = () => resolve(image)
    image.onerror = (error) => {
      if (allowFallback) resolve(null)
      else reject(error || new Error(`Could not load poster photo: ${src}`))
    }
    image.src = src
  })
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/)
  let line = ''
  let cursorY = y

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      ctx.fillText(line, x, cursorY)
      cursorY += lineHeight
      line = word
    } else {
      line = next
    }
  })

  if (line) ctx.fillText(line, x, cursorY)
  return cursorY
}

function drawPhoto(ctx, image, x, y, width, height, index) {
  ctx.fillStyle = index % 2 ? '#9891F5' : '#FF5944'
  ctx.fillRect(x, y, width, height)

  if (!image) {
    ctx.fillStyle = '#242522'
    ctx.font = '900 24px sans-serif'
    ctx.fillText('PHOTO', x + 18, y + 38)
    ctx.fillText('UNAVAILABLE', x + 18, y + 68)
    return
  }

  const crop = getAspectFillCrop(image.width, image.height, width, height)
  ctx.drawImage(image, crop.sx, crop.sy, crop.sWidth, crop.sHeight, x, y, width, height)
}

function drawPoster(canvas, model, images) {
  const ctx = canvas.getContext('2d')
  const width = POSTER_WIDTH
  const height = POSTER_HEIGHT
  canvas.width = width
  canvas.height = height

  ctx.fillStyle = '#A8D900'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#242522'
  ctx.fillRect(0, 0, width, 228)
  ctx.fillStyle = '#ECEDE7'
  ctx.font = '900 42px sans-serif'
  ctx.fillText('SUMMER 2026', 66, 82)
  ctx.font = '900 24px sans-serif'
  ctx.fillText('THIS WAS MY SUMMER.', 66, 130)

  ctx.fillStyle = '#242522'
  ctx.font = '900 118px sans-serif'
  ctx.fillText('MY', 60, 372)
  ctx.fillText('SUMMER.', 60, 470)
  ctx.fillStyle = '#ECEDE7'
  ctx.fillRect(475, 390, 500, 104)
  ctx.fillStyle = '#242522'
  ctx.font = '900 70px sans-serif'
  ctx.fillText('2026', 500, 468)

  const stats = [`${model.days} DAYS`, `${model.placeCount} PLACES`, `${model.photoCount} PHOTOS`]
  ctx.font = '900 28px sans-serif'
  stats.forEach((stat, index) => {
    const x = 60 + index * 330
    ctx.fillStyle = '#242522'
    ctx.fillRect(x, 544, 300, 64)
    ctx.fillStyle = '#ECEDE7'
    ctx.fillText(stat, x + 18, 586)
  })

  const frames = [
    [60, 664, 456, 386], [564, 664, 456, 386],
    [60, 1098, 456, 386], [564, 1098, 456, 386]
  ]
  frames.forEach((frame, index) => drawPhoto(ctx, images[index], ...frame, index))

  ctx.fillStyle = '#242522'
  ctx.font = '900 24px sans-serif'
  ctx.fillText('TOP PLACE', 60, 1580)
  ctx.font = '900 56px sans-serif'
  drawWrappedText(ctx, model.topPlace, 60, 1640, 610, 60)
  ctx.fillStyle = '#FF5944'
  ctx.fillRect(700, 1534, 320, 144)
  ctx.fillStyle = '#242522'
  ctx.font = '900 23px sans-serif'
  ctx.fillText('SUMMER TYPE', 728, 1580)
  ctx.font = '900 34px sans-serif'
  drawWrappedText(ctx, model.summerType, 728, 1630, 264, 38)

  ctx.fillStyle = '#242522'
  ctx.fillRect(0, 1764, width, 156)
  ctx.fillStyle = '#A8D900'
  ctx.font = '900 46px sans-serif'
  ctx.fillText('MY CUT', 60, 1840)
  ctx.font = '900 25px sans-serif'
  ctx.fillText(model.usingYourCut ? 'MADE FROM YOUR SELECTION' : 'MADE FROM SUMMER 2026', 60, 1886)
}

function drawYourCutPhoto(ctx, image, slot, index, user = false) {
  const [x, y, width, height, degrees] = slot
  const inset = 12

  ctx.save()
  ctx.translate(x + width / 2, y + height / 2)
  ctx.rotate(degrees * Math.PI / 180)
  ctx.fillStyle = '#242522'
  ctx.fillRect(-width / 2, -height / 2, width, height)
  drawPhoto(ctx, image, -width / 2 + inset, -height / 2 + inset, width - inset * 2, height - inset * 2, index)
  ctx.fillStyle = '#A8D900'
  ctx.fillRect(-width / 2 + inset, -height / 2 + inset, user ? 190 : 58, 42)
  ctx.fillStyle = '#242522'
  ctx.font = '900 22px sans-serif'
  ctx.fillText(user ? 'YOUR PIECE' : `0${index + 1}`, -width / 2 + inset + 9, -height / 2 + inset + 29)
  ctx.restore()
}

function drawFittedText(ctx, value, x, y, width, height, size = 34) {
  const chars = Array.from(String(value))
  let lines, fontSize = size
  do {
    ctx.font = '700 ' + fontSize + 'px sans-serif'
    lines = []; let line = ''
    chars.forEach((char) => {
      if (char === '\n' || (line && ctx.measureText(line + char).width > width)) { lines.push(line); line = char === '\n' ? '' : char }
      else line += char
    })
    if (line) lines.push(line)
    if (lines.length * fontSize * 1.35 <= height || fontSize <= 14) break
    fontSize -= 2
  } while (true)
  const maxLines = Math.max(0, Math.floor((height - fontSize) / (fontSize * 1.35)) + 1)
  if (lines.length > maxLines && maxLines) {
    lines = lines.slice(0, maxLines)
    let last = lines[maxLines - 1]
    while (last && ctx.measureText(last + '…').width > width) last = Array.from(last).slice(0, -1).join('')
    lines[maxLines - 1] = last + '…'
  }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip()
  lines.slice(0, maxLines).forEach((line, index) => ctx.fillText(line, x, y + fontSize + index * fontSize * 1.35))
  ctx.restore()
}

function drawYourCutPoster(canvas, model, images) {
  const ctx = canvas.getContext('2d')
  canvas.width = POSTER_WIDTH; canvas.height = POSTER_HEIGHT
  ctx.fillStyle = '#ECEDE7'; ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)
  ctx.fillStyle = '#242522'; ctx.font = '900 44px sans-serif'; ctx.fillText('SUMMER 2026', 60, 84)
  ctx.font = '900 92px sans-serif'; ctx.fillText('RE-CUT BY YOU', 54, 184)
  ctx.font = '700 28px sans-serif'; ctx.fillText('这是我的暑假。这是你重新看见它的方式。', 60, 242)
  const originX = 60, originY = 300, width = 960, height = 963
  ctx.fillStyle = '#3C473D'; ctx.fillRect(originX, originY, width, height)
  model.elements.forEach((element, index) => {
    const slot = element.slot
    const x = originX + width * slot.x / 100, y = originY + height * slot.y / 100
    const w = width * slot.w / 100, h = height * slot.h / 100
    if (element.type === 'photo') drawYourCutPhoto(ctx, images[index], [x, y, w, h, slot.rotation], index, element.user)
    else {
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(slot.rotation * Math.PI / 180)
      ctx.fillStyle = '#242522'; ctx.fillRect(-w / 2, -h / 2, w, h)
      ctx.fillStyle = '#E9C52C'; ctx.fillRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24)
      ctx.fillStyle = '#242522'; ctx.font = '900 19px sans-serif'
      ctx.fillText(element.type === 'place' ? 'YOUR PLACE' : 'YOUR LINE', -w / 2 + 24, -h / 2 + 44)
      drawFittedText(ctx, element.type === 'text' ? '“' + element.title + '”' : element.title, -w / 2 + 24, -h / 2 + 58, w - 48, h - 82, element.type === 'place' ? 60 : 40)
      ctx.restore()
    }
  })
  model.trace.forEach((item, index) => {
    const y = 1310 + index * 94
    ctx.fillStyle = '#465047'; ctx.font = '700 23px sans-serif'; ctx.fillText(item.label, 60, y)
    ctx.fillStyle = '#242522'; drawFittedText(ctx, item.value, 250, y - 30, 760, 76, 34)
  })
  if (model.footnote) { ctx.fillStyle = '#465047'; drawFittedText(ctx, model.footnote, 60, 1700, 960, 66, 24) }
  ctx.fillStyle = '#242522'; ctx.fillRect(0, 1790, POSTER_WIDTH, 130)
  ctx.fillStyle = '#ECEDE7'; ctx.font = '700 28px sans-serif'; ctx.fillText('你用不同的方式，看完了我的暑假。', 60, 1840)
  ctx.fillStyle = '#A8D900'; ctx.font = '900 28px sans-serif'; ctx.fillText('YOU SAW MY SUMMER DIFFERENTLY.', 60, 1890)
}

function exportCanvas(canvas) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      x: 0,
      y: 0,
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      destWidth: POSTER_WIDTH,
      destHeight: POSTER_HEIGHT,
      fileType: 'png',
      success: (result) => resolve(result.tempFilePath),
      fail: reject
    })
  })
}

async function generateSummerPoster(canvas, model) {
  const images = await Promise.all(model.photos.slice(0, 4).map((photo) => loadCanvasImage(canvas, photo.src, true)))
  drawPoster(canvas, model, images)
  return exportCanvas(canvas)
}

async function generateYourCutPoster(canvas, model) {
  if (!model || model.photoIds.length !== 4 || new Set(model.photoIds).size !== 4 || model.elements.length !== (model.piece.type ? 5 : 4)) {
    throw new Error('Your Cut requires four Summer photos and one user piece')
  }
  const images = await Promise.all(model.elements.map(async (element) => {
    if (element.type !== 'photo') return null
    try { return await loadCanvasImage(canvas, element.src) }
    catch (error) { if (element.user) throw new Error('这张照片暂时无法使用，请重新选择。'); throw error }
  }))
  // A previous asynchronous export must finish before this canvas is redrawn.
  const previous = cutExports.get(canvas) || Promise.resolve()
  const pending = previous.catch(() => {}).then(() => {
    drawYourCutPoster(canvas, model, images)
    return exportCanvas(canvas)
  })
  cutExports.set(canvas, pending)
  try { return await pending }
  finally { if (cutExports.get(canvas) === pending) cutExports.delete(canvas) }
}

module.exports = { POSTER_WIDTH, POSTER_HEIGHT, getAspectFillCrop, generateSummerPoster, generateYourCutPoster }
