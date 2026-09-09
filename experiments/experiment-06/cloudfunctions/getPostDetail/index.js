const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const { createHash } = require('crypto');
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);

async function readDoc(ref) {
  const { data } = await ref.get();
  return data && data._id ? data : null;
}

exports.main = async (event = {}) => {
  if (!cloud.getWXContext().OPENID) return { success: false, error: '请先登录' };
  const { postId, countView = true } = event;
  if (typeof postId !== 'string' || !/^[a-f0-9]{32}$/.test(postId)) return { success: false, error: '动态链接无效' };
  try {
    const ref = db.collection('posts').doc(postId);
    const post = await readDoc(ref);
    if (!post || post.deleted) return { success: false, error: '这条动态不存在或已被删除' };
    if (countView) {
      await ref.update({ data: { viewCount: db.command.inc(1) } });
      post.viewCount += 1;
    }
    const openid = cloud.getWXContext().OPENID;
    post.isOwner = post._openid === openid;
    post.isLiked = !!await readDoc(db.collection('likes').doc(hash(`${openid}:${postId}`)));
    const author = await readDoc(db.collection('users').doc(hash(post._openid)));
    if (author) post.author = { nickName: author.nickName, avatarUrl: author.avatarUrl };
    return { success: true, post };
  } catch (error) {
    console.error('getPostDetail', error);
    return { success: false, error: '动态加载失败，请稍后重试' };
  }
};
