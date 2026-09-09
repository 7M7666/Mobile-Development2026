const cloud = require('wx-server-sdk');
const { createHash } = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const read = async ref => (await ref.get()).data;
const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const validPage = (page, size) => Number.isInteger(page) && page >= 1 && page <= 10000 && Number.isInteger(size) && size >= 1 && size <= 30;

exports.main = async ({ page = 1, pageSize = 20 } = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid || !validPage(page,pageSize)) return { success:false,error:'消息参数无效' };
  try {
    const { data } = await db.collection('notifications').where({ receiverOpenid: openid }).orderBy('createTime','desc').orderBy('_id','desc').skip((page - 1) * pageSize).limit(pageSize + 1).get();
    const notifications = data.slice(0,pageSize);
    if (notifications.length) {
      const users = (await db.collection('users').where({ _openid: db.command.in([...new Set(notifications.map(n => n.senderOpenid))]) }).limit(100).get()).data;
      notifications.forEach(n => { const user = users.find(u => u._openid === n.senderOpenid); n.sender = { nickName: user ? user.nickName : '海大同学', avatarUrl: user ? user.avatarUrl : '' }; });
    }
    const { total } = await db.collection('notifications').where({ receiverOpenid: openid, isRead:false }).count();
    return { success:true,notifications,unreadCount:total,hasMore:data.length > pageSize };
  } catch (error) { console.error('getNotifications',error); return { success:false,error:'消息加载失败，请重试' }; }
};
