// 模拟新闻数据
const news = [
  {
    id: '122579',
    title: '山东省人民政府副省长、党组成员闫剑波来校调研',
    poster: '/images/来校调研.jpg',
    content: '8月27日，山东省人民政府副省长、党组成员闫剑波来到中国海洋大学调研，学校党委书记李明陪同。调研组参观了校史馆、海洋科技成果展和海洋工程技术与装备展，了解学校在海洋科技创新、人才培养和服务经济社会发展等方面的情况。',
    add_date: '2026-08-28',
    category: '要闻'
  },

  {
    id: '122578',
    title: '中国船舶集团有限公司董事长、党组书记徐鹏来校调研',
    poster: '/images/中国船舶1.jpg',
    content: '8月27日，中国船舶集团有限公司董事长、党组书记徐鹏一行来到中国海洋大学调研。双方围绕深海装备、极地装备、智能船舶等领域的科研合作，以及人才培养、平台建设和科技成果转化进行了交流。',
    add_date: '2026-08-28',
    category: '要闻'
  },

  {
    id: '122574',
    title: '学校2026年度国家自然科学基金再创佳绩',
    poster: '/images/自然基金科学.jpg',
    content: '2026年国家自然科学基金集中接收期项目评审结果公布。中国海洋大学共申报各类项目1110项，截至目前获批281项，同比增长33.2%，获批直接经费1.75亿元，多项指标实现明显增长。',
    add_date: '2026-08-27',
    category: '科研'
  },

  {
    id: '122572',
    title: '中国海洋大学在海洋生态修复综合成效评估领域取得新进展',
    poster: '/images/生态修复.jpg',
    content: '中国海洋大学海洋与大气学院科研团队联合国内外研究力量，在海洋生态修复综合成效评估方面取得新进展。研究构建了区域性海洋生态修复成效指数，并从国家尺度对多区域、多生态类型的海洋生态修复工程进行了综合评估。',
    add_date: '2026-08-26',
    category: '科研'
  },

  {
    id: '122570',
    title: '中国海洋大学参加2026山东省教育博览会',
    poster: '/images/教育博览会.jpg',
    content: '8月21日至23日，2026山东省教育博览会在山东国际会展中心举办。中国海洋大学参加教育高质量发展成果展，集中展示学校在人才培养、学科建设、科技创新以及服务海洋强国建设等方面的发展成果。',
    add_date: '2026-08-26',
    category: '校园'
  },

  {
    id: '122569',
    title: '中国海洋大学学子在第二十届中国大学生跆拳道锦标赛总决赛中再创佳绩',
    poster: '/images/跆拳道.jpg',
    content: '第二十届中国大学生跆拳道锦标赛总决赛在南京举行。中国海洋大学代表队经过多轮比赛，最终获得2枚银牌和1枚铜牌。本届比赛汇聚全国185所高校的优秀运动员，海大学子实现了学校跆拳道队新的突破。',
    add_date: '2026-08-26',
    category: '学生'
  },

  {
    id: '122559',
    title: '中国海洋大学2026级研究生开学典礼举行',
    poster: '/images/研究生开学2.jpg',
    content: '8月24日，中国海洋大学2026级研究生开学典礼在崂山校区综合体育馆举行。1134名博士研究生和5092名硕士研究生齐聚海大园，开启新的学习和科研生活。典礼期间还举行了研究生卓越奖学金表彰等活动。',
    add_date: '2026-08-24',
    category: '校园'
  },

  {
    id: '122555',
    title: '中国海洋大学2026级研究生入学报到',
    poster: '/images/入学报道.jpg',
    content: '8月23日，中国海洋大学2026级研究生新生开始入学报到。学校在校园设置迎新报到点和志愿服务岗位，并做好住宿、餐饮和校园服务等保障工作，来自全国各地的新生正式开启海大学习生活。',
    add_date: '2026-08-24',
    category: '校园'
  }
];
function getNewsList() {
  let list = [];

  for (var i = 0; i < news.length; i++) {
    let obj = {};

    obj.id = news[i].id;
    obj.poster = news[i].poster;
    obj.add_date = news[i].add_date;
    obj.title = news[i].title;
    obj.category = news[i].category;
    obj.content = news[i].content;

    list.push(obj);
  }

  return list;
}

function getNewsDetail(newsID) {
  let msg = {
    code: '404',
    news: {}
  };

  for (var i = 0; i < news.length; i++) {
    if (newsID == news[i].id) {
      msg.code = '200';
      msg.news = news[i];
      break;
    }
  }

  return msg;
}
module.exports = {
  getNewsList: getNewsList,
  getNewsDetail: getNewsDetail
}
