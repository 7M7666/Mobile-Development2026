const api = require('../../services/api');
Page({
  data: { posts: [], page: 0, hasMore: true, loading: false, error: '', skippedCount: 0, mode: 'forYou', unreadCount: 0 },
  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setData({ selected: 0 });
    api.call('getNotifications', { pageSize: 1 }).then(res => this.setData({ unreadCount: res.unreadCount })).catch(() => {});
    if (!this.started || getApp().globalData.needRefreshHome) {
      this.started = true;
      getApp().globalData.needRefreshHome = false;
      this.loadPosts(true);
    }
  },
  onPullDownRefresh() { return this.loadPosts(true).finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.error) this.loadPosts(false); },
  retry() { return this.loadPosts(this.data.page === 0); },
  async loadPosts(reset = false) {
    if (this.data.loading) { if (reset) this.refreshPending = true; return; }
    this.setData({ loading: true, error: '' });
    try {
      const page = reset ? 1 : this.data.page + 1;
      const res = await api.call('getPosts', { page, pageSize: 12, mode: this.data.mode });
      if (!Array.isArray(res.posts)) throw new Error('动态服务返回格式不正确，请更新 getPosts 云函数后重试');
      const valid = post => post && typeof post._id === 'string' && post._id && Array.isArray(post.images) && post.images.length > 0 && post.images.every(file => typeof file === 'string' && file.trim());
      const invalid = res.posts.filter(post => !valid(post));
      if (invalid.length) console.error('getPosts 返回不完整记录（仅字段结构）', invalid.map(post => ({ fields: post && typeof post === 'object' ? Object.keys(post) : [], imagesType: post && Array.isArray(post.images) ? 'array' : typeof (post && post.images), imageCount: post && Array.isArray(post.images) ? post.images.length : null })));
      const rows = res.posts.filter(valid).map(api.formatPost);
      const posts = reset ? rows : this.data.posts.concat(rows.filter(p => !this.data.posts.some(old => old._id === p._id)));
      this.setData({ posts, page, hasMore: res.hasMore, skippedCount: (reset ? 0 : this.data.skippedCount) + invalid.length });
    } catch (error) { this.setData({ error: api.message(error) }); }
    finally {
      this.setData({ loading: false });
      if (this.refreshPending) { this.refreshPending = false; this.loadPosts(true); }
    }
  },
  changeMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.mode || this.data.loading) return;
    this.setData({ mode, posts: [], page: 0, hasMore: true, skippedCount: 0 });
    this.loadPosts(true);
  },
  onLikeChange(e) { this.setData({ posts: this.data.posts.map(p => p._id === e.detail.postId ? { ...p, ...e.detail } : p) }); },
  notifications() { wx.navigateTo({ url: '/pages/notifications/notifications' }); },
  publish() { wx.switchTab({ url: '/pages/publish/publish' }); },
  onShareAppMessage() { return { title: '海大一刻 收藏校园里的每一刻', path: '/pages/home/home' }; }
});
