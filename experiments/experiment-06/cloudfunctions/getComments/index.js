const cloud = require('wx-server-sdk');
const { createHash } = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const read = async ref => (await ref.get()).data;
const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const validPage = (page, size) => Number.isInteger(page) && page >= 1 && page <= 10000 && Number.isInteger(size) && size >= 1 && size <= 30;

exports.main = async ({ postId, page = 1, pageSize = 20 } = {}) => {
  if (!cloud.getWXContext().OPENID || !validId(postId) || !validPage(page,pageSize)) return { success:false,error:'评论参数无效' };
  try {
    const post = await read(db.collection('posts').doc(postId));
    if (!post || post.deleted) return { success:false,error:'动态不存在或已删除' };
    const { data } = await db.collection('comments').where({ postId }).orderBy('createTime','desc').orderBy('_id','desc').skip((page - 1) * pageSize).limit(pageSize + 1).get();
    const comments = data.slice(0,pageSize);
    if (comments.length) {
      const users = (await db.collection('users').where({ _openid: db.command.in([...new Set(comments.map(c => c._openid))]) }).limit(100).get()).data;
      comments.forEach(c => { const user = users.find(u => u._openid === c._openid); if (user) { c.authorName = user.nickName; c.avatarUrl = user.avatarUrl; } });
    }
    return { success:true,comments,hasMore:data.length > pageSize };
  } catch (error) { console.error('getComments',error); return { success:false,error:'评论加载失败，请重试' }; }
};
