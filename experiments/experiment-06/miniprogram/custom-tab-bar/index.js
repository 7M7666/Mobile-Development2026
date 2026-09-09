Component({
  data: { selected: 0, tabs: [
    { label: '首页', path: '/pages/home/home', icon: 'home' },
    { label: '发现', path: '/pages/discover/discover', icon: 'discover' },
    { label: '发布', path: '/pages/publish/publish', icon: 'publish' },
    { label: '我的', path: '/pages/mine/mine', icon: 'mine' }
  ] },
  lifetimes: { attached() { this.sync(); } },
  pageLifetimes: { show() { this.sync(); } },
  methods: {
    sync() {
      const pages = getCurrentPages();
      const page = pages[pages.length - 1];
      if (!page) return;
      const selected = this.data.tabs.findIndex(tab => tab.path === '/' + page.route);
      if (selected >= 0) this.setData({ selected });
    },
    select(e) {
      const index = Number(e.currentTarget.dataset.index);
      if (index === this.data.selected) return;
      wx.switchTab({ url: this.data.tabs[index].path, success: () => this.setData({ selected: index }) });
    }
  }
});
