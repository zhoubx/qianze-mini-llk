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
    needRefreshLeaderboard: false,
    inviteFrom: null  // 分享邀请来源（分享人的openid）
  },

  onLaunch: function (options) {

    // 检查新版本
    this.checkUpdate();

    // 获取启动场景值
    const launchOptions = wx.getLaunchOptionsSync();
    const scene = launchOptions.scene;
    this.globalData.isSinglePage = (scene === 1154); // 1154 是朋友圈单页模式

    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: config.CLOUD_CONFIG.ENV_ID,
        traceUser: true
      });
    }

    // 解析启动参数中的邀请来源
    if (options && options.query && options.query.inviteFrom) {
      this.globalData.inviteFrom = options.query.inviteFrom;
      console.log('检测到邀请来源:', options.query.inviteFrom);
    }

    // 单页模式下无法获取登录态，跳过登录
    if (!this.globalData.isSinglePage) {
      this.getOpenId();
    } else {
      console.log('处于朋友圈单页模式，跳过登录流程');
    }

    this.initGlobalMusic();
  },

  onShow: function (options) {
    // 从场景值或query参数中解析邀请来源（处理热启动场景）
    if (options && options.query && options.query.inviteFrom) {
      // 只有当前没有邀请来源时才设置（避免覆盖）
      if (!this.globalData.inviteFrom) {
        this.globalData.inviteFrom = options.query.inviteFrom;
        console.log('热启动检测到邀请来源:', options.query.inviteFrom);
      }
    }
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
  },

  checkUpdate () {
    // 获取更新管理器对象
    const updateManager = wx.getUpdateManager();

    // 1. 检查是否有新版本
    updateManager.onCheckForUpdate(function (res) {
      // res.hasUpdate 返回 boolean，true 说明有新版本
      if (res.hasUpdate) {
        console.log(res);
        console.log('检测到新版本，准备下载');
      }
    });

    // 2. 新版本下载完成的回调
    updateManager.onUpdateReady(function () {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        showCancel: false, // 强制更新，不显示取消按钮
        success: function (res) {
          if (res.confirm) {
            // 3. 强制重启小程序并应用新版本
            updateManager.applyUpdate();
          }
        }
      });
    });

    // 3. 新版本下载失败的回调
    updateManager.onUpdateFailed(function () {
      wx.showModal({
        title: '已有新版本',
        content: '新版本已经上线了，请您删除当前小程序，重新搜索打开哟~'
      });
    });
  },

});
