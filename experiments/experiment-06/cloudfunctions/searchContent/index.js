// 改编自 yydscq6/wechat-image-community 的 searchContent，扩展为动态、用户和标签搜索。
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database({ throwOnNotFound: false });
const _ = db.command;
const $ = db.command.aggregate;

// 云函数入口函数
exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { keyword, type = 'post', page = 1, pageSize = 12 } = event;

  try {
    if (!openid || typeof keyword !== 'string' || !keyword.trim() || keyword.length > 60 || !['post', 'user', 'tag'].includes(type) || !Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 30) {
      return {
        success: false,
        error: '请输入1～60字关键词，并使用有效的搜索条件'
      };
    }

    const searchKeyword = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (type === 'post') {
      // 搜索图片（按描述和标签）
      const result = await db.collection('posts')
        .where(_.and([{ deleted: _.neq(true) }, _.or([
          {
            caption: db.RegExp({
              regexp: searchKeyword,
              options: 'i'
            })
          },
          {
            tags: db.RegExp({
              regexp: searchKeyword,
              options: 'i'
            })
          }
        ])]))
        .orderBy('createTime', 'desc')
        .orderBy('_id', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize + 1)
        .get();

      // 获取发布者信息
      const posts = result.data.slice(0, pageSize);
      const openids = [...new Set(posts.map(img => img._openid))];
      
      if (openids.length > 0) {
        const usersResult = await db.collection('users')
          .where({
            _openid: _.in(openids)
          })
          .field({
            _openid: true,
            nickName: true,
            avatarUrl: true
          })
          .limit(100).get();
        
        const userMap = {};
        usersResult.data.forEach(user => {
          userMap[user._openid] = user;
        });

        posts.forEach(img => {
          const user = userMap[img._openid];
          if (user) {
            img.author = { nickName: user.nickName, avatarUrl: user.avatarUrl };
          }
        });
      }

      return {
        success: true,
        posts,
        hasMore: result.data.length > pageSize
      };
    } else if (type === 'user') {
      // 搜索用户（按昵称）
      const result = await db.collection('users')
        .where({
          nickName: db.RegExp({
            regexp: searchKeyword,
            options: 'i'
          })
        })
        .orderBy('followerCount', 'desc')
        .orderBy('_id', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize + 1)
        .get();

      // 检查当前用户是否已关注这些用户
      const users = result.data.slice(0, pageSize);
      const targetOpenIds = users.map(u => u._openid);
      
      if (targetOpenIds.length > 0) {
        const followsResult = await db.collection('follows')
          .where({
            _openid: openid,
            targetOpenid: _.in(targetOpenIds)
          })
          .limit(100).get();
        
        const followedIds = new Set(followsResult.data.map(f => f.targetOpenid));
        
        users.forEach(user => {
          user.isFollowed = followedIds.has(user._openid);
          user.isSelf = user._openid === openid;
        });
      }

      return {
        success: true,
        users,
        hasMore: result.data.length > pageSize
      };
    } else {
      const result = await db.collection('posts').aggregate()
        .match({ deleted: _.neq(true) })
        .unwind('$tags')
        .group({ _id: '$tags', count: $.sum(1) })
        .match({ _id: db.RegExp({ regexp: searchKeyword, options: 'i' }) })
        .sort({ count: -1, _id: 1 })
        .skip((page - 1) * pageSize).limit(pageSize + 1).end();
      return { success: true, tags: result.list.slice(0, pageSize).map(row => ({ name: row._id, count: row.count })), hasMore: result.list.length > pageSize };
    }
  } catch (err) {
    console.error('搜索失败', err);
    return {
      success: false,
      error: '搜索失败，请检查网络和云函数后重试'
    };
  }
};
