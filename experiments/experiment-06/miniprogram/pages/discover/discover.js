// 改编自 yydscq6/wechat-image-community 的发现页。
const api = require('../../services/api');
Page({
  data: {
    hotTags: [], // 热门标签
    selectedTag: '', // 选中的标签
    posts: [], // 图片列表
    recommendedUsers: [], // 推荐用户
    sortBy: 'newest', // 排序方式：newest/hot
    loading: false,
    hasMore: true,
    page: 0,
    error: '', tagError: '', peopleError: '', peopleLoading: false, followingIds: [], followBusy: {},
    pageSize: 12
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setData({ selected: 1 });
    if (!this.started || getApp().globalData.needRefreshDiscover) {
      this.started = true;
      getApp().globalData.needRefreshDiscover = false;
      this.refreshData();
    }
  },
  onPullDownRefresh() { return this.refreshData().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.error) this.loadPosts(); },
  refreshData() { return Promise.all([this.loadHotTags(), this.loadPosts(true), this.loadRecommendedUsers()]); },
  openSearch() { wx.navigateTo({ url: '/pages/search/search' }); },
  retry() { this.loadPosts(this.data.page === 0); },

  // 加载热门标签
  async loadHotTags() {
    try {
      const result = await api.call('getPosts', { getHotTags: true });

      // 统计标签频率
      const tagCount = Object.create(null);
      (result.posts || []).forEach(img => {
        [...new Set(img.tags || [])].forEach(tag => {
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
      });

      // 转换为数组并排序
      const hotTags = Object.entries(tagCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      this.setData({ hotTags, tagError: '' });
    } catch (err) {
      this.setData({ tagError: api.message(err) });
    }
  },

  // 加载图片列表
  async loadPosts(reset = false) {
    if (this.data.loading && !reset) return;
    if (reset) {
      this.generation = (this.generation || 0) + 1;
      this.setData({ posts: [], page: 0, hasMore: true });
    }
    const generation = this.generation || 0;
    const page = this.data.page + 1;
    this.setData({ loading: true, error: '' });
    try {
      const result = await api.call('getPosts', { page, pageSize: this.data.pageSize, tag: this.data.selectedTag, mode: this.data.selectedTag ? 'tag' : 'forYou', sortBy: this.data.sortBy });
      if (generation !== (this.generation || 0)) return;
      this.setData({ posts: reset ? result.posts : this.data.posts.concat(result.posts.filter(p => !this.data.posts.some(old => old._id === p._id))), page, hasMore: result.hasMore });
    } catch (error) { if (generation === (this.generation || 0)) this.setData({ error: api.message(error) }); }
    finally { if (generation === (this.generation || 0)) this.setData({ loading: false }); }
  },

  // 加载推荐用户
  async loadRecommendedUsers() {
    const version = this.peopleVersion = (this.peopleVersion || 0) + 1;
    this.setData({ peopleLoading: true, peopleError: '' });
    try {
      const result = await api.call('getUserProfile', { getRecommended: true, pageSize: 5 });
      if (version === this.peopleVersion) this.setData({ recommendedUsers: result.users });
    } catch (error) { if (version === this.peopleVersion) this.setData({ peopleError: api.message(error) }); }
    finally { if (version === this.peopleVersion) this.setData({ peopleLoading: false }); }
  },

  // 选择标签
  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({
      selectedTag: this.data.selectedTag === tag ? '' : tag,
      posts: [],
      page: 0,
      hasMore: true
    });
    this.loadPosts(true);
  },

  // 切换排序
  onSortChange(e) {
    const sortBy = e.currentTarget.dataset.sort;
    if (this.data.sortBy === sortBy) return;

    this.setData({
      sortBy,
      posts: [],
      page: 0,
      hasMore: true
    });
    this.loadPosts(true);
  },

  // 关注用户
  async onFollowTap(e) {
    const openid = e.currentTarget.dataset.openid;
    if (this.data.peopleLoading || this.data.followingIds.includes(openid)) return;
    const user = this.data.recommendedUsers.find(u => u._openid === openid);
    if (!user) return;
    this.followIntents = this.followIntents || new Map();
    const following = this.followIntents.has(openid) ? this.followIntents.get(openid) : !user.isFollowed;
    this.followIntents.set(openid, following);
    this.setData({ followingIds: this.data.followingIds.concat(openid), [`followBusy.${openid}`]: true, peopleError: '' });
    try {
      const result = await api.call('toggleFollow', { targetOpenid: openid, following });
      this.followIntents.delete(openid);
      this.peopleVersion = (this.peopleVersion || 0) + 1;
      this.setData({ recommendedUsers: this.data.recommendedUsers.map(u => u._openid === openid ? { ...u, isFollowed: result.isFollowed, followerCount: result.followerCount } : u) });
      getApp().globalData.needRefreshHome = true;
      getApp().globalData.needRefreshDiscover = true;
    } catch (error) { this.setData({ peopleError: api.message(error) }); }
    finally { this.setData({ followingIds: this.data.followingIds.filter(id => id !== openid), [`followBusy.${openid}`]: false }); }
  },

  // 点击图片跳转详情
  onPostTap(e) {
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${encodeURIComponent(postId)}`
    });
  },

  // 点击用户跳转个人主页
  onUserTap(e) {
    const openid = e.currentTarget.dataset.openid;
    wx.navigateTo({
      url: `/pages/profile/profile?openid=${encodeURIComponent(openid)}`
    });
  }
});
