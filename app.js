// app.js
const config = require('config/index.js');

// 全局音乐管理器
let bgmCtx = null;
let victoryCtx = null;
let gameStartCtx = null;
let gameQuitCtx = null;
let shuffleCtx = null;
let currentDifficulty = 'default';
let musicCallbacks = [];
let isMusicPlaying = false;

App({
  globalData: {
    openid: null,
    needRefreshLeaderboard: false
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

    this.getOpenId();
    this.initGlobalMusic();
  },

  async getOpenId() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login' });
      this.globalData.openid = res.result.openid;
    } catch (err) {
      console.error('登录失败', err);
    }
  },

  initGlobalMusic() {
    const { AUDIO_CONFIG } = config;

    // 初始化背景音乐
    bgmCtx = wx.createInnerAudioContext();
    bgmCtx.src = AUDIO_CONFIG.BGM.DEFAULT;
    bgmCtx.loop = true;
    bgmCtx.volume = AUDIO_CONFIG.VOLUME.BGM;

    // 初始化音效
    victoryCtx = wx.createInnerAudioContext();
    victoryCtx.src = AUDIO_CONFIG.EFFECTS.VICTORY;
    victoryCtx.volume = AUDIO_CONFIG.VOLUME.VICTORY;

    gameStartCtx = wx.createInnerAudioContext();
    gameStartCtx.src = AUDIO_CONFIG.EFFECTS.GAME_START;
    gameStartCtx.volume = AUDIO_CONFIG.VOLUME.GAME_START;

    gameQuitCtx = wx.createInnerAudioContext();
    gameQuitCtx.src = AUDIO_CONFIG.EFFECTS.GAME_QUIT;
    gameQuitCtx.volume = AUDIO_CONFIG.VOLUME.GAME_QUIT;

    shuffleCtx = wx.createInnerAudioContext();
    shuffleCtx.src = AUDIO_CONFIG.EFFECTS.SHUFFLE;
    shuffleCtx.volume = AUDIO_CONFIG.VOLUME.SHUFFLE;

    // 检查用户设置并自动播放
    const settings = wx.getStorageSync('musicSettings') || {};
    isMusicPlaying = settings.isMusicPlaying !== false;

    if (isMusicPlaying) {
      setTimeout(() => bgmCtx.play(), 1000);
    }
  },

  getMusicStatus() {
    return { isPlaying: isMusicPlaying };
  },

  startBackgroundMusic() {
    if (bgmCtx && !isMusicPlaying) {
      bgmCtx.play();
      isMusicPlaying = true;
      this.notifyMusicStatusChange(true);
      wx.setStorageSync('musicSettings', { isMusicPlaying: true });
    }
  },

  stopBackgroundMusic() {
    if (bgmCtx && isMusicPlaying) {
      bgmCtx.pause();
      isMusicPlaying = false;
      this.notifyMusicStatusChange(false);
      wx.setStorageSync('musicSettings', { isMusicPlaying: false });
    }
  },

  toggleBackgroundMusic() {
    isMusicPlaying ? this.stopBackgroundMusic() : this.startBackgroundMusic();
  },

  playVictoryMusic() {
    victoryCtx && victoryCtx.play();
  },

  playGameStartSound() {
    gameStartCtx && gameStartCtx.play();
  },

  playGameQuitSound() {
    gameQuitCtx && gameQuitCtx.play();
  },

  playShuffleSound() {
    shuffleCtx && shuffleCtx.play();
  },

  switchDifficultyMusic(difficulty) {
    if (currentDifficulty === difficulty) return;
    currentDifficulty = difficulty;

    const musicUrl = config.getBgmUrl(difficulty);

    if (isMusicPlaying && bgmCtx) {
      bgmCtx.stop();
    }

    if (bgmCtx) {
      bgmCtx.src = musicUrl;
      if (isMusicPlaying) {
        setTimeout(() => bgmCtx.play(), 100);
      }
    }
  },

  registerMusicCallback(callback) {
    musicCallbacks.push(callback);
  },

  unregisterMusicCallback(callback) {
    const idx = musicCallbacks.indexOf(callback);
    if (idx > -1) musicCallbacks.splice(idx, 1);
  },

  notifyMusicStatusChange(isPlaying) {
    musicCallbacks.forEach(cb => cb && cb(isPlaying));
  }
});
