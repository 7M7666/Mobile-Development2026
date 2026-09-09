// 改编自 yydscq6/wechat-image-community 的搜索页，扩展标签结果。
const api = require('../../services/api');
Page({
  data: {
    keyword: '',
    searchedKeyword: '', tags: [], error: '', followError: '', followingIds: [], followBusy: {}, hasSearched: false, // 搜索关键词
    activeTab: 'post', // 当前tab：post/user/tag
    posts: [], // 图片搜索结果
    users: [], // 用户搜索结果
    loading: false,
    hasMore: true,
    page: 0,
    pageSize: 12
  },

  onLoad(options = {}) {
    if (options.tag) {
      this.setData({ keyword: options.tag, searchedKeyword: options.tag, exactTag: options.tag });
      this.search(true);
      return;
    }
    if (options.keyword) {
      this.setData({ keyword: options.keyword });
      this.onSearchConfirm();
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  // 搜索确认
  onSearchConfirm() {
    this.setData({ searchedKeyword: this.data.keyword.trim(), exactTag: '' });
    return this.search(true);
  },
  async search(reset = false) {
    if (this.data.loading && !reset) return;
    if (reset) {
      this.generation = (this.generation || 0) + 1;
      this.setData({ page: 0, hasMore: true, posts: [], users: [], tags: [], error: '', hasSearched: false });
    }
    const keyword = this.data.searchedKeyword;
    if (!keyword) { this.setData({ loading: false, hasMore: false }); return; }
    const generation = this.generation || 0, type = this.data.activeTab, page = this.data.page + 1;
    this.setData({ loading: true, error: '' });
    try {
      const result = this.data.exactTag && type === 'post'
        ? await api.call('getPosts', { mode: 'tag', tag: this.data.exactTag, page, pageSize: this.data.pageSize })
        : await api.call('searchContent', { keyword, type, page, pageSize: this.data.pageSize });
      if (generation !== (this.generation || 0)) return;
      const key = { post: 'posts', user: 'users', tag: 'tags' }[type];
      const id = type === 'tag' ? 'name' : '_id';
      const rows = result[key] || [];
      this.setData({ [key]: reset ? rows : this.data[key].concat(rows.filter(row => !this.data[key].some(old => old[id] === row[id]))), hasMore: result.hasMore, hasSearched: true, page });
    } catch (error) { if (generation === (this.generation || 0)) this.setData({ error: api.message(error) }); }
    finally { if (generation === (this.generation || 0)) this.setData({ loading: false }); }
  },
  retry() { this.search(this.data.page === 0); },
  onReachBottom() { if (this.data.hasMore && !this.data.loading && !this.data.error && this.data.hasSearched) this.search(); },
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (this.data.activeTab === tab) return;
    this.setData({ activeTab: tab, followError: '' });
    this.search(true);
  },
  onTagTap(e) { wx.navigateTo({ url: `/pages/search/search?tag=${encodeURIComponent(e.currentTarget.dataset.tag)}` }); },

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
  },

  // 关注用户
  async onFollowTap(e) {
    const openid = e.currentTarget.dataset.openid;
    const user = this.data.users.find(u => u._openid === openid);
    if (!user || user.isSelf || this.data.followingIds.includes(openid)) return;
    this.followIntents = this.followIntents || new Map();
    const following = this.followIntents.has(openid) ? this.followIntents.get(openid) : !user.isFollowed;
    this.followIntents.set(openid, following);
    this.setData({ followingIds: this.data.followingIds.concat(openid), [`followBusy.${openid}`]: true, followError: '' });
    try {
      const result = await api.call('toggleFollow', { targetOpenid: openid, following });
      this.followIntents.delete(openid);
      this.setData({ users: this.data.users.map(u => u._openid === openid ? { ...u, isFollowed: result.isFollowed, followerCount: result.followerCount } : u) });
      getApp().globalData.needRefreshHome = true;
      getApp().globalData.needRefreshDiscover = true;
    } catch (error) { this.setData({ followError: api.message(error) }); }
    finally { this.setData({ followingIds: this.data.followingIds.filter(id => id !== openid), [`followBusy.${openid}`]: false }); }
  }
});
