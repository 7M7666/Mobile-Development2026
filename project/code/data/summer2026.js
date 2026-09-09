const photos = [
  {
    id: 'guiping-jiulong',
    src: '/assets/photos/guiping-jiulong.jpg',
    title: '桂平西山九龙亭子',
    placeId: 'guiping',
    tags: ['广西', '桂平', '旅行', '风景'],
    vibes: ['quiet'],
    priority: 7
  },
  {
    id: 'guiping-longchi',
    src: '/assets/photos/guiping-longchi.jpg',
    title: '桂平西山龙池',
    placeId: 'guiping',
    tags: ['广西', '桂平', '旅行', '风景', '湖泊', '人物'],
    vibes: ['quiet', 'wild'],
    priority: 8
  },
  {
    id: 'guiping-ruquan',
    src: '/assets/photos/guiping-ruquan.jpg',
    title: '桂平西山乳泉',
    placeId: 'guiping',
    tags: ['广西', '桂平', '旅行', '风景', '人物'],
    vibes: ['quiet'],
    priority: 7
  },
  {
    id: 'guiping-grandma',
    src: '/assets/photos/guiping-grandma.jpg',
    title: '和外婆去桂平西山',
    placeId: 'guiping',
    tags: ['广西', '桂平', '家人', '人物', '旅行'],
    vibes: ['warm'],
    priority: 10
  },
  {
    id: 'guangxi-friends-cards',
    src: '/assets/photos/guangxi-friends-cards.jpg',
    title: '和朋友打牌',
    placeId: 'guangxi',
    tags: ['广西', '朋友', '人物', '日常', '游戏'],
    vibes: ['warm', 'random'],
    priority: 7
  },
  {
    id: 'golden-puppy',
    src: '/assets/photos/golden-puppy.jpg',
    title: '小金毛',
    placeId: null,
    tags: ['宠物', '日常'],
    vibes: ['warm', 'random'],
    priority: 7
  },
  {
    id: 'playing-games',
    src: '/assets/photos/playing-games.jpg',
    title: '一起玩游戏',
    placeId: null,
    tags: ['朋友', '人物', '游戏', '日常'],
    vibes: ['warm', 'random'],
    priority: 8
  },
  {
    id: 'xinjiang-bayinbuluke',
    src: '/assets/photos/xinjiang-bayinbuluke.jpg',
    title: '巴音布鲁克',
    placeId: 'bayinbuluke',
    tags: ['新疆', '旅行', '风景', '草原', '湖泊'],
    vibes: ['wild', 'quiet'],
    priority: 10
  },
  {
    id: 'xinjiang-grassland',
    src: '/assets/photos/xinjiang-grassland.jpg',
    title: '新疆草原',
    placeId: 'bayinbuluke',
    tags: ['新疆', '旅行', '风景', '草原', '公路'],
    vibes: ['wild', 'quiet'],
    priority: 9
  },
  {
    id: 'xinjiang-bbq',
    src: '/assets/photos/xinjiang-bbq.jpg',
    title: '新疆大烤串',
    placeId: 'urumqi',
    tags: ['新疆', '美食'],
    vibes: ['warm'],
    priority: 9
  },
  {
    id: 'xinjiang-gongnaizi',
    src: '/assets/photos/xinjiang-gongnaizi.jpg',
    title: '新疆巩乃子',
    placeId: 'bayinbuluke',
    tags: ['新疆', '公路', '森林', '旅行', '风景'],
    vibes: ['wild', 'quiet'],
    priority: 9
  },
  {
    id: 'xinjiang-noodles',
    src: '/assets/photos/xinjiang-noodles.jpg',
    title: '新疆过油肉拌面',
    placeId: 'urumqi',
    tags: ['新疆', '美食'],
    vibes: ['warm'],
    priority: 8
  },
  {
    id: 'xinjiang-burger',
    src: '/assets/photos/xinjiang-burger.jpg',
    title: '新疆辣皮子汉堡',
    placeId: 'urumqi',
    tags: ['新疆', '美食'],
    vibes: ['warm'],
    priority: 7
  },
  {
    id: 'xinjiang-cloud',
    src: '/assets/photos/xinjiang-cloud.jpg',
    title: '新疆路上的七彩祥云',
    placeId: 'bayinbuluke',
    tags: ['新疆', '旅行', '风景', '公路'],
    vibes: ['wild', 'quiet'],
    priority: 8
  },
  {
    id: 'xinjiang-shenchi',
    src: '/assets/photos/xinjiang-shenchi.jpg',
    title: '新疆神池',
    placeId: 'bayinbuluke',
    tags: ['新疆', '旅行', '风景', '湖泊', '草原'],
    vibes: ['quiet', 'wild'],
    priority: 9
  },
  {
    id: 'xinjiang-mutton',
    src: '/assets/photos/xinjiang-mutton.jpg',
    title: '新疆水煮羊肉',
    placeId: 'urumqi',
    tags: ['新疆', '美食'],
    vibes: ['warm'],
    priority: 7
  },
  {
    id: 'xinjiang-small-lake',
    src: '/assets/photos/xinjiang-small-lake.jpg',
    title: '新疆小天池',
    placeId: 'bayinbuluke',
    tags: ['新疆', '旅行', '风景', '湖泊'],
    vibes: ['quiet', 'wild'],
    priority: 9
  },
  {
    id: 'xinjiang-pilaf',
    src: '/assets/photos/xinjiang-pilaf.jpg',
    title: '新疆抓饭',
    placeId: 'urumqi',
    tags: ['新疆', '美食'],
    vibes: ['warm'],
    priority: 8
  },
  {
    id: 'urumqi-bazaar-cafe',
    src: '/assets/photos/urumqi-bazaar-cafe.jpg',
    title: '乌鲁木齐大巴扎咖啡馆',
    placeId: 'urumqi',
    tags: ['新疆', '乌鲁木齐', '大巴扎', '街区', '人物'],
    vibes: ['warm', 'random'],
    priority: 9
  },
  {
    id: 'urumqi-bazaar-minarets',
    src: '/assets/photos/urumqi-bazaar-minarets.jpg',
    title: '乌鲁木齐大巴扎宣礼塔',
    placeId: 'urumqi',
    tags: ['新疆', '乌鲁木齐', '大巴扎', '建筑', '风景'],
    vibes: ['quiet', 'wild'],
    priority: 9
  },
  {
    id: 'urumqi-bazaar-dusk',
    src: '/assets/photos/urumqi-bazaar-dusk.jpg',
    title: '傍晚的大巴扎',
    placeId: 'urumqi',
    tags: ['新疆', '乌鲁木齐', '大巴扎', '建筑', '夜景'],
    vibes: ['quiet', 'wild'],
    priority: 8
  },
  {
    id: 'urumqi-bazaar-carpets',
    src: '/assets/photos/urumqi-bazaar-carpets.jpg',
    title: '大巴扎地毯与花艺',
    placeId: 'urumqi',
    tags: ['新疆', '乌鲁木齐', '大巴扎', '文化', '日常'],
    vibes: ['warm', 'random'],
    priority: 8
  },
  {
    id: 'nanning-old-town',
    src: '/assets/photos/nanning-old-town.jpg',
    title: '南宁老城茶院',
    placeId: 'nanning',
    tags: ['广西', '南宁', '街区', '文化', '旅行'],
    vibes: ['quiet', 'warm'],
    priority: 8
  },
  {
    id: 'nanning-night-market',
    src: '/assets/photos/nanning-night-market.jpg',
    title: '南宁夜市',
    placeId: 'nanning',
    tags: ['广西', '南宁', '夜市', '人物', '日常'],
    vibes: ['warm', 'random'],
    priority: 8
  },
  {
    id: 'nanning-water-street',
    src: '/assets/photos/nanning-water-street.jpg',
    title: '南宁水街',
    placeId: 'nanning',
    tags: ['广西', '南宁', '街区', '人物', '旅行'],
    vibes: ['wild', 'warm'],
    priority: 8
  },
  {
    id: 'nanning-dinosaur-garden',
    src: '/assets/photos/nanning-dinosaur-garden.jpg',
    title: '南宁绿荫里的恐龙造景',
    placeId: 'nanning',
    tags: ['广西', '南宁', '旅行', '植物', '风景'],
    vibes: ['wild', 'quiet'],
    priority: 9
  },
  {
    id: 'nanning-street-crossing',
    src: '/assets/photos/nanning-street-crossing.jpg',
    title: '南宁路口的车流',
    placeId: 'nanning',
    tags: ['广西', '南宁', '街区', '人物', '日常'],
    vibes: ['warm', 'random'],
    priority: 9
  },
  {
    id: 'nanning-zhongshan-night',
    src: '/assets/photos/nanning-zhongshan-night.jpg',
    title: '南宁中山路夜色',
    placeId: 'nanning',
    tags: ['广西', '南宁', '建筑', '夜景', '旅行'],
    vibes: ['quiet', 'warm'],
    priority: 9
  },
  {
    id: 'guiping-xishan-overlook',
    src: '/assets/photos/guiping-xishan-overlook.jpg',
    title: '桂平西山远眺',
    placeId: 'guiping',
    tags: ['广西', '桂平', '西山', '风景', '城市'],
    vibes: ['quiet', 'wild'],
    priority: 8
  },
  {
    id: 'guiping-xishan-pavilion',
    src: '/assets/photos/guiping-xishan-pavilion.jpg',
    title: '桂平西山九龙亭',
    placeId: 'guiping',
    tags: ['广西', '桂平', '西山', '亭子', '风景'],
    vibes: ['quiet', 'wild'],
    priority: 9
  },
  {
    id: 'guiping-xishan-longquan',
    src: '/assets/photos/guiping-xishan-longquan.jpg',
    title: '桂平西山龙泉寺',
    placeId: 'guiping',
    tags: ['广西', '桂平', '西山', '寺庙', '文化'],
    vibes: ['quiet'],
    priority: 8
  },
  {
    id: 'guiping-xishan-stone-gate',
    src: '/assets/photos/guiping-xishan-stone-gate.jpg',
    title: '桂平西山胜揽石门',
    placeId: 'guiping',
    tags: ['广西', '桂平', '西山', '山门', '风景'],
    vibes: ['quiet', 'wild'],
    priority: 8
  },
  {
    id: 'xinjiang-naan',
    src: '/assets/photos/xinjiang-naan.jpg',
    title: '新疆馕',
    placeId: 'urumqi',
    tags: ['新疆', '美食', '馕', '大巴扎'],
    vibes: ['warm'],
    priority: 8
  }
]

const places = [
  {
    id: 'nanning',
    name: 'NANNING',
    city: '南宁',
    province: '广西',
    latitude: 22.8240,
    longitude: 108.3200
  },
  {
    id: 'guiping',
    name: 'GUIPING',
    city: '桂平',
    province: '广西',
    latitude: 23.3942,
    longitude: 110.0793
  },
  {
    id: 'urumqi',
    name: 'URUMQI',
    city: '乌鲁木齐',
    province: '新疆',
    latitude: 43.7800,
    longitude: 87.6000
  },
  {
    id: 'bayinbuluke',
    name: 'BAYINBULUKE',
    city: null,
    province: '新疆',
    latitude: 43.0300,
    longitude: 84.1500
  }
]

const timeline = {
  stopIds: ['nanning', 'guiping', 'urumqi', 'bayinbuluke']
}

const journeys = [
  {
    id: 'journey-nanning',
    placeId: 'nanning',
    order: 1,
    date: null,
    dateRange: null,
    title: null,
    intro: '从熟悉的城市开始，老街、茶院和日常，把暑假的第一段慢慢铺开。',
    tags: [],
    photoIds: [
      'nanning-old-town',
      'nanning-night-market',
      'nanning-water-street',
      'nanning-dinosaur-garden',
      'nanning-street-crossing',
      'nanning-zhongshan-night'
    ],
    coverPhotoId: 'nanning-old-town'
  },
  {
    id: 'journey-guiping',
    placeId: 'guiping',
    order: 2,
    date: null,
    dateRange: null,
    title: null,
    intro: '和家人一起上西山、走进山林，这一站更像是把时间重新留给身边的人。',
    tags: [],
    photoIds: [
      'guiping-jiulong',
      'guiping-longchi',
      'guiping-ruquan',
      'guiping-grandma',
      'guiping-xishan-overlook',
      'guiping-xishan-pavilion',
      'guiping-xishan-longquan',
      'guiping-xishan-stone-gate'
    ],
    coverPhotoId: 'guiping-longchi'
  },
  {
    id: 'journey-urumqi',
    placeId: 'urumqi',
    order: 3,
    date: null,
    dateRange: null,
    title: null,
    intro: '从街区、建筑到夜色，这一站记录的是抵达新疆之后的城市生活。',
    tags: [],
    photoIds: [
      'urumqi-bazaar-cafe',
      'urumqi-bazaar-minarets',
      'urumqi-bazaar-dusk',
      'urumqi-bazaar-carpets',
      'xinjiang-bbq',
      'xinjiang-noodles',
      'xinjiang-burger',
      'xinjiang-mutton',
      'xinjiang-pilaf',
      'xinjiang-naan'
    ],
    coverPhotoId: 'urumqi-bazaar-cafe'
  },
  {
    id: 'journey-bayinbuluke',
    placeId: 'bayinbuluke',
    order: 4,
    date: null,
    dateRange: null,
    title: null,
    intro: '离城市越来越远，草原、湖泊和长途路程，把这一站变成整个暑假最开阔的一段。',
    tags: [],
    photoIds: [
      'xinjiang-bayinbuluke',
      'xinjiang-grassland',
      'xinjiang-gongnaizi',
      'xinjiang-cloud',
      'xinjiang-shenchi',
      'xinjiang-small-lake'
    ],
    coverPhotoId: 'xinjiang-bayinbuluke'
  }
]

const totals = {
  capturedPhotoCount: 245,
  curatedPhotoCount: photos.length
}

const curation = {
  topPlaceId: 'bayinbuluke',
  topPlacePhotoId: 'xinjiang-bayinbuluke',
  topPlaceDisplayLines: ['BAYIN', 'BULUKE'],
  summerType: {
    name: 'OFF SCRIPT',
    tags: ['SPONTANEOUS', 'PLAYFUL', 'ON THE MOVE'],
    copy: ['THE BEST PARTS', "WEREN'T IN THE PLAN."]
  },
  biggestDay: {
    date: '2026-08-01',
    placeId: 'bayinbuluke',
    stats: [
      { value: '1.5 KM', label: 'GRASS SLIDE' },
      { value: 'FIRST', label: 'TIME' },
      { value: '500+ KM', label: 'ON THE ROAD' }
    ],
    copy: ['FIRST TIME DOWN.', 'A VERY LONG WAY BACK.']
  },
  soundtrack: {
    tracks: [
      { number: '01', title: 'WE LIKE 2 PARTY', artist: 'BIGBANG' },
      { number: '02', title: 'SNOOZE', artist: 'SZA' },
      { number: '03', title: 'WAIT FOR IT', artist: 'HAMILTON' }
    ]
  },
  planVsReality: {
    intro: ['I HAD', 'A PLAN.'],
    planLabel: 'PLAN',
    plan: ['STUDY', 'IELTS.'],
    realityLabel: 'REALITY',
    reality: ['GAMES.', 'FOOD.', 'FRIENDS.', 'TRIPS.'],
    copy: ['SUMMER HAD', 'OTHER PLANS.']
  },
  moments: [
    {
      order: 1,
      id: 'grandma-xishan',
      title: '和外婆去桂平西山',
      photoId: 'guiping-grandma'
    },
    {
      order: 2,
      id: 'friends-cards-bbq',
      title: '和朋友打牌 / 烧烤',
      photoId: 'guangxi-friends-cards'
    },
    {
      order: 3,
      id: 'playing-games',
      title: '一起玩游戏',
      photoId: 'playing-games'
    }
  ]
}

const keywordAliases = {
  travel: '旅行',
  '旅游': '旅行',
  '出门': '旅行',
  food: '美食',
  '吃': '美食',
  '吃的': '美食',
  people: '人物',
  '人': '人物',
  scenery: '风景',
  '景色': '风景',
  '自然': '风景',
  xinjiang: '新疆',
  guangxi: '广西',
  guiping: '桂平',
  family: '家人',
  friends: '朋友',
  friend: '朋友',
  pet: '宠物',
  game: '游戏',
  nanning: '南宁',
  urumqi: '乌鲁木齐',
  bazaar: '大巴扎',
  naan: '馕'
}

const names = {
  '新疆': 'XINJIANG',
  '广西': 'GUANGXI',
  '桂平': 'GUIPING',
  '旅行': 'TRAVEL',
  '美食': 'FOOD',
  '人物': 'PEOPLE',
  '家人': 'FAMILY',
  '朋友': 'FRIENDS',
  '风景': 'SCENERY',
  '宠物': 'PET',
  '游戏': 'GAMES',
  '南宁': 'NANNING',
  '乌鲁木齐': 'URUMQI',
  '大巴扎': 'GRAND BAZAAR',
  '馕': 'NAAN'
}

function normalizeQuery(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function resolveAlias(query) {
  return keywordAliases[query] || query
}

function matchPhoto(photo, query) {
  if (!query) {
    return { matched: true, tagMatch: false, titleMatch: false, placeMatch: false }
  }

  const tags = photo.tags.map(normalizeQuery)
  const title = normalizeQuery(photo.title)
  const place = normalizeQuery(photo.placeId)
  const tagMatch = tags.indexOf(query) !== -1
  const titleMatch = title.indexOf(query) !== -1
  const placeMatch = place.indexOf(query) !== -1

  return {
    matched: tagMatch || titleMatch || placeMatch,
    tagMatch,
    titleMatch,
    placeMatch
  }
}

function scoreParts(photo, match, vibe) {
  const tagBonus = match.tagMatch ? 10 : 0
  const titleBonus = match.titleMatch ? 6 : 0
  const placeBonus = match.placeMatch ? 6 : 0
  const vibeBonus = vibe !== 'random' && photo.vibes.indexOf(vibe) !== -1 ? 5 : 0

  return {
    priority: photo.priority,
    tagBonus,
    titleBonus,
    placeBonus,
    vibeBonus,
    total: photo.priority + tagBonus + titleBonus + placeBonus + vibeBonus
  }
}

function scorePhoto(photo, selectedPlace, selectedVibe) {
  const match = selectedPlace && typeof selectedPlace === 'object'
    ? selectedPlace
    : matchPhoto(photo, resolveAlias(normalizeQuery(selectedPlace)))
  const parts = scoreParts(photo, match, selectedVibe || 'random')
  const breakdown = {
    priority: parts.priority,
    tagMatch: parts.tagBonus,
    titleMatch: parts.titleBonus,
    placeMatch: parts.placeBonus,
    vibeMatch: parts.vibeBonus
  }
  const reasons = []

  if (breakdown.placeMatch) reasons.push('PLACE MATCH')
  if (breakdown.tagMatch) reasons.push('TAG MATCH')
  if (breakdown.titleMatch) reasons.push('TITLE MATCH')
  if (breakdown.vibeMatch) reasons.push('VIBE MATCH')
  if (breakdown.priority) reasons.push('CURATION PRIORITY')

  return {
    total: parts.total,
    breakdown,
    reasons
  }
}

function getCopy(query, vibe) {
  const intros = {
    '新疆': 'YOU PICKED\nXINJIANG.',
    '美食': 'THIS SUMMER\nTASTED LIKE...',
    '人物': 'THE PEOPLE\nWHO MADE\nTHE SUMMER.',
    '风景': 'SOME PARTS\nWERE QUIETER.'
  }
  const summaries = {
    quiet: 'A slower cut of the summer.',
    wild: 'Big roads. Big skies. No staying still.',
    warm: 'The people and parts that stayed close.',
    random: 'No theme. Just summer.'
  }
  const display = names[query] || query.toUpperCase()

  return {
    intro: intros[query] || (query ? `YOU PICKED\n${display}.` : 'SURPRISE\nME.'),
    summary: summaries[vibe] || summaries.random
  }
}

function rankPhotos(candidates) {
  return candidates.slice().sort((a, b) => (
    b.score - a.score || b.priority - a.priority || a.id.localeCompare(b.id) || a.order - b.order
  ))
}

function buildCut(value, vibe) {
  const placeId = value && typeof value === 'object' ? value.placeId : null
  const rawQuery = normalizeQuery(placeId || value)
  const query = placeId ? rawQuery : resolveAlias(rawQuery)
  const pickedVibe = vibe || 'random'
  const ranked = []

  photos.forEach((photo, index) => {
    const match = placeId
      ? { matched: photo.placeId === placeId, placeMatch: photo.placeId === placeId, tagMatch: false, titleMatch: false }
      : matchPhoto(photo, query)

    if (match.matched) {
      const scored = scorePhoto(photo, match, pickedVibe)

      ranked.push({
        ...photo,
        score: scored.total,
        scoreBreakdown: scored.breakdown,
        scoreReasons: scored.reasons,
        order: index
      })
    }
  })

  const rankedPhotos = rankPhotos(ranked)

  const selectedPhotos = rankedPhotos.slice(0, 5)

  return {
    query,
    vibe: pickedVibe,
    title: `${names[query] || query.toUpperCase() || 'SURPRISE'} CUT`,
    count: rankedPhotos.length,
    rankedPhotos,
    selectedPhotos,
    copy: getCopy(query, pickedVibe)
  }
}

module.exports = {
  meta: {
    year: 2026,
    startDate: '2026-07-17',
    endDate: '2026-08-20',
    inclusiveDays: 35
  },
  summary: {
    placeCount: 4,
    photoCount: 245
  },
  totals,
  places,
  timeline,
  journeys,
  curation,
  photos,
  keywordAliases,
  normalizeQuery,
  resolveAlias,
  matchPhoto,
  scoreParts,
  scorePhoto,
  rankPhotos,
  buildCut
}
