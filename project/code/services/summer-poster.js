const POSTER_WIDTH = 1080
const POSTER_HEIGHT = 1920

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

function drawYourCutPhoto(ctx, image, slot, index, themeColor) {
  const [x, y, width, height, degrees] = slot
  const inset = 12

  ctx.save()
  ctx.translate(x + width / 2, y + height / 2)
  ctx.rotate(degrees * Math.PI / 180)
  ctx.fillStyle = '#242522'
  ctx.fillRect(-width / 2, -height / 2, width, height)
  drawPhoto(ctx, image, -width / 2 + inset, -height / 2 + inset, width - inset * 2, height - inset * 2, index, themeColor)
  ctx.fillStyle = '#A8D900'
  ctx.fillRect(-width / 2 + inset, -height / 2 + inset, 58, 42)
  ctx.fillStyle = '#242522'
  ctx.font = '900 22px sans-serif'
  ctx.fillText(`0${index + 1}`, -width / 2 + inset + 9, -height / 2 + inset + 29)
  ctx.restore()
}

function drawYourCutPoster(canvas, model, images) {
  const ctx = canvas.getContext('2d')
  const width = POSTER_WIDTH
  const height = POSTER_HEIGHT
  const themeColor = model.themeColor || '#E9C52C'
  canvas.width = width
  canvas.height = height

  ctx.fillStyle = themeColor
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#242522'
  ctx.font = '900 128px sans-serif'
  ctx.fillText('YOUR CUT.', 60, 156)
  ctx.font = '900 44px sans-serif'
  drawWrappedText(ctx, `${model.placeLabel} × ${model.vibeLabel}`, 64, 226, 952, 52)

  const mosaicX = 60
  const mosaicY = 330
  ctx.fillStyle = '#3C473D'
  ctx.fillRect(mosaicX, mosaicY, 960, 1116)

  const scale = 960 / 670
  const slots = [
    [mosaicX, mosaicY, 390 * scale, 370 * scale, 0],
    [mosaicX + 398 * scale, mosaicY + 42 * scale, 272 * scale, 286 * scale, 4],
    [mosaicX + 268 * scale, mosaicY + 396 * scale, 366 * scale, 384 * scale, 0],
    [mosaicX, mosaicY + 474 * scale, 226 * scale, 260 * scale, -6],
    [mosaicX + 244 * scale, mosaicY + 302 * scale, 184 * scale, 172 * scale, -3]
  ]
  slots.forEach((slot, index) => drawYourCutPhoto(ctx, images[index], slot, index, themeColor))

  ctx.fillStyle = '#242522'
  ctx.font = '900 102px sans-serif'
  ctx.fillText('THIS IS', 60, 1596)
  ctx.fillText('HOW YOU SAW', 60, 1686)
  const finalLine = 'MY SUMMER.'
  const finalLineWidth = ctx.measureText(finalLine).width
  ctx.fillStyle = '#242522'
  ctx.fillRect(48, 1722, finalLineWidth + 36, 116)
  ctx.fillStyle = '#ECEDE7'
  ctx.fillText(finalLine, 60, 1812)
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
  if (!model || !Array.isArray(model.photos) || model.photos.length !== 5) {
    throw new Error('Your Cut poster requires exactly five selected photos')
  }

  const images = await Promise.all(model.photos.map((photo) => loadCanvasImage(canvas, photo.src)))
  drawYourCutPoster(canvas, model, images)
  return exportCanvas(canvas)
}

module.exports = { POSTER_WIDTH, POSTER_HEIGHT, getAspectFillCrop, generateSummerPoster, generateYourCutPoster }
