// app.js
var Bmob = require('utils/Bmob-2.6.3.min.js');

// ⚠️ 安全警告：API密钥硬编码在客户端代码中
// 风险：密钥暴露在客户端，可能被恶意用户获取并滥用
// 建议：使用云函数获取密钥，或从服务器端获取
// 初始化 Bmob
Bmob.initialize("4fa0f30d648a4b33", "123zbx");

// 全局音乐管理器
let bgmCtx = null;
let victoryCtx = null;
let musicCallbacks = []; // 存储所有音乐状态变化的回调函数
let isMusicPlaying = false; // 内部播放状态跟踪

App({
  globalData: {
    openid: null,
    userInfo: null
  },

  onLaunch: function () {
    // 一键登录获取 OpenID
    Bmob.User.auth().then(res => {
      console.log('登录成功', res);
      // [需求2] 保存 OpenID 到全局
      this.globalData.openid = res.authData.weapp.openid;
    }).catch(err => {
      console.log('登录失败', err);
    });

    // 初始化全局音乐
    this.initGlobalMusic();
  },

  initGlobalMusic() {
    // 初始化背景音乐
    if (!bgmCtx) {
      bgmCtx = wx.createInnerAudioContext();
      bgmCtx.src = 'http://qianze.xyz/music/backMusic1.mp4';
      bgmCtx.loop = true;
      bgmCtx.volume = 0.6; // 默认60%音量
    }

    // 初始化胜利音乐
    if (!victoryCtx) {
      victoryCtx = wx.createInnerAudioContext();
      victoryCtx.src = 'http://qianze.xyz/music/victory.mp3';
      victoryCtx.volume = 0.6; // 默认60%音量
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