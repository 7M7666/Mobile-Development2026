Component({
  properties: { posts: { type: Array, value: [] } },
  data: { columns: [{ id: 'left', posts: [] }, { id: 'right', posts: [] }] },
  observers: { posts(posts) { this.setData({ columns: [{ id: 'left', posts: posts.filter((_,i) => i % 2 === 0) }, { id: 'right', posts: posts.filter((_,i) => i % 2 === 1) }] }); } },
  methods: {
    openPost(e) { wx.navigateTo({ url: `/pages/detail/detail?id=${encodeURIComponent(e.currentTarget.dataset.id)}` }); },
    openUser(e) { wx.navigateTo({ url: `/pages/profile/profile?openid=${encodeURIComponent(e.currentTarget.dataset.openid)}` }); }
  }
});
