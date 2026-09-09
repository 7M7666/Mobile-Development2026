const { cloudEnv } = require('./config');
const api = require('./services/api');
App({
  globalData: { userInfo: null, cloudReady: false, needRefreshHome: false },
  onLaunch() {
    if (wx.cloud && cloudEnv) {
      wx.cloud.init({ env: cloudEnv, traceUser: true });
      this.globalData.cloudReady = true;
    }
  },
  async ensureLogin() {
    if (!this.globalData.cloudReady) throw new Error('云环境尚未配置，请先完成云开发部署');
    if (this.globalData.userInfo) return this.globalData.userInfo;
    if (!this.loginTask) {
      this.loginTask = api.request('login').then(result => {
        this.globalData.userInfo = result.userInfo;
        return result.userInfo;
      }).finally(() => { this.loginTask = null; });
    }
    return this.loginTask;
  }
});
