
// pages/rules/rules.js
const config = require('../../config/index.js');
const { PRIZE_CONFIG, DIFFICULTY_CONFIG } = config;

// 从配置计算各难度的消除对数
const BOARD = DIFFICULTY_CONFIG.BOARD;
const pairsEasy = (BOARD.easy.rows * BOARD.easy.cols) / 2;
const pairsMedium = (BOARD.medium.rows * BOARD.medium.cols) / 2;
const pairsHard = (BOARD.hard.rows * BOARD.hard.cols) / 2;

// 平均每1.5秒消除一对，计算示例耗时
const timePerPair = 1.5;
const timeEasy = pairsEasy * timePerPair;
const timeMedium = pairsMedium * timePerPair;
const timeHard = pairsHard * timePerPair;

// 获取难度系数
const multiplierEasy = DIFFICULTY_CONFIG.OPTIONS.find(d => d.id === 'easy').multiplier;
const multiplierMedium = DIFFICULTY_CONFIG.OPTIONS.find(d => d.id === 'medium').multiplier;
const multiplierHard = DIFFICULTY_CONFIG.OPTIONS.find(d => d.id === 'hard').multiplier;

// 计算示例基础分（无洗牌情况）
const baseScoreEasy = Math.floor((pairsEasy * 1000 / timeEasy) * multiplierEasy);
const baseScoreMedium = Math.floor((pairsMedium * 1000 / timeMedium) * multiplierMedium);
const baseScoreHard = Math.floor((pairsHard * 1000 / timeHard) * multiplierHard);

Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 洗牌奖励配置
    shuffleBonus: PRIZE_CONFIG.SHUFFLE_BONUS,
    // 难度系数配置
    difficultyOptions: DIFFICULTY_CONFIG.OPTIONS,
    // 各难度消除对数（从配置计算）
    pairs: {
      easy: pairsEasy,
      medium: pairsMedium,
      hard: pairsHard
    },
    // 示例耗时（对数 × 1.5秒）
    exampleTime: {
      easy: timeEasy,
      medium: timeMedium,
      hard: timeHard
    },
    // 难度系数
    multiplier: {
      easy: multiplierEasy,
      medium: multiplierMedium,
      hard: multiplierHard
    },
    // 示例基础分
    baseScore: {
      easy: baseScoreEasy,
      medium: baseScoreMedium,
      hard: baseScoreHard
    },
    // 详细规则是否展开
    showScoreDetail: false
  },

  // 切换分数计算详情的展开/折叠状态
  toggleScoreDetail() {
    this.setData({
      showScoreDetail: !this.data.showScoreDetail
    });
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 同步音乐状态，确保页面显示时音乐组件状态正确
    const musicControl = this.selectComponent('#musicControl');
    if (musicControl) {
      musicControl.syncMusicStatus();
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '快来挑战芊泽风云榜，赢取大奖！',
      path: '/pages/index/index',
      imageUrl: config.SHARE_IMAGE
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title:  '快来挑战芊泽风云榜，赢取大奖！',
      imageUrl: config.SHARE_IMAGE
    };
  },

  // 1. 监听头像选择
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    
    // 注意：这里的 avatarUrl 只是一个临时的本地路径
    // 如果需要永久保存，必须通过 wx.uploadFile 上传到你自己的服务器
    this.setData({
      avatarUrl
    });
    
    // 可以在这里触发上传逻辑
    // this.uploadImage(avatarUrl); 
  },

  // 2. 监听昵称输入（注意使用 bind:change 或 bindblur）
  onInputChange(e) {
    // 微信会自动在键盘上方提供“使用微信昵称”的选项
    // 用户点击后，这里就能获取到值
    const nickName = e.detail.value;
    this.setData({
      nickName
    });
  },

  // 3. 提交保存
  onSubmit() {
    if (!this.data.nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    
    console.log('最终提交的数据：', {
      avatar: this.data.avatarUrl,
      name: this.data.nickName
    });

    // 这里发送请求给后端保存用户信息
  }
})