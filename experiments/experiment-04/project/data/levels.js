const levels = [
  {
    id: 1,
    name: 'FIRST FISH',
    staticMap: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
    playerStart: { row: 2, col: 1 },
    boxesStart: [{ row: 1, col: 5 }],
    targets: [{ row: 1, col: 3 }],
  },
  {
    id: 2,
    name: 'TWO BOWLS',
    staticMap: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
    playerStart: { row: 3, col: 4 },
    boxesStart: [
      { row: 3, col: 2 },
      { row: 3, col: 3 },
    ],
    targets: [
      { row: 2, col: 2 },
      { row: 2, col: 5 },
    ],
  },
  {
    id: 3,
    name: 'THE CORNER',
    staticMap: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 1, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
    playerStart: { row: 3, col: 3 },
    boxesStart: [
      { row: 2, col: 2 },
      { row: 2, col: 3 },
    ],
    targets: [
      { row: 1, col: 4 },
      { row: 3, col: 5 },
    ],
  },
  {
    id: 4,
    name: 'DINNER TIME',
    staticMap: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1, 0, 0, 1],
      [1, 0, 0, 0, 1, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
    playerStart: { row: 3, col: 4 },
    boxesStart: [
      { row: 2, col: 2 },
      { row: 2, col: 5 },
      { row: 4, col: 3 },
    ],
    targets: [
      { row: 1, col: 2 },
      { row: 3, col: 6 },
      { row: 4, col: 4 },
    ],
  },
]

module.exports = {
  levels,
}
