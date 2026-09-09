const cloud = require('wx-server-sdk');
const { createHash } = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);

exports.main = async ({ postId } = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid || typeof postId !== 'string' || !/^[a-f0-9]{32}$/.test(postId)) return { success: false, error: '删除参数无效' };
  try {
    await db.runTransaction(async tx => {
      const ref = tx.collection('posts').doc(postId);
      const { data: post } = await ref.get();
      if (!post || post._openid !== openid) throw new Error('只能删除自己的动态');
      if (post.deleted) return;
      const userRef = tx.collection('users').doc(hash(openid));
      const { data: user } = await userRef.get();
      if (!user) throw new Error('请重新登录');
      await ref.update({ data: { deleted: true } });
      await userRef.update({ data: {
        postCount: Math.max(0, (user.postCount || 0) - 1),
        likeReceivedCount: Math.max(0, (user.likeReceivedCount || 0) - (post.likeCount || 0)),
        commentReceivedCount: Math.max(0, (user.commentReceivedCount || 0) - (post.commentCount || 0))
      } });
    });
    // 保留删除标记防止旧发布请求重建动态；清理可在失败后安全重试。
    for (const name of ['likes', 'comments', 'notifications']) {
      for (;;) {
        const { data } = await db.collection(name).where({ postId }).limit(100).get();
        if (!data.length) break;
        await Promise.all(data.map(row => db.collection(name).doc(row._id).remove()));
      }
    }
    return { success: true };
  } catch (error) {
    console.error('deletePost', error);
    return { success: false, error: '删除未完成，请确认是自己的动态后重试' };
  }
};
