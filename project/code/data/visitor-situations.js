// 互动对照版本，不作为已核实的历史行为。
module.exports = {
  nanning: {
    scene: '今天下午突然完全空出来了。', question: '如果是你，会怎么过？',
    comparisonKind: 'curated', comparisonChoice: 'go_eat',
    choices: [
      { id: 'stay_home', label: '留在家里', weights: { quiet: 3 } },
      { id: 'go_eat', label: '出去吃东西', weights: { social: 2, city: 1 } },
      { id: 'walk_city', label: '随便在城市里走走', weights: { city: 2, spontaneous: 1 } }
    ]
  },
  guiping: {
    scene: '晚上突然没有计划了。', question: '如果是你，会怎么选？',
    comparisonKind: 'curated', comparisonChoice: 'meet_people',
    choices: [
      { id: 'meet_people', label: '去见人', weights: { social: 3 } },
      { id: 'stay_in', label: '留在家里', weights: { quiet: 3 } },
      { id: 'go_random', label: '临时去一个没计划的地方', weights: { spontaneous: 4 } }
    ]
  },
  urumqi: {
    scene: '如果离开之前只能再留下一顿饭。', question: '你会怎么选？',
    comparisonKind: 'curated', comparisonChoice: 'bbq',
    choices: [
      { id: 'bbq', label: '吃烧烤', weights: { social: 2, city: 1 } },
      { id: 'noodles', label: '吃面', weights: { city: 2 } },
      { id: 'keep_exploring', label: '先不吃，继续逛', weights: { spontaneous: 3, city: 1 } }
    ]
  },
  bayinbuluke: {
    time: '18:20', scene: '太阳快落了。而且已经在路上坐了一整天。', question: '如果是你，会怎么选？',
    comparisonKind: 'curated', comparisonChoice: 'keep_driving',
    choices: [
      { id: 'stop_sunset', label: '停下来等日落', weights: { nature: 3, quiet: 2 } },
      { id: 'keep_driving', label: '继续走', weights: { planned: 2 } },
      { id: 'change_plan', label: '临时改变计划', weights: { spontaneous: 4 } }
    ]
  }
}
