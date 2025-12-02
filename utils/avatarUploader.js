// utils/avatarUploader.js
// 统一处理头像上传与地址规范化逻辑
// 使用微信云存储替代 Bmob 文件存储

// 判定 chooseAvatar 返回的临时路径前缀
const TEMP_URL_PATTERNS = [
  /^wxfile:\/\//i,
  /^https?:\/\/tmp\//i,
  /^http:\/\/tmp\//i
];

/**
 * 判断头像地址是否为临时本地路径
 * @param {string} url
 * @returns {boolean}
 */
function isTempAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return TEMP_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * 上传头像到云存储（如有需要）
 * @param {string} avatarUrl chooseAvatar 返回的地址或已有远程地址
 * @returns {Promise<string>} 可被他人访问的云文件 ID 或原始 URL
 */
async function uploadAvatarIfNeeded(avatarUrl) {
  if (!avatarUrl) return '';
  
  // 如果不是临时路径（已经是 http/https 的远程路径，或者是 cloud:// 开头的云文件），直接返回
  if (!isTempAvatarUrl(avatarUrl)) {
    return avatarUrl;
  }

  const uploadTask = async () => {
    try {
      console.log('开始上传头像到云存储:', avatarUrl);
      
      // 1. 获取文件扩展名
      let ext = 'jpg';
      const match = avatarUrl.match(/\.([a-zA-Z0-9]+)$/);
      if (match) {
        ext = match[1];
      }
      
      // 2. 生成云存储路径
      const cloudPath = `avatars/avatar_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
      
      // 3. 使用云存储上传
      const res = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl
      });

      console.log('头像上传成功:', res.fileID);
      
      // 返回云文件 ID (可直接用于 <image> 组件展示)
      return res.fileID;

    } catch (err) {
      console.error('上传逻辑出错:', err);
      throw err;
    }
  };

  // 增加超时控制 (5秒)
  // 防止上传卡死导致用户无法提交
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Upload timeout'));
    }, 5000);
  });

  try {
    return await Promise.race([uploadTask(), timeoutPromise]);
  } catch (err) {
    console.error('头像上传失败或超时，降级使用临时路径:', err);
    // 即使失败，也返回原路径，保证流程能走下去
    return avatarUrl;
  }
}

module.exports = {
  uploadAvatarIfNeeded,
  isTempAvatarUrl
};
