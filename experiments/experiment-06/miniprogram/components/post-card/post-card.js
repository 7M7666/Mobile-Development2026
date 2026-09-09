const api = require('../../services/api');
Component({
  properties: { post: Object, detail: Boolean },
  data: { liking: false, likeError: '' },
  methods: {
    openPost() { if (!this.data.detail) wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(this.data.post._id)}` }); },
    openProfile() { wx.navigateTo({ url: `/pages/profile/profile?openid=${encodeURIComponent(this.data.post._openid)}` }); },
    preview(e) { wx.previewImage({ current: this.data.post.images[e.currentTarget.dataset.index], urls: this.data.post.images }); },
    openTag(e) { wx.navigateTo({ url: `/pages/search/search?tag=${encodeURIComponent(e.currentTarget.dataset.tag)}` }); },
    comment() {
      if (this.data.detail) this.triggerEvent('commentfocus');
      else wx.navigateTo({ url: `/pages/detail/detail?id=${this.data.post._id}&comment=1` });
    },
    async like() {
      if (this.data.liking) return;
      const liked = this.pendingLike === undefined ? !this.data.post.isLiked : this.pendingLike;
      this.pendingLike = liked;
      this.setData({ liking: true, likeError: '' });
      try {
        const res = await api.call('toggleLike', { postId: this.data.post._id, liked });
        this.pendingLike = undefined;
        this.triggerEvent('likechange', { postId: this.data.post._id, isLiked: res.isLiked, likeCount: res.likeCount });
        getApp().globalData.needRefreshHome = true;
        getApp().globalData.needRefreshDiscover = true;
      } catch (error) { this.setData({ likeError: api.message(error) }); }
      finally { this.setData({ liking: false }); }
    }
  }
});
