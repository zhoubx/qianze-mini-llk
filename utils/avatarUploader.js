// utils/avatarUploader.js
// 统一处理头像上传与地址规范化逻辑
const Bmob = require('./Bmob-2.6.3.min.js');

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
 * 上传头像到 Bmob 文件存储（如有需要）
 * @param {string} avatarUrl chooseAvatar 返回的地址或已有远程地址
 * @returns {Promise<string>} 可被他人访问的远程 URL
 */
async function uploadAvatarIfNeeded(avatarUrl) {
  if (!avatarUrl) return '';
  
  // 如果不是临时路径（已经是 http/https 的远程路径，且不是 tmp），直接返回
  if (!isTempAvatarUrl(avatarUrl)) {
    return avatarUrl;
  }

  const uploadTask = async () => {
    try {
      console.log('开始上传头像:', avatarUrl);
      
      // 1. 获取文件扩展名
      let ext = 'jpg';
      const match = avatarUrl.match(/\.([a-zA-Z0-9]+)$/);
      if (match) {
        ext = match[1];
      }
      
      const fileName = `avatar_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
      
      // 2. 创建 Bmob 文件对象
      // 针对 wx.uploadFile 的兼容性处理
      // 如果是 Bmob v2.6.x，Bmob.File 构造函数在小程序环境下会自动调用上传逻辑，
      // 但部分版本可能存在路径解析问题或需要特殊配置。
      // 尝试直接调用 Bmob.File(fileName, file) 其中 file 为路径字符串（非数组）
      // 某些 Bmob 版本将数组识别为批量上传，单个文件直接传字符串路径即可。
      const file = Bmob.File(fileName, avatarUrl);
      
      const result = await file.save();
  
      console.log('头像上传结果:', result);
  
      // 解析返回结果
      if (Array.isArray(result) && result.length > 0 && result[0].url) {
        return result[0].url;
      } else if (result && result.url) {
        return result.url;
      } else {
        try {
          // 尝试解析 JSON 字符串
          const json = typeof result === 'string' ? JSON.parse(result) : result;
          if (json && json.url) return json.url;
          // 某些情况可能是数组字符串
          if (Array.isArray(json) && json.length > 0 && json[0].url) return json[0].url;
        } catch (e) {
          // ignore
        }
      }
      
      // 如果没拿到 URL，视为上传失败，返回原路径
      console.warn('Bmob 未返回有效 URL，使用原路径');
      return avatarUrl;
  
    } catch (err) {
      console.error('上传逻辑出错:', err);
      throw err; 
    }
  };

  // 3. 增加超时控制 (5秒)
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
