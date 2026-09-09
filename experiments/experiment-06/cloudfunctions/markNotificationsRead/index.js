const cloud = require('wx-server-sdk');
const { createHash } = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const read = async ref => (await ref.get()).data;
const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

exports.main = async ({ ids } = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid || !Array.isArray(ids) || ids.length > 30 || !ids.every(validId)) return { success:false,error:'消息参数无效' };
  try {
    if (ids.length) await db.collection('notifications').where({ receiverOpenid: openid, _id: db.command.in(ids), isRead:false }).update({ data:{ isRead:true } });
    return { success:true };
  } catch (error) { console.error('markNotificationsRead',error); return { success:false,error:'未能标记已读，请重试' }; }
};
