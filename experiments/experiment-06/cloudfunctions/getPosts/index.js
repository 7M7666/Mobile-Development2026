const cloud = require('wx-server-sdk');
const { createHash } = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const read = async ref => (await ref.get()).data;
const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const validPage = (page, size) => Number.isInteger(page) && page >= 1 && page <= 10000 && Number.isInteger(size) && size >= 1 && size <= 30;

async function hydrate(posts, openid) {
  if (!posts.length) return posts;
  const ids = [...new Set(posts.map(p => p._openid))];
  const users = (await db.collection('users').where({ _openid: db.command.in(ids) }).limit(100).get()).data;
  const likes = (await db.collection('likes').where({ _openid: openid, postId: db.command.in(posts.map(p => p._id)) }).limit(100).get()).data;
  return posts.map(post => {
    const user = users.find(u => u._openid === post._openid);
    return { ...post, author: user ? { nickName: user.nickName, avatarUrl: user.avatarUrl } : post.author, isLiked: likes.some(l => l.postId === post._id) };
  });
}

exports.main = async ({ page = 1, pageSize = 12, mode = 'forYou', tag = '', sortBy = 'newest', getHotTags = false } = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid || !validPage(page, pageSize) || !['forYou','following','tag'].includes(mode) || typeof tag !== 'string' || tag.length > 20 || !['newest','hot'].includes(sortBy) || (mode === 'tag' && !tag.trim())) return { success: false, error: '信息流参数无效' };
  try {
    if (getHotTags === true) {
      const { data } = await db.collection('posts').where({ deleted: db.command.neq(true) }).orderBy('createTime','desc').orderBy('_id','desc').field({ tags: true }).limit(100).get();
      return { success: true, posts: data };
    }
    let query = { deleted: db.command.neq(true), ...(tag ? { tags: tag } : {}) };
    if (mode === 'following') {
      const targets = [];
      for (let offset = 0; ; offset += 100) {
        const { data } = await db.collection('follows').where({ _openid: openid }).orderBy('_id','asc').skip(offset).limit(100).get();
        targets.push(...data.map(f => f.targetOpenid));
        if (data.length < 100) break;
      }
      if (!targets.length) return { success: true, posts: [], hasMore: false, page };
      query._openid = db.command.in(targets);
    }
    let feed = db.collection('posts').where(query);
    if (sortBy === 'hot') feed = feed.orderBy('likeCount', 'desc');
    const { data } = await feed.orderBy('createTime','desc').orderBy('_id','desc').skip((page - 1) * pageSize).limit(pageSize + 1).get();
    return { success: true, posts: await hydrate(data.slice(0,pageSize), openid), hasMore: data.length > pageSize, page };
  } catch (error) { console.error('getPosts',error); return { success:false,error:'动态加载失败，请检查集合与索引后重试' }; }
};
