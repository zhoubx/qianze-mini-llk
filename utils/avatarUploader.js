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
  
  let targetId = avatarUrl;

  // 1. 如果是临时路径，先执行上传
  if (isTempAvatarUrl(avatarUrl)) {
    const uploadTask = async () => {
      try {
        console.log('开始上传头像到云存储:', avatarUrl);
        
        // 获取文件扩展名
        let ext = 'jpg';
        const match = avatarUrl.match(/\.([a-zA-Z0-9]+)$/);
        if (match) {
          ext = match[1];
        }
        
        // 生成云存储路径
        const cloudPath = `avatars/avatar_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
        
        // 使用云存储上传
        const res = await wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: avatarUrl
        });

        console.log('头像上传成功:', res.fileID);
        return res.fileID;

      } catch (err) {
        console.error('上传逻辑出错:', err);
        throw err;
      }
    };

    // 增加超时控制 (5秒)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Upload timeout'));
      }, 5000);
    });

    try {
      targetId = await Promise.race([uploadTask(), timeoutPromise]);
    } catch (err) {
      console.error('头像上传失败或超时，降级使用临时路径:', err);
      return avatarUrl;
    }
  }

  // 2. 此时 targetId 可能是 cloud:// (刚上传或传入的) 或 https:// (已有)
  // 统一尝试将 cloud:// 转换为 https://
  if (targetId && typeof targetId === 'string' && targetId.startsWith('cloud://')) {
    try {
      console.log('正在将 cloudID 转换为 https 链接:', targetId);
      const tempRes = await wx.cloud.getTempFileURL({
        fileList: [targetId]
      });
      
      if (tempRes.fileList && tempRes.fileList.length > 0) {
        const fileInfo = tempRes.fileList[0];
        if (fileInfo.status === 0 && fileInfo.tempFileURL) {
          console.log('转换成功:', fileInfo.tempFileURL);
          return fileInfo.tempFileURL;
        }
      }
    } catch (err) {
      console.warn('转换 https 链接失败，保留 cloudID:', err);
    }
  }

  return targetId;
}

module.exports = {
  uploadAvatarIfNeeded,
  isTempAvatarUrl
};
