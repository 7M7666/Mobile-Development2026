const cloud = require('wx-server-sdk');
const { createHash } = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const read = async ref => (await ref.get()).data;
const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

exports.main = async ({ targetOpenid, following } = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid || typeof targetOpenid !== 'string' || !targetOpenid || targetOpenid.length > 128 || typeof following !== 'boolean') return { success: false, error: '关注参数无效' };
  if (targetOpenid === openid) return { success: false, error: '不能关注自己' };
  try {
    const result = await db.runTransaction(async tx => {
      const selfRef = tx.collection('users').doc(hash(openid)), targetRef = tx.collection('users').doc(hash(targetOpenid));
      const self = await read(selfRef), target = await read(targetRef);
      if (!self || !target) throw new Error('用户不存在');
      const id = hash(`${openid}:${targetOpenid}`);
      const ref = tx.collection('follows').doc(id);
      const exists = !!await read(ref);
      let followerCount = target.followerCount || 0;
      if (exists !== following) {
        const notice = tx.collection('notifications').doc(hash(`follow:${id}`));
        if (following) {
          await ref.set({ data: { _openid: openid, targetOpenid, createTime: db.serverDate() } });
          await notice.set({ data: { receiverOpenid: targetOpenid, senderOpenid: openid, type: 'follow', postId: '', content: '', isRead: false, createTime: db.serverDate() } });
        } else { await ref.remove(); await notice.remove(); }
        followerCount = Math.max(0, followerCount + (following ? 1 : -1));
        await targetRef.update({ data: { followerCount } });
        await selfRef.update({ data: { followingCount: Math.max(0, (self.followingCount || 0) + (following ? 1 : -1)) } });
      }
      return { isFollowed: following, followerCount };
    });
    return { success: true, ...result };
  } catch (error) { console.error('toggleFollow', error); return { success: false, error: '关注操作未完成，请重试' }; }
};
