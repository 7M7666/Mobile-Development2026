const api = require('../../services/api');
Page({
  data: { notifications: [], page: 0, hasMore: true, unreadCount: 0, loading: false, marking: false, error: '' },
  onLoad() { this.load(true); },
  onPullDownRefresh() { return this.load(true).finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { if (this.data.hasMore && !this.data.error) this.load(false); },
  retry() { this.load(this.data.page === 0); },
  async load(reset) {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      const page = reset ? 1 : this.data.page + 1;
      const res = await api.call('getNotifications', { page });
      const rows = res.notifications.map(n => ({ ...api.formatPost(n), actionText: { like:'赞了你的照片', comment:'评论了你的动态', follow:'关注了你' }[n.type] || '与你互动了' }));
      this.setData({ notifications: reset ? rows : this.data.notifications.concat(rows.filter(n => !this.data.notifications.some(old => old._id === n._id))), unreadCount: res.unreadCount, page, hasMore: res.hasMore });
    } catch (error) { this.setData({ error: api.message(error) }); }
    finally { this.setData({ loading: false }); }
  },
  async mark(ids) {
    for (let i = 0; i < ids.length; i += 30) {
      const batch = ids.slice(i, i + 30);
      await api.call('markNotificationsRead', { ids: batch });
      const changed = this.data.notifications.filter(n => batch.includes(n._id) && !n.isRead).length;
      this.setData({ notifications: this.data.notifications.map(n => batch.includes(n._id) ? { ...n, isRead: true } : n), unreadCount: Math.max(0, this.data.unreadCount - changed) });
    }
  },
  async markVisible() {
    if (this.data.marking) return;
    this.setData({ marking: true, error: '' });
    try { await this.mark(this.data.notifications.filter(n => !n.isRead).map(n => n._id)); }
    catch (error) { this.setData({ error: api.message(error) }); }
    finally { this.setData({ marking: false }); }
  },
  async openNotification(e) {
    if (this.data.marking) return;
    const item = this.data.notifications.find(n => n._id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({ marking: true });
    try { if (!item.isRead) await this.mark([item._id]); }
    catch (error) { this.setData({ error: api.message(error) }); }
    finally { this.setData({ marking: false }); }
    wx.navigateTo({ url: item.type === 'follow' ? `/pages/profile/profile?openid=${encodeURIComponent(item.senderOpenid)}` : `/pages/detail/detail?id=${encodeURIComponent(item.postId)}` });
  }
});
