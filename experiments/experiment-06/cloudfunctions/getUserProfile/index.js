const cloud = require('wx-server-sdk');
const { createHash } = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const read = async ref => (await ref.get()).data;
const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const validPage = (page, size) => Number.isInteger(page) && page >= 1 && page <= 10000 && Number.isInteger(size) && size >= 1 && size <= 30;

async function hydrate(posts, openid) {
  if (!posts.length) return posts;
  const ids = [...new Set(posts.map(p => p._openid))];
  const users = (await db.collection('users').where({ _openid: db.command.in(ids) }).limit(100).get()).data;
  const likes = (await db.collection('likes').where({ _openid: openid, postId: db.command.in(posts.map(p => p._id)) }).limit(100).get()).data;
  return posts.map(post => {
    const user = users.find(u => u._openid === post._openid);
    return { ...post, author: user ? { nickName: user.nickName, avatarUrl: user.avatarUrl } : post.author, isLiked: likes.some(l => l.postId === post._id) };
  });
}

exports.main = async (event = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { success:false,error:'请先登录' };
  const { targetOpenid = openid, page = 1, pageSize = 18, tab = 'posts', action = 'get' } = event;
  if (typeof targetOpenid !== 'string' || targetOpenid.length > 128 || !validPage(page,pageSize) || !['posts','likes'].includes(tab)) return { success:false,error:'主页参数无效' };
  const target = targetOpenid || openid;
  try {
    // 沿用上游 getRecommended 分支，分页读取关系以排除全部已关注用户。
    if (event.getRecommended === true) {
      const excluded = [openid];
      for (let offset = 0; ; offset += 100) {
        const { data } = await db.collection('follows').where({ _openid: openid }).orderBy('_id', 'asc').skip(offset).limit(100).get();
        excluded.push(...data.map(f => f.targetOpenid));
        if (data.length < 100) break;
      }
      const { data } = await db.collection('users').where({ _openid: db.command.nin(excluded) })
        .field({ _openid: true, nickName: true, avatarUrl: true, bio: true, followerCount: true, postCount: true })
        .orderBy('followerCount', 'desc').orderBy('_id', 'desc')
        .skip((page - 1) * pageSize).limit(pageSize + 1).get();
      return { success: true, users: data.slice(0, pageSize).map(user => ({ ...user, isFollowed: false, isSelf: false })), hasMore: data.length > pageSize };
    }
    if (action === 'update') {
      if (target !== openid) return { success:false,error:'只能修改自己的资料' };
      const ref = db.collection('users').doc(hash(openid));
      const current = await read(ref);
      if (!current) return { success:false,error:'请重新登录' };
      const { nickName, bio, avatarUrl = current.avatarUrl || '', coverUrl = current.coverUrl || '' } = event;
      if (typeof nickName !== 'string' || !nickName.trim() || nickName.length > 30 || typeof bio !== 'string' || bio.length > 160) return { success:false,error:'昵称需为1～30字，简介最多160字' };
      const ownImage = (value, oldValue) => typeof value === 'string' && (value === (oldValue || '') || value === '' || new RegExp('^cloud://[^/]+/profiles/' + hash(openid) + '/[a-zA-Z0-9._-]+$').test(value));
      if (!ownImage(avatarUrl, current.avatarUrl) || !ownImage(coverUrl, current.coverUrl)) return { success:false,error:'请重新上传头像或封面' };
      await ref.update({ data:{ nickName:nickName.trim(),bio:bio.trim(),avatarUrl,coverUrl } });
      return { success:true,updated:true,userInfo:await read(ref) };
    }
    if (action !== 'get') return { success:false,error:'未知主页操作' };
    const userInfo = await read(db.collection('users').doc(hash(target)));
    if (!userInfo) return { success:false,error:'用户不存在' };
    let posts, hasMore;
    if (tab === 'likes') {
      const { data } = await db.collection('likes').where({ _openid:target }).orderBy('createTime','desc').orderBy('_id','desc').skip((page - 1) * pageSize).limit(pageSize + 1).get();
      const ids = data.slice(0,pageSize).map(l => l.postId);
      const found = ids.length ? (await db.collection('posts').where({ _id:db.command.in(ids), deleted:db.command.neq(true) }).limit(100).get()).data : [];
      posts = ids.map(id => found.find(p => p._id === id)).filter(Boolean); hasMore = data.length > pageSize;
    } else {
      const { data } = await db.collection('posts').where({ _openid:target, deleted:db.command.neq(true) }).orderBy('createTime','desc').orderBy('_id','desc').skip((page - 1) * pageSize).limit(pageSize + 1).get();
      posts = data.slice(0,pageSize); hasMore = data.length > pageSize;
    }
    const isSelf = target === openid;
    const followed = isSelf ? null : await read(db.collection('follows').doc(hash(`${openid}:${target}`)));
    const unreadCount = isSelf ? (await db.collection('notifications').where({ receiverOpenid:openid,isRead:false }).count()).total : 0;
    return { success:true,userInfo,posts:await hydrate(posts,openid),hasMore,isSelf,isFollowed:!!followed,unreadCount };
  } catch (error) { console.error('getUserProfile',error); return { success:false,error:'主页操作失败，请检查集合与索引后重试' }; }
};
