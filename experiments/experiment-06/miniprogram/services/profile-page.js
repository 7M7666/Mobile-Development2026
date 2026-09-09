const api = require('./api');
module.exports = function profilePage(isMine) {
  return {
    data: { user: null, posts: [], loading: false, hasMore: true, page: 0, error: '', tab: 'posts', isSelf: false, isFollowed: false, following: false, unreadCount: 0, editing: false, draft: {}, saving: false, uploading: false, editError: '' },
    onLoad(options) { this.targetOpenid = isMine ? '' : options.openid; },
    onShow() {
      if (isMine && this.getTabBar && this.getTabBar()) this.getTabBar().setData({ selected: 3 });
      this.loadProfile(true);
    },
    onPullDownRefresh() { return this.loadProfile(true).finally(() => wx.stopPullDownRefresh()); },
    onReachBottom() { if (this.data.hasMore && !this.data.error) this.loadProfile(false); },
    retry() { this.loadProfile(this.data.page === 0); },
    changeTab(e) {
      const tab = e.currentTarget.dataset.tab;
      if (this.data.loading || tab === this.data.tab) return;
      this.setData({ tab, posts: [], page: 0 }); this.loadProfile(true);
    },
    async loadProfile(reset) {
      if (this.data.loading) return;
      if (!isMine && !this.targetOpenid) { this.setData({ error: '用户链接不完整' }); return; }
      const version = this.profileVersion = (this.profileVersion || 0) + 1;
      this.setData({ loading: true, error: '' });
      try {
        const page = reset ? 1 : this.data.page + 1;
        const res = await api.call('getUserProfile', { targetOpenid: this.targetOpenid, page, pageSize: 18, tab: this.data.tab });
        if (version !== this.profileVersion) return;
        const posts = reset ? res.posts : this.data.posts.concat(res.posts.filter(p => !this.data.posts.some(old => old._id === p._id)));
        this.setData({ user: res.userInfo, posts, page, hasMore: res.hasMore, isSelf: res.isSelf, isFollowed: res.isFollowed, unreadCount: res.unreadCount });
        if (res.isSelf) getApp().globalData.userInfo = res.userInfo;
      } catch (error) { this.setData({ error: api.message(error) }); }
      finally { this.setData({ loading: false }); }
    },
    async follow() {
      if (this.data.following) return;
      const following = this.pendingFollow === undefined ? !this.data.isFollowed : this.pendingFollow;
      this.pendingFollow = following;
      this.setData({ following: true, error: '' });
      try {
        const res = await api.call('toggleFollow', { targetOpenid: this.data.user._openid, following });
        this.pendingFollow = undefined;
        this.setData({ isFollowed: res.isFollowed, 'user.followerCount': res.followerCount });
        getApp().globalData.needRefreshHome = true;
        getApp().globalData.needRefreshDiscover = true;
      } catch (error) { this.setData({ error: api.message(error) }); }
      finally { this.setData({ following: false }); }
    },
    async deleteOwnPost(e) {
      if (!isMine || !this.data.isSelf || this.data.tab !== 'posts' || this.data.deletingId || this.data.loading) return;
      const postId = e.currentTarget.dataset.id;
      if (!this.data.posts.some(post => post._id === postId)) return;
      this.setData({ deletingId: postId, error: '' });
      try {
        const result = await wx.showModal({ title: '删除这条动态？', content: '删除后无法恢复，相关点赞和评论也会移除。', confirmText: '删除', confirmColor: '#C44848' });
        if (!result.confirm) return;
        await api.call('deletePost', { postId });
        getApp().globalData.needRefreshHome = true;
        getApp().globalData.needRefreshDiscover = true;
        this.setData({ posts: this.data.posts.filter(post => post._id !== postId) });
        wx.showToast({ title: '动态已删除', icon: 'success' });
        await this.loadProfile(true);
      } catch (error) { this.setData({ error: api.message(error) }); }
      finally { this.setData({ deletingId: '' }); }
    },
    openPost(e) { wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(e.currentTarget.dataset.id)}` }); },
    openProfile() { wx.navigateTo({ url: `/pages/profile/profile?openid=${encodeURIComponent(this.data.user._openid)}` }); },
    notifications() { wx.navigateTo({ url: '/pages/notifications/notifications' }); },
    editProfile() {
      if (!this.data.isSelf) return;
      const { nickName, bio, avatarUrl, coverUrl } = this.data.user;
      this.setData({ editing: true, draft: { nickName: nickName || '', bio: bio || '', avatarUrl: avatarUrl || '', coverUrl: coverUrl || '' }, editError: '' });
    },
    closeEditor() { if (!this.data.saving && !this.data.uploading) this.setData({ editing: false }); },
    editInput(e) { if (!this.data.saving) this.setData({ [`draft.${e.currentTarget.dataset.field}`]: e.detail.value }); },
    chooseAvatar(e) { this.uploadProfileImage('avatarUrl', e.detail.avatarUrl); },
    chooseCover() {
      if (this.data.uploading || this.data.saving) return;
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album','camera'], success: res => this.uploadProfileImage('coverUrl', res.tempFiles[0].tempFilePath), fail: error => { if (!/cancel/.test(error.errMsg || '')) this.setData({ editError: '封面选择失败，请重试' }); } });
    },
    async uploadProfileImage(field, path) {
      if (this.data.uploading || this.data.saving) return;
      this.setData({ uploading: true, editError: '' });
      try {
        const user = await getApp().ensureLogin();
        const ext = (path.match(/\.(jpg|jpeg|png|webp)$/i) || ['', 'jpg'])[1];
        const fileID = await api.upload(path, `profiles/${user._id}/${field}-${Date.now()}-${Math.random().toString(36).slice(2,10)}.${ext}`);
        this.setData({ [`draft.${field}`]: fileID });
      } catch (error) { this.setData({ editError: api.message(error) }); }
      finally { this.setData({ uploading: false }); }
    },
    async saveProfile(e) {
      if (this.data.saving || this.data.uploading) return;
      const values = e && e.detail && e.detail.value;
      const draft = { ...this.data.draft, ...(values || {}) };
      this.setData({ draft });
      if (!draft.nickName.trim()) { this.setData({ editError: '请填写昵称' }); return; }
      this.setData({ saving: true, editError: '' });
      try {
        const res = await api.call('getUserProfile', { action: 'update', ...draft });
        if (res.updated !== true) throw new Error('资料服务版本过旧，请重新部署 getUserProfile 云函数后保存');
        const saved = res.userInfo;
        if (!saved || saved.nickName !== draft.nickName.trim() || saved.bio !== draft.bio.trim() || saved.avatarUrl !== draft.avatarUrl || saved.coverUrl !== draft.coverUrl) throw new Error('资料尚未保存一致，请重试');
        this.profileVersion = (this.profileVersion || 0) + 1;
        getApp().globalData.userInfo = res.userInfo;
        getApp().globalData.needRefreshHome = true;
        getApp().globalData.needRefreshDiscover = true;
        this.setData({ user: res.userInfo, editing: false });
        wx.showToast({ title: '资料已保存', icon: 'success' });
      } catch (error) { this.setData({ editError: api.message(error) }); }
      finally { this.setData({ saving: false }); }
    }
  };
};
