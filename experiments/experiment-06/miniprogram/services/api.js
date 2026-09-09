async function call(name, data = {}) {
  await getApp().ensureLogin();
  return request(name, data);
}
async function request(name, data = {}) {
  try {
    const { result } = await wx.cloud.callFunction({ name, data });
    if (!result || !result.success) throw new Error((result && result.error) || '请求失败，请重试');
    return result;
  } catch (error) {
    error.cloudFunction = name;
    throw error;
  }
}
function message(error) {
  console.error(error);
  const raw = error.message || error.errMsg || '';
  if (error.errCode === -501000 || /FUNCTION_NOT_FOUND|FunctionName parameter could not be found/.test(raw)) {
    const label = { login: '登录', getPosts: '动态列表', createPost: '发布', getPostDetail: '动态详情', getUserProfile: '个人主页' }[error.cloudFunction] || '相关';
    return `${label}服务尚未部署到当前云环境，请完成云函数部署后重试。`;
  }
  if (/[\u4e00-\u9fff]/.test(raw) && raw.length <= 160 && !/errCode|errMsg|https?:|cloud\./.test(raw)) return raw;
  return '连接失败，请检查网络与云服务后重试。';
}
function formatPost(post) {
  const date = new Date(post.createTime);
  const timeText = Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return { ...post, timeText };
}
function upload(filePath, cloudPath, onProgress) {
  return new Promise((resolve, reject) => {
    const task = wx.cloud.uploadFile({ filePath, cloudPath, success: res => resolve(res.fileID), fail: reject });
    if (onProgress && task.onProgressUpdate) task.onProgressUpdate(res => onProgress(res.progress));
  });
}
module.exports = { call, request, message, formatPost, upload };
