// app.js
const config = require('config/index.js');
const resourceManager = require('utils/resourceManager.js');

// 全局音乐管理器
let bgmCtx = null;
let victoryCtx = null;
let gameStartCtx = null; // 开始游戏音效
let gameQuitCtx = null; // 退出游戏音效
let shuffleCtx = null; // 洗牌音效
let currentDifficulty = 'default'; // 当前难度
let musicCallbacks = []; // 存储所有音乐状态变化的回调函数
let isMusicPlaying = false; // 内部播放状态跟踪

// 资源预加载相关
let resourceUrls = null; // 存储预加载后的资源URL
let preloadPromise = null; // 预加载Promise

App({
  globalData: {
    openid: null,
    userInfo: null,
    needRefreshLeaderboard: false, // 标志位：是否需要刷新排行榜
    resourcesLoaded: false, // 资源是否加载完成
    gameImages: null // 预加载后的游戏图片URL列表
  },

  onLaunch: function () {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: config.CLOUD_CONFIG.ENV_ID,
        traceUser: true
      });
    }

    // 获取 OpenID (通过云函数)
    this.getOpenId();

    // 预加载游戏资源
    this.preloadResources();

    // 初始化全局音乐（会在预加载完成后自动使用云存储URL）
    this.initGlobalMusic();
  },

  // 获取 OpenID
  async getOpenId() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login'
      });
      console.log('登录成功', res);
      this.globalData.openid = res.result.openid;
    } catch (err) {
      console.error('登录失败', err);
    }
  },

  // 预加载游戏资源
  async preloadResources() {
    // 如果已经在加载中，返回现有的 Promise
    if (preloadPromise) {
      return preloadPromise;
    }

    preloadPromise = (async () => {
      try {
        console.log('开始预加载游戏资源...');
        
        // 使用资源管理器预加载
        resourceUrls = await resourceManager.preloadAllResources();
        
        // 保存游戏图片URL到全局
        this.globalData.gameImages = resourceUrls.gameImages;
        this.globalData.resourcesLoaded = true;
        
        console.log('游戏资源预加载完成', resourceUrls);
        
        // 更新音频上下文的URL（如果使用云存储）
        this.updateAudioUrls(resourceUrls.urlMap);
        
        return resourceUrls;
      } catch (err) {
        console.error('预加载资源失败:', err);
        // 即使失败也标记为完成，使用降级配置
        this.globalData.resourcesLoaded = true;
        this.globalData.gameImages = config.GAME_IMAGES;
        return null;
      }
    })();

    return preloadPromise;
  },

  // 获取预加载状态
  getPreloadStatus() {
    return resourceManager.getPreloadStatus();
  },

  // 注册预加载状态回调
  onPreloadStatusChange(callback) {
    resourceManager.onStatusChange(callback);
  },

  // 取消预加载状态回调
  offPreloadStatusChange(callback) {
    resourceManager.offStatusChange(callback);
  },

  // 更新音频上下文的URL（使用预加载的临时链接）
  updateAudioUrls(urlMap) {
    if (!urlMap) return;

    const { AUDIO_CONFIG } = config;

    // 更新背景音乐URL
    if (bgmCtx && urlMap[AUDIO_CONFIG.BGM.DEFAULT]) {
      bgmCtx.src = urlMap[AUDIO_CONFIG.BGM.DEFAULT];
    }

    // 更新胜利音乐URL
    if (victoryCtx && urlMap[AUDIO_CONFIG.EFFECTS.VICTORY]) {
      victoryCtx.src = urlMap[AUDIO_CONFIG.EFFECTS.VICTORY];
    }

    // 更新开始游戏音效URL
    if (gameStartCtx && urlMap[AUDIO_CONFIG.EFFECTS.GAME_START]) {
      gameStartCtx.src = urlMap[AUDIO_CONFIG.EFFECTS.GAME_START];
    }

    // 更新退出游戏音效URL
    if (gameQuitCtx && urlMap[AUDIO_CONFIG.EFFECTS.GAME_QUIT]) {
      gameQuitCtx.src = urlMap[AUDIO_CONFIG.EFFECTS.GAME_QUIT];
    }

    // 更新洗牌音效URL
    if (shuffleCtx && urlMap[AUDIO_CONFIG.EFFECTS.SHUFFLE]) {
      shuffleCtx.src = urlMap[AUDIO_CONFIG.EFFECTS.SHUFFLE];
    }
  },

  // 获取游戏图片URL列表（优先使用预加载的云存储URL）
  getGameImages() {
    if (this.globalData.gameImages && this.globalData.gameImages.length > 0) {
      return this.globalData.gameImages;
    }
    return config.GAME_IMAGES;
  },

  initGlobalMusic() {
    const { AUDIO_CONFIG } = config;

    // 初始化默认背景音乐（简单难度使用）
    if (!bgmCtx) {
      bgmCtx = wx.createInnerAudioContext();
      bgmCtx.src = AUDIO_CONFIG.BGM.DEFAULT;
      bgmCtx.loop = true;
      bgmCtx.volume = AUDIO_CONFIG.VOLUME.BGM;
    }

    // 初始化胜利音乐
    if (!victoryCtx) {
      victoryCtx = wx.createInnerAudioContext();
      victoryCtx.src = AUDIO_CONFIG.EFFECTS.VICTORY;
      victoryCtx.volume = AUDIO_CONFIG.VOLUME.VICTORY;
    }

    // 初始化开始游戏音效
    if (!gameStartCtx) {
      gameStartCtx = wx.createInnerAudioContext();
      gameStartCtx.src = AUDIO_CONFIG.EFFECTS.GAME_START;
      gameStartCtx.volume = AUDIO_CONFIG.VOLUME.GAME_START;
    }

    // 初始化退出游戏音效
    if (!gameQuitCtx) {
      gameQuitCtx = wx.createInnerAudioContext();
      gameQuitCtx.src = AUDIO_CONFIG.EFFECTS.GAME_QUIT;
      gameQuitCtx.volume = AUDIO_CONFIG.VOLUME.GAME_QUIT;
    }

    // 初始化洗牌音效
    if (!shuffleCtx) {
      shuffleCtx = wx.createInnerAudioContext();
      shuffleCtx.src = AUDIO_CONFIG.EFFECTS.SHUFFLE;
      shuffleCtx.volume = AUDIO_CONFIG.VOLUME.SHUFFLE;
    }

    // 检查用户设置并自动播放
    const settings = wx.getStorageSync('musicSettings') || {};
    const shouldPlay = settings.isMusicPlaying !== undefined ? settings.isMusicPlaying : true;
    isMusicPlaying = shouldPlay; // 设置内部状态

    if (shouldPlay) {
      // 延迟播放，确保页面加载完成
      setTimeout(() => {
        bgmCtx.play();
        isMusicPlaying = true;
      }, 1000);
    }
  },

  // 获取当前音乐播放状态
  getMusicStatus() {
    return {
      isPlaying: isMusicPlaying
    };
  },

  // 开始播放背景音乐
  startBackgroundMusic() {
    if (bgmCtx && !isMusicPlaying) {
      bgmCtx.play();
      isMusicPlaying = true;
      this.notifyMusicStatusChange(true);
      // 保存设置
      const settings = wx.getStorageSync('musicSettings') || {};
      settings.isMusicPlaying = true;
      wx.setStorageSync('musicSettings', settings);
    }
  },

  // 暂停背景音乐（而不是停止）
  stopBackgroundMusic() {
    if (bgmCtx && isMusicPlaying) {
      bgmCtx.pause();
      isMusicPlaying = false;
      this.notifyMusicStatusChange(false);
      // 保存设置
      const settings = wx.getStorageSync('musicSettings') || {};
      settings.isMusicPlaying = false;
      wx.setStorageSync('musicSettings', settings);
    }
  },

  // 切换背景音乐播放状态
  toggleBackgroundMusic() {
    if (isMusicPlaying) {
      this.stopBackgroundMusic();
    } else {
      this.startBackgroundMusic();
    }
  },

  // 播放胜利音乐
  playVictoryMusic() {
    if (victoryCtx) {
      victoryCtx.play();
    }
  },

  // 播放开始游戏音效
  playGameStartSound() {
    if (gameStartCtx) {
      gameStartCtx.play();
    }
  },

  // 播放退出游戏音效
  playGameQuitSound() {
    if (gameQuitCtx) {
      gameQuitCtx.play();
    }
  },

  // 播放洗牌音效
  playShuffleSound() {
    if (shuffleCtx) {
      shuffleCtx.play();
    }
  },

  // 切换难度背景音乐
  async switchDifficultyMusic(difficulty) {
    if (currentDifficulty === difficulty) return;

    currentDifficulty = difficulty;
    
    // 获取音乐云文件ID
    const cloudId = config.getBgmUrl(difficulty);
    let musicUrl = cloudId;
    
    // 获取临时链接
    if (cloudId && cloudId.startsWith('cloud://')) {
      try {
        const tempUrl = await resourceManager.getResourceUrl(cloudId);
        if (tempUrl) {
          musicUrl = tempUrl;
        }
      } catch (err) {
        console.warn('获取云存储音乐URL失败:', err);
      }
    }

    // 如果当前正在播放，先停止
    if (isMusicPlaying && bgmCtx) {
      bgmCtx.stop();
    }

    // 设置新的音乐源
    if (bgmCtx) {
      bgmCtx.src = musicUrl;

      // 如果原来在播放，重新开始播放
      if (isMusicPlaying) {
        setTimeout(() => {
          bgmCtx.play();
        }, 100);
      }
    }
  },

  // 注册音乐状态变化回调
  registerMusicCallback(callback) {
    musicCallbacks.push(callback);
  },

  // 取消注册音乐状态变化回调
  unregisterMusicCallback(callback) {
    const index = musicCallbacks.indexOf(callback);
    if (index > -1) {
      musicCallbacks.splice(index, 1);
    }
  },

  // 通知所有注册的回调函数音乐状态发生变化
  notifyMusicStatusChange(isPlaying) {
    musicCallbacks.forEach(callback => {
      if (typeof callback === 'function') {
        callback(isPlaying);
      }
    });
  }
})
