const cloud = require('wx-server-sdk');
const { createHash } = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const read = async ref => (await ref.get()).data;
const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

exports.main = async ({ postId, liked } = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid || !validId(postId) || typeof liked !== 'boolean') return { success: false, error: '点赞参数无效，请重新打开动态' };
  try {
    const result = await db.runTransaction(async tx => {
      const postRef = tx.collection('posts').doc(postId);
      const post = await read(postRef);
      if (!post || post.deleted) throw new Error('动态不存在');
      const userRef = tx.collection('users').doc(hash(openid));
      const authorRef = tx.collection('users').doc(hash(post._openid));
      const user = await read(userRef), author = await read(authorRef);
      if (!user || !author) throw new Error('请重新登录');
      const id = hash(`${openid}:${postId}`);
      const likeRef = tx.collection('likes').doc(id);
      const exists = !!await read(likeRef);
      let likeCount = post.likeCount || 0;
      if (exists !== liked) {
        likeCount = Math.max(0, likeCount + (liked ? 1 : -1));
        const notification = tx.collection('notifications').doc(hash(`like:${id}`));
        if (liked) {
          await likeRef.set({ data: { _openid: openid, postId, createTime: db.serverDate() } });
          if (openid !== post._openid) await notification.set({ data: { receiverOpenid: post._openid, senderOpenid: openid, type: 'like', postId, content: '', isRead: false, createTime: db.serverDate() } });
        } else {
          await likeRef.remove();
          if (openid !== post._openid) await notification.remove();
        }
        await postRef.update({ data: { likeCount } });
        await authorRef.update({ data: { likeReceivedCount: Math.max(0, (author.likeReceivedCount || 0) + (liked ? 1 : -1)) } });
      }
      return { isLiked: liked, likeCount };
    });
    return { success: true, ...result };
  } catch (error) { console.error('toggleLike', error); return { success: false, error: '点赞未完成，请重试' }; }
};
