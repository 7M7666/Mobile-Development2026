const api = require('../../services/api');
Page({
  data: { images: [], caption: '', tags: [], tagInput: '', locationName: '中国海洋大学', publishing: false, submitted: false, progress: 0, error: '' },
  onShow() { if (this.getTabBar && this.getTabBar()) this.getTabBar().setData({ selected: 2 }); },
  chooseImage() {
    if (this.data.publishing || this.data.submitted || this.data.images.length >= 9) return;
    wx.chooseMedia({
      count: 9 - this.data.images.length, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'],
      success: res => this.setData({ images: this.data.images.concat(res.tempFiles.map(file => ({ path: file.tempFilePath, fileID: '' }))) }),
      fail: error => {
        if (/cancel/.test(error.errMsg || '')) return;
        console.error('选择照片失败', error);
        this.setData({ error: '未能选择照片，请检查相机、相册权限后重试。' });
      }
    });
  },
  deleteImage(e) {
    if (this.data.publishing || this.data.submitted) return;
    this.setData({ images: this.data.images.filter((_, i) => i !== Number(e.currentTarget.dataset.index)) });
  },
  previewImage(e) { wx.previewImage({ current: this.data.images[e.currentTarget.dataset.index].path, urls: this.data.images.map(file => file.path) }); },
  onInput(e) {
    if (this.data.publishing || this.data.submitted) return;
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },
  addTag() {
    if (this.data.publishing || this.data.submitted) return;
    const tag = this.data.tagInput.trim().replace(/^#+/, '');
    if (!tag) return;
    if (tag.length > 20 || this.data.tags.length >= 5) { wx.showToast({ title: '最多5个标签，每个不超过20字', icon: 'none' }); return; }
    if (!this.data.tags.includes(tag)) this.setData({ tags: this.data.tags.concat(tag) });
    this.setData({ tagInput: '' });
  },
  deleteTag(e) {
    if (!this.data.publishing && !this.data.submitted) this.setData({ tags: this.data.tags.filter((_, i) => i !== Number(e.currentTarget.dataset.index)) });
  },
  async publish() {
    if (this.data.publishing) return;
    if (!this.data.images.length) { wx.showToast({ title: '先选1～9张照片吧', icon: 'none' }); return; }
    if (this.data.tagInput.trim()) {
      this.addTag();
      if (this.data.tagInput.trim()) return;
    }
    this.setData({ publishing: true, error: '' });
    try {
      const user = await getApp().ensureLogin();
      if (!this.requestId) this.requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const files = this.data.images.map(file => ({ ...file }));
      for (let i = 0; i < files.length; i++) {
        if (!files[i].fileID) {
          const ext = (files[i].path.match(/\.(jpg|jpeg|png|webp)$/i) || ['', 'jpg'])[1];
          files[i].fileID = await api.upload(files[i].path, `moments/${user._id}/${this.requestId}/${i}.${ext}`, progress => this.setData({ progress: Math.floor((i + progress / 100) / files.length * 90) }));
          this.setData({ [`images[${i}].fileID`]: files[i].fileID });
        }
      }
      this.setData({ submitted: true, progress: 95 });
      await api.call('createPost', {
        requestId: this.requestId, images: files.map(file => file.fileID),
        caption: this.data.caption.trim(), tags: this.data.tags,
        location: { name: this.data.locationName.trim(), latitude: null, longitude: null }
      });
      this.requestId = null;
      this.setData({ images: [], caption: '', tags: [], tagInput: '', submitted: false, progress: 100 });
      getApp().globalData.needRefreshHome = true;
        getApp().globalData.needRefreshDiscover = true;
      wx.showToast({ title: '发布成功', icon: 'success' });
      wx.switchTab({ url: '/pages/home/home' });
    } catch (error) {
      const tip = api.message(error) + (this.data.submitted ? ' 发布结果尚未确认，请点重试确认；不会重复创建动态。' : '');
      this.setData({ error: tip });
    } finally { this.setData({ publishing: false }); }
  }
});
