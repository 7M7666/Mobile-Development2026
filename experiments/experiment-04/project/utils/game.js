const DIRECTIONS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
}

function clonePosition(position) {
  return {
    row: position.row,
    col: position.col,
  }
}

function cloneBoxes(boxes) {
  return boxes.map(clonePosition)
}

function cloneState(state) {
  return {
    staticMap: state.staticMap,
    targets: state.targets,
    player: clonePosition(state.player),
    boxes: cloneBoxes(state.boxes),
  }
}

function isWall(staticMap, row, col) {
  return !staticMap[row] || staticMap[row][col] !== 0
}

function getBoxIndex(boxes, row, col) {
  return boxes.findIndex(box => box.row === row && box.col === col)
}

function isTarget(targets, row, col) {
  return targets.some(target => target.row === row && target.col === col)
}

function checkWin(boxes, targets) {
  return boxes.every(box => isTarget(targets, box.row, box.col))
}

function tryMove(state, directionName) {
  const direction = DIRECTIONS[directionName]

  if (!direction) {
    return { moved: false, pushed: false, state }
  }

  const nextPlayer = {
    row: state.player.row + direction.dr,
    col: state.player.col + direction.dc,
  }

  if (isWall(state.staticMap, nextPlayer.row, nextPlayer.col)) {
    return { moved: false, pushed: false, state }
  }

  const boxIndex = getBoxIndex(state.boxes, nextPlayer.row, nextPlayer.col)

  if (boxIndex === -1) {
    const nextState = cloneState(state)
    nextState.player = nextPlayer
    return { moved: true, pushed: false, state: nextState }
  }

  const nextBox = {
    row: nextPlayer.row + direction.dr,
    col: nextPlayer.col + direction.dc,
  }

  if (
    isWall(state.staticMap, nextBox.row, nextBox.col) ||
    getBoxIndex(state.boxes, nextBox.row, nextBox.col) !== -1
  ) {
    return { moved: false, pushed: false, state }
  }

  const nextState = cloneState(state)
  nextState.player = nextPlayer
  nextState.boxes[boxIndex] = nextBox

  return { moved: true, pushed: true, state: nextState }
}

function resetLevel(initialState) {
  return cloneState(initialState)
}

module.exports = {
  DIRECTIONS,
  isWall,
  getBoxIndex,
  isTarget,
  checkWin,
  tryMove,
  resetLevel,
}
