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
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { success: false, error: '请先登录' };
  const userId = hash(openid);
  const { requestId, images, caption = '', tags = [], location = {} } = event;
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(requestId)) return { success: false, error: '发布请求标识无效' };
  const prefix = `/moments/${userId}/${requestId}/`;
  if (!Array.isArray(images) || images.length < 1 || images.length > 9 || new Set(images).size !== images.length || images.some(file => typeof file !== 'string' || !/^cloud:\/\/[^/]+\//.test(file) || !file.includes(prefix) || !/\/\d+\.(jpg|jpeg|png|webp)$/i.test(file))) {
    return { success: false, error: '请上传1～9张属于本次发布的云图片' };
  }
  if (typeof caption !== 'string' || caption.length > 1000 || !Array.isArray(tags) || tags.length > 5 || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 20)) return { success: false, error: '文字或标签长度不符合要求' };
  if (!location || typeof location.name !== 'string' || location.name.length > 60) return { success: false, error: '地点名称最多60字' };
  const normalized = {
    images, caption: caption.trim(), tags: [...new Set(tags.map(tag => tag.trim().replace(/^#+/, '')))].filter(Boolean),
    location: { name: location.name.trim(), latitude: null, longitude: null }
  };
  const postId = hash(`${openid}:${requestId}`);
  try {
    await db.runTransaction(async transaction => {
      const ref = transaction.collection('posts').doc(postId);
      const existing = await readDoc(ref);
      if (existing) {
        if (existing.deleted) throw new Error('POST_DELETED');
        if (JSON.stringify({ images: existing.images, caption: existing.caption, tags: existing.tags, location: existing.location }) !== JSON.stringify(normalized)) throw new Error('IDEMPOTENCY_CONFLICT');
        return;
      }
      const userRef = transaction.collection('users').doc(userId);
      const user = await readDoc(userRef);
      if (!user) throw new Error('LOGIN_REQUIRED');
      await ref.set({ data: {
        _openid: openid, author: { nickName: user.nickName, avatarUrl: user.avatarUrl }, ...normalized,
        likeCount: 0, commentCount: 0, viewCount: 0, createTime: db.serverDate()
      } });
      await userRef.update({ data: { postCount: db.command.inc(1) } });
    });
    return { success: true, postId };
  } catch (error) {
    console.error('createPost', error);
    return { success: false, error: error.message === 'IDEMPOTENCY_CONFLICT' ? '同一发布请求不能修改内容' : '保存失败，请检查部署后重试' };
  }
};
