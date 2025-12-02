// app.js
const config = require('config/index.js');

// 全局音乐管理器
let bgmCtx = null;
let victoryCtx = null;
let gameStartCtx = null; // 开始游戏音效
let gameQuitCtx = null; // 退出游戏音效
let shuffleCtx = null; // 洗牌音效
let currentDifficulty = 'default'; // 当前难度
let musicCallbacks = []; // 存储所有音乐状态变化的回调函数
let isMusicPlaying = false; // 内部播放状态跟踪

App({
  globalData: {
    openid: null,
    userInfo: null,
    needRefreshLeaderboard: false // 标志位：是否需要刷新排行榜
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

    // 初始化全局音乐
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
  switchDifficultyMusic(difficulty) {
    if (currentDifficulty === difficulty) return;

    currentDifficulty = difficulty;
    // 使用配置文件中的辅助函数获取音乐URL
    const musicUrl = config.getBgmUrl(difficulty);

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
