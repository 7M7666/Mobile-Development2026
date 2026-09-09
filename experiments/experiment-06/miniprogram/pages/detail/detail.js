const api = require('../../services/api');
Page({
  data: { post: null, loading: false, saving: false, error: '', comments: [], commentPage: 0, hasMoreComments: true, commentsLoading: false, commentError: '', commentText: '', sending: false, commentPending: false, commentFocus: false },
  onLoad(options) { this.postId = options.id || ''; this.setData({ commentFocus: options.comment === '1' }); this.loadDetail(); this.loadComments(true); },
  async loadDetail() {
    if (this.data.loading) return;
    if (!this.postId) { this.setData({ error: '动态链接不完整，请返回首页浏览' }); return; }
    this.setData({ loading: true, error: '' });
    try {
      const res = await api.call('getPostDetail', { postId: this.postId, countView: !this.viewCounted });
      this.viewCounted = true;
      this.setData({ post: api.formatPost(res.post) });
      wx.showShareMenu({ menus: ['shareAppMessage'] });
    } catch (error) { this.setData({ error: api.message(error) }); }
    finally { this.setData({ loading: false }); }
  },
  async deletePost() {
    if (!this.data.post || !this.data.post.isOwner || this.data.deleting) return;
    const result = await wx.showModal({ title: '删除这条动态？', content: '删除后无法恢复，相关点赞和评论也会移除。', confirmText: '删除', confirmColor: '#C44848' });
    if (!result.confirm) return;
    this.setData({ deleting: true, error: '' });
    try {
      await api.call('deletePost', { postId: this.postId });
      getApp().globalData.needRefreshHome = true;
      getApp().globalData.needRefreshDiscover = true;
      this.setData({ post: null, comments: [] });
      wx.showToast({ title: '动态已删除', icon: 'success' });
      wx.navigateBack({ fail: () => this.goHome() });
    } catch (error) { this.setData({ error: api.message(error) }); }
    finally { this.setData({ deleting: false }); }
  },
  onReachBottom() { if (this.data.hasMoreComments && !this.data.commentError) this.loadComments(false); },
  onLikeChange(e) { this.setData({ post: { ...this.data.post, ...e.detail } }); },
  focusComment() { this.setData({ commentFocus: true }); wx.pageScrollTo({ selector: '#comment-compose', duration: 250 }); },
  inputComment(e) { if (!this.data.commentPending) this.setData({ commentText: e.detail.value }); },
  openCommentUser(e) { wx.navigateTo({ url: `/pages/profile/profile?openid=${encodeURIComponent(e.currentTarget.dataset.openid)}` }); },
  retryComments() { this.loadComments(this.data.commentPage === 0); },
  async loadComments(reset) {
    if (this.data.commentsLoading) { if (reset) this.refreshCommentsPending = true; return; }
    if (!this.postId) return;
    this.setData({ commentsLoading: true, commentError: '' });
    try {
      const page = reset ? 1 : this.data.commentPage + 1;
      const res = await api.call('getComments', { postId: this.postId, page });
      const rows = res.comments.map(api.formatPost);
      this.setData({ comments: reset ? rows : this.data.comments.concat(rows.filter(c => !this.data.comments.some(old => old._id === c._id))), commentPage: page, hasMoreComments: res.hasMore });
    } catch (error) { this.setData({ commentError: api.message(error) }); }
    finally {
      this.setData({ commentsLoading: false });
      if (this.refreshCommentsPending) { this.refreshCommentsPending = false; this.loadComments(true); }
    }
  },
  async sendComment() {
    if (this.data.sending || !this.data.commentText.trim()) return;
    if (!this.commentRequestId) this.commentRequestId = `${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
    this.setData({ sending: true, commentPending: true, commentError: '' });
    try {
      await api.call('addComment', { postId: this.postId, content: this.data.commentText.trim(), requestId: this.commentRequestId });
      this.commentRequestId = null;
      this.setData({ commentText: '', commentPending: false, commentFocus: false });
      getApp().globalData.needRefreshHome = true;
      await this.loadDetail();
      await this.loadComments(true);
    } catch (error) { this.setData({ commentError: api.message(error) }); }
    finally { this.setData({ sending: false }); }
  },
  preview() { wx.previewImage({ current: this.data.post.images[0], urls: this.data.post.images }); },
  chooseSave() {
    if (!this.data.post || this.data.saving) return;
    const images = this.data.post.images;
    if (images.length === 1) { this.saveImage(0); return; }
    // ActionSheet 最多6项；用图片选择面板覆盖9图场景。
    this.setData({ showSavePicker: true });
  },
  closeSave() { this.setData({ showSavePicker: false }); },
  saveSelected(e) { this.closeSave(); this.saveImage(Number(e.currentTarget.dataset.index)); },
  async saveImage(index) {
    this.setData({ saving: true });
    try {
      const { tempFilePath } = await wx.cloud.downloadFile({ fileID: this.data.post.images[index] });
      await wx.saveImageToPhotosAlbum({ filePath: tempFilePath });
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (error) {
      const settings = await wx.getSetting().catch(() => null);
      if (settings && settings.authSetting['scope.writePhotosAlbum'] === false) {
        wx.showModal({ title: '允许保存到相册', content: '请在设置中打开相册权限，再重新保存照片。', confirmText: '打开设置', success: res => { if (res.confirm) wx.openSetting({}); } });
      } else { wx.showToast({ title: '保存未完成，请重试', icon: 'none' }); console.error(error); }
    } finally { this.setData({ saving: false }); }
  },
  goHome() { wx.switchTab({ url: '/pages/home/home' }); },
  onShareAppMessage() {
    return { title: this.data.post ? (this.data.post.caption || '海大一刻 校园影像') : '海大一刻', path: `/pages/detail/detail?id=${encodeURIComponent(this.postId)}` };
  }
});
