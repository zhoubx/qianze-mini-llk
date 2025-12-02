/**
 * 资源管理器
 * 负责云存储资源的URL获取和预加载
 */

const config = require('../config/index.js');

// 资源缓存（云文件ID -> 临时URL映射）
let resourceCache = {};
// 预加载状态
let preloadStatus = {
  images: false,
  audio: false,
  loaded: false,
  progress: 0,
  total: 0
};
// 状态变化回调
let statusCallbacks = [];

/**
 * 批量获取云文件临时URL
 */
async function getTempFileURLs(fileIds) {
  if (!fileIds || fileIds.length === 0) {
    return {};
  }

  // 过滤出云文件ID
  const cloudFileIds = fileIds.filter(id => id && id.startsWith('cloud://'));
  const uncachedIds = cloudFileIds.filter(id => !resourceCache[id]);

  // 如果都已缓存，直接返回
  if (uncachedIds.length === 0) {
    const result = {};
    fileIds.forEach(id => {
      result[id] = resourceCache[id] || id;
    });
    return result;
  }

  try {
    // 通过云函数获取临时链接
    const res = await wx.cloud.callFunction({
      name: 'getTempFileURL',
      data: { fileList: uncachedIds }
    });

    if (res.result && res.result.success) {
      res.result.fileList.forEach(file => {
        if (file.status === 0 && file.tempFileURL) {
          resourceCache[file.fileID] = file.tempFileURL;
        }
      });
    }
  } catch (err) {
    console.error('获取云文件临时链接失败:', err);
    // 失败时尝试客户端API
    try {
      const clientRes = await wx.cloud.getTempFileURL({
        fileList: uncachedIds
      });
      clientRes.fileList.forEach(file => {
        if (file.status === 0 && file.tempFileURL) {
          resourceCache[file.fileID] = file.tempFileURL;
        }
      });
    } catch (clientErr) {
      console.error('客户端获取临时链接也失败:', clientErr);
    }
  }

  const result = {};
  fileIds.forEach(id => {
    result[id] = resourceCache[id] || id;
  });
  return result;
}

/**
 * 获取单个资源的临时URL
 */
async function getResourceUrl(fileId) {
  if (!fileId) return '';
  if (!fileId.startsWith('cloud://')) return fileId;
  if (resourceCache[fileId]) return resourceCache[fileId];

  const urls = await getTempFileURLs([fileId]);
  return urls[fileId] || fileId;
}

/**
 * 预加载图片
 */
function preloadImages(imageUrls) {
  return new Promise((resolve) => {
    if (!imageUrls || imageUrls.length === 0) {
      resolve();
      return;
    }

    let loaded = 0;
    const total = imageUrls.length;

    imageUrls.forEach((url) => {
      wx.getImageInfo({
        src: url,
        success: () => {
          loaded++;
          updateProgress(loaded, total, 'images');
          if (loaded >= total) resolve();
        },
        fail: () => {
          loaded++;
          updateProgress(loaded, total, 'images');
          if (loaded >= total) resolve();
        }
      });
    });

    // 超时保护
    setTimeout(() => {
      if (loaded < total) resolve();
    }, 15000);
  });
}

/**
 * 预加载音频
 */
function preloadAudio(audioUrls) {
  return new Promise((resolve) => {
    if (!audioUrls || audioUrls.length === 0) {
      resolve();
      return;
    }

    let loaded = 0;
    const total = audioUrls.length;
    const contexts = [];

    audioUrls.forEach((url) => {
      const ctx = wx.createInnerAudioContext();
      ctx.src = url;
      contexts.push(ctx);

      ctx.onCanplay(() => {
        loaded++;
        updateProgress(loaded, total, 'audio');
        ctx.destroy();
        if (loaded >= total) resolve();
      });

      ctx.onError(() => {
        loaded++;
        updateProgress(loaded, total, 'audio');
        ctx.destroy();
        if (loaded >= total) resolve();
      });
    });

    // 超时保护
    setTimeout(() => {
      if (loaded < total) {
        contexts.forEach(ctx => { try { ctx.destroy(); } catch (e) {} });
        resolve();
      }
    }, 15000);
  });
}

/**
 * 更新加载进度
 */
function updateProgress(loaded, total, type) {
  preloadStatus[type + 'Loaded'] = loaded;
  preloadStatus[type + 'Total'] = total;
  
  const imgLoaded = preloadStatus.imagesLoaded || 0;
  const imgTotal = preloadStatus.imagesTotal || 0;
  const audioLoaded = preloadStatus.audioLoaded || 0;
  const audioTotal = preloadStatus.audioTotal || 0;
  
  preloadStatus.progress = imgLoaded + audioLoaded;
  preloadStatus.total = imgTotal + audioTotal;
  
  notifyStatusChange();
}

/**
 * 预加载所有游戏资源
 * 注意：图片使用 image 组件可直接支持 cloud:// 协议，无需预加载
 * 主要预加载音频资源（需要临时链接）
 */
async function preloadAllResources() {
  console.log('开始预加载游戏资源...');
  
  preloadStatus.loaded = false;
  preloadStatus.progress = 0;
  notifyStatusChange();

  try {
    // 收集音频云文件ID
    const audioFileIds = [];
    Object.values(config.AUDIO_CONFIG.BGM).forEach(id => audioFileIds.push(id));
    Object.values(config.AUDIO_CONFIG.EFFECTS).forEach(id => audioFileIds.push(id));

    // 批量获取音频临时URL
    const urlMap = await getTempFileURLs(audioFileIds);

    // 构建音频URL列表
    let audioUrls = [];
    Object.values(config.AUDIO_CONFIG.BGM).forEach(id => audioUrls.push(urlMap[id] || id));
    Object.values(config.AUDIO_CONFIG.EFFECTS).forEach(id => audioUrls.push(urlMap[id] || id));
    audioUrls = [...new Set(audioUrls)];

    // 设置总数（图片使用 image 组件自动加载，不计入）
    preloadStatus.imagesTotal = 0;
    preloadStatus.audioTotal = audioUrls.length;
    preloadStatus.total = audioUrls.length;
    preloadStatus.imagesLoaded = 0;
    preloadStatus.audioLoaded = 0;
    preloadStatus.progress = 0;
    notifyStatusChange();

    // 预加载音频
    await preloadAudio(audioUrls);

    preloadStatus.images = true;
    preloadStatus.audio = true;
    preloadStatus.loaded = true;
    notifyStatusChange();

    console.log('游戏资源预加载完成');
    
    return {
      gameImages: config.GAME_IMAGES, // 图片直接使用 cloud:// 协议
      audioUrls: audioUrls,
      urlMap: urlMap
    };

  } catch (err) {
    console.error('资源预加载失败:', err);
    preloadStatus.loaded = true;
    notifyStatusChange();
    throw err;
  }
}

function getPreloadStatus() {
  return { ...preloadStatus };
}

function onStatusChange(callback) {
  if (typeof callback === 'function') {
    statusCallbacks.push(callback);
  }
}

function offStatusChange(callback) {
  const index = statusCallbacks.indexOf(callback);
  if (index > -1) {
    statusCallbacks.splice(index, 1);
  }
}

function notifyStatusChange() {
  const status = getPreloadStatus();
  statusCallbacks.forEach(cb => {
    try { cb(status); } catch (e) {}
  });
}

function clearCache() {
  resourceCache = {};
  preloadStatus = { images: false, audio: false, loaded: false, progress: 0, total: 0 };
}

module.exports = {
  getTempFileURLs,
  getResourceUrl,
  preloadImages,
  preloadAudio,
  preloadAllResources,
  getPreloadStatus,
  onStatusChange,
  offStatusChange,
  clearCache,
  getCache: () => ({ ...resourceCache })
};
