// components/music-control/music-control.js
Component({
  /**
   * 组件的初始数据
   */
  data: {
    isMusicPlaying: true
  },

  lifetimes: {
    attached() {
      // 获取全局音乐状态并同步
      this.syncMusicStatus();

      // 注册音乐状态变化回调
      const app = getApp();
      app.registerMusicCallback(this.onMusicStatusChange.bind(this));
    },

    detached() {
      // 取消注册回调
      const app = getApp();
      app.unregisterMusicCallback(this.onMusicStatusChange.bind(this));
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 同步当前音乐状态
    syncMusicStatus() {
      const app = getApp();
      const musicStatus = app.getMusicStatus();
      this.setData({
        isMusicPlaying: musicStatus.isPlaying
      });
    },

    // 音乐状态变化回调
    onMusicStatusChange(isPlaying) {
      this.setData({
        isMusicPlaying: isPlaying
      });
    },

    // 切换音乐播放状态
    toggleMusic() {
      const app = getApp();
      app.toggleBackgroundMusic();
      // 状态会通过回调自动更新，无需手动设置
    },

    // 播放胜利音乐（供父组件调用）
    playVictoryMusic() {
      const app = getApp();
      app.playVictoryMusic();
    },

    // 供父组件调用的方法
    getMusicControl() {
      return {
        playVictory: this.playVictoryMusic.bind(this),
        toggle: this.toggleMusic.bind(this)
      };
    }
  }
})
