const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });

const { createHash } = require('crypto');
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);

async function readDoc(ref) {
  const { data } = await ref.get();
  return data && data._id ? data : null;
}

exports.main = async () => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { success: false, error: '无法获取微信身份' };
  try {
    const id = hash(openid);
    await db.runTransaction(async transaction => {
      const ref = transaction.collection('users').doc(id);
      if (await readDoc(ref)) return;
      await ref.set({ data: {
        _openid: openid, nickName: '海大同学', avatarUrl: '', coverUrl: '', bio: '',
        postCount: 0, likeReceivedCount: 0, commentReceivedCount: 0,
        followerCount: 0, followingCount: 0, createTime: db.serverDate()
      } });
    });
    const userInfo = await readDoc(db.collection('users').doc(id));
    return { success: true, openid, userInfo };
  } catch (error) {
    console.error('login', error);
    return { success: false, error: '登录失败，请检查 users 集合和云函数部署' };
  }
};
