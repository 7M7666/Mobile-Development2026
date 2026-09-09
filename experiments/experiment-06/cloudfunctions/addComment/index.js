const cloud = require('wx-server-sdk');
const { createHash } = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const read = async ref => (await ref.get()).data;
const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

exports.main = async ({ postId, content, requestId } = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid || !validId(postId) || typeof content !== 'string' || !content.trim() || content.length > 500 || typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(requestId)) return { success: false, error: '评论需为1～500字' };
  const id = hash(`${openid}:${requestId}`);
  try {
    const result = await db.runTransaction(async tx => {
      const ref = tx.collection('comments').doc(id);
      const postRef = tx.collection('posts').doc(postId);
      const post = await read(postRef);
      if (!post || post.deleted) throw new Error('动态不存在或已删除');
      const old = await read(ref);
      if (old) {
        if (old.postId !== postId || old.content !== content.trim()) throw new Error('评论请求内容不一致');
        return old;
      }
      const user = await read(tx.collection('users').doc(hash(openid)));
      if (!post || !user) throw new Error('动态或用户不存在');
      const authorRef = tx.collection('users').doc(hash(post._openid));
      const author = await read(authorRef);
      if (!author) throw new Error('作者不存在');
      const comment = { _openid: openid, postId, authorName: user.nickName, avatarUrl: user.avatarUrl, content: content.trim(), createTime: db.serverDate() };
      await ref.set({ data: comment });
      await postRef.update({ data: { commentCount: db.command.inc(1) } });
      await authorRef.update({ data: { commentReceivedCount: (author.commentReceivedCount || 0) + 1 } });
      if (openid !== post._openid) await tx.collection('notifications').doc(hash(`comment:${id}`)).set({ data: { receiverOpenid: post._openid, senderOpenid: openid, type: 'comment', postId, content: content.trim(), isRead: false, createTime: db.serverDate() } });
      return { ...comment, _id: id };
    });
    return { success: true, comment: result };
  } catch (error) { console.error('addComment', error); return { success: false, error: '评论未确认，请重试原评论' }; }
};
