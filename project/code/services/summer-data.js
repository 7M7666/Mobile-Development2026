const summer = require('../data/summer2026')

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

function getMeta() {
  return copy(summer.meta)
}

function getPlaces() {
  return summer.places.map((place) => ({ ...place }))
}

function getPhotos() {
  return summer.photos.map((photo) => ({
    ...photo,
    tags: [...photo.tags],
    vibes: [...photo.vibes]
  }))
}

function getJourneys() {
  const placeById = getPlaces().reduce((result, place) => {
    result[place.id] = place
    return result
  }, {})
  const photoById = getPhotos().reduce((result, photo) => {
    result[photo.id] = photo
    return result
  }, {})

  return summer.journeys.map((journey) => {
    const place = placeById[journey.placeId] || null
    const photos = journey.photoIds
      .map((photoId) => photoById[photoId])
      .filter(Boolean)

    return {
      ...journey,
      tags: [...journey.tags],
      photoIds: [...journey.photoIds],
      place,
      photos,
      coverPhoto: journey.coverPhotoId
        ? photoById[journey.coverPhotoId] || null
        : null
    }
  })
}

function getTotals() {
  return {
    capturedPhotoCount: summer.totals.capturedPhotoCount,
    curatedPhotoCount: summer.totals.curatedPhotoCount
  }
}

function getAlbumPhotos() {
  const journeyByPlaceId = getJourneys().reduce((result, journey) => {
    result[journey.placeId] = journey
    return result
  }, {})
  const photos = getPhotos().map((photo) => {
    const journey = journeyByPlaceId[photo.placeId] || null

    return {
      ...photo,
      journeyId: journey ? journey.id : null,
      journeyOrder: journey ? journey.order : null
    }
  })

  return {
    photos,
    ...getTotals()
  }
}

function validCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

function getMapModel() {
  const journeys = getJourneys()
  const markers = []
  const missingCoordinates = []

  journeys.forEach((journey) => {
    const place = journey.place

    if (!place || !validCoordinate(place.latitude, place.longitude)) {
      missingCoordinates.push({
        journeyId: journey.id,
        placeId: journey.placeId,
        name: place ? place.name : null,
        city: place ? place.city : null,
        province: place ? place.province : null
      })
      return
    }

    markers.push({
      id: journey.id,
      journeyId: journey.id,
      placeId: place.id,
      name: place.name,
      city: place.city,
      province: place.province,
      latitude: place.latitude,
      longitude: place.longitude,
      order: journey.order
    })
  })

  const routePoints = markers.map((marker) => ({
    latitude: marker.latitude,
    longitude: marker.longitude
  }))

  return {
    places: getPlaces(),
    journeys,
    markers,
    polyline: routePoints.length > 1 ? routePoints : [],
    missingCoordinates
  }
}

function getStats() {
  const meta = getMeta()
  const totals = getTotals()

  return {
    days: meta.inclusiveDays,
    placeCount: getPlaces().length,
    journeyCount: getJourneys().length,
    capturedPhotoCount: totals.capturedPhotoCount,
    curatedPhotoCount: totals.curatedPhotoCount
  }
}

function getRecap() {
  const album = getAlbumPhotos()

  return {
    meta: getMeta(),
    stats: getStats(),
    places: getPlaces(),
    journeys: getJourneys(),
    photos: album.photos,
    capturedPhotoCount: album.capturedPhotoCount,
    curatedPhotoCount: album.curatedPhotoCount,
    curation: copy(summer.curation)
  }
}

function getWrapped() {
  return {
    meta: getMeta(),
    summary: copy(summer.summary),
    totals: getTotals(),
    places: getPlaces(),
    timeline: copy(summer.timeline),
    journeys: getJourneys(),
    photos: getPhotos(),
    curation: copy(summer.curation)
  }
}

function getSummer() {
  return {
    ...getWrapped(),
    album: getAlbumPhotos(),
    stats: getStats()
  }
}

module.exports = {
  getSummer,
  getMeta,
  getPlaces,
  getJourneys,
  getPhotos,
  getAlbumPhotos,
  getMapModel,
  getStats,
  getRecap,
  getWrapped
}
