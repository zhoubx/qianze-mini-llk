// pages/prizes/prizes.js
// 使用微信云开发替代 Bmob
const dateFormat = require('../../utils/dateFormat.js'); // 引入日期格式化工具
const config = require('../../config/index.js'); // 引入配置文件
const { uploadAvatarIfNeeded } = require('../../utils/avatarUploader.js'); // 引入头像上传工具
const app = getApp();

// 云数据库引用
const db = wx.cloud.database();
const _ = db.command;

// 从配置文件获取配置项
const DIFF_MAP = config.DIFFICULTY_CONFIG.TEXT_MAP;
const { AVATAR_CONFIG } = config;

Page({
  data: {
    prizes: [],
    shareCoupons: [],  // 分享获得的代金券
    loading: true,
    // 用户信息
    userInfo: {
      avatarUrl: '',
      nickName: '',
      objectId: ''
    },
    // 编辑中的临时值（独立于 userInfo，避免闪烁）
    editingAvatarUrl: '',
    editingNickName: '',
    defaultAvatarUrl: AVATAR_CONFIG.DEFAULT,
    isEditingProfile: false, // 是否正在编辑用户信息
    isRefreshing: false
  },
  
  onShow() {
    this.fetchUserInfo(); // 获取用户信息
    this.fetchAllPrizes(); // 获取所有奖品（合并请求）

    // 同步音乐状态，确保页面显示时音乐组件状态正确
    const musicControl = this.selectComponent('#musicControl');
    if (musicControl) {
      musicControl.syncMusicStatus();
    }
  },

  // 获取所有奖品（调用云函数 getUserPrizes）
  async fetchAllPrizes(options = {}) {
    const { showLoading = true } = options;
    const openid = app.globalData.openid;
    if (!openid) {
      setTimeout(() => {
        if (app.globalData.openid) this.fetchAllPrizes(options);
      }, 1000);
      return false;
    }

    if (showLoading) {
      wx.showLoading({ title: '加载中' });
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'getUserPrizes'
      });

      if (!res.result || !res.result.success) {
        throw new Error(res.result ? res.result.error : '云函数调用失败');
      }

      const { gamePrizes, shareCoupons } = res.result;

      // === 处理游戏奖品 ===
      let processedGamePrizes = this.processPrizes(gamePrizes, true);
      
      // 分离有效和过期奖品
      let validGamePrizes = processedGamePrizes.filter(p => p.status !== 'expired');
      let expiredGamePrizes = processedGamePrizes.filter(p => p.status === 'expired');

      // === 处理分享代金券 ===
      let processedShareCoupons = this.processPrizes(shareCoupons, false);

      // 分离有效和过期代金券
      let validShareCoupons = processedShareCoupons.filter(p => p.status !== 'expired');
      let expiredShareCoupons = processedShareCoupons.filter(p => p.status === 'expired');

      this.setData({ 
        // 游戏奖品数据
        validGamePrizes,
        allExpiredGamePrizes: expiredGamePrizes,
        // 初始只显示前10条过期记录
        visibleExpiredGamePrizes: expiredGamePrizes.slice(0, 10),
        hasMoreGameExpired: expiredGamePrizes.length > 10,
        showAllGameExpired: false,

        // 分享代金券数据
        validShareCoupons,
        allExpiredShareCoupons: expiredShareCoupons,
        // 初始只显示前10条过期记录
        visibleExpiredShareCoupons: expiredShareCoupons.slice(0, 10),
        hasMoreShareExpired: expiredShareCoupons.length > 10,
        showAllShareExpired: false,

        loading: false 
      });

      return true;

    } catch (err) {
      console.error('获取奖品列表失败:', err);
      wx.showToast({
        title: '获取奖品列表失败',
        icon: 'none'
      });
      this.setData({ loading: false });
      return false;
    } finally {
      if (showLoading) {
        wx.hideLoading();
      }
    }
  },

  // 统一处理奖品数据格式和排序
  processPrizes(list, isGamePrize) {
    let processedList = list.map(item => {
      item.createTimeStr = dateFormat.formatDate(item.createdAt);
      
      if (item.status === 'pending') item.statusText = '待使用';
      else if (item.status === 'used') item.statusText = '已使用';
      else item.statusText = '已失效';

      item.redeemedTimeStr = this.formatRedeemedTime(item.redeemedTime);

      if (isGamePrize) {
        item.diffText = DIFF_MAP[item.difficulty] || '未知';
        item.rankText = item.rankSnapshot ? `第${item.rankSnapshot}名` : '未记录';
      }

      return item;
    });

    // 排序: 待使用 > 已使用 > 已失效，同状态按时间倒序
    const statusWeight = { 'pending': 0, 'used': 1, 'expired': 2 };
    processedList.sort((a, b) => {
      let wa = statusWeight[a.status] !== undefined ? statusWeight[a.status] : 3;
      let wb = statusWeight[b.status] !== undefined ? statusWeight[b.status] : 3;
      
      if (wa !== wb) {
        return wa - wb;
      } else {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    return processedList;
  },

  // 展示所有过期游戏奖品
  showAllGameExpired() {
    this.setData({
      visibleExpiredGamePrizes: this.data.allExpiredGamePrizes,
      showAllGameExpired: true
    });
  },

  // 展示所有过期分享代金券
  showAllShareExpired() {
    this.setData({
      visibleExpiredShareCoupons: this.data.allExpiredShareCoupons,
      showAllShareExpired: true
    });
  },

  // 辅助函数：格式化核销时间
  formatRedeemedTime(timeVal) {
    if (!timeVal) return '暂无时间记录';
    
    try {
      let redeemedDate;
      if (typeof timeVal === 'string') {
        redeemedDate = new Date(timeVal);
      } else if (timeVal instanceof Date) {
        redeemedDate = timeVal;
      } else if (timeVal && typeof timeVal === 'object') {
        redeemedDate = new Date(timeVal);
      } else {
        redeemedDate = new Date(timeVal);
      }

      if (!isNaN(redeemedDate.getTime())) {
        const month = (redeemedDate.getMonth() + 1).toString().padStart(2, '0');
        const day = redeemedDate.getDate().toString().padStart(2, '0');
        const hours = redeemedDate.getHours().toString().padStart(2, '0');
        const minutes = redeemedDate.getMinutes().toString().padStart(2, '0');
        const seconds = redeemedDate.getSeconds().toString().padStart(2, '0');
        return `${month}-${day} ${hours}:${minutes}:${seconds}`;
      } else {
        return '时间格式错误';
      }
    } catch (error) {
      console.warn('核销时间格式化失败:', error);
      return '时间格式错误';
    }
  },

  // 辅助函数：列表排序 (已整合到 processPrizes，保留空壳防止报错)
  sortPrizes(list) {
    // Deprecated
  },

  // 兼容旧方法名
  fetchMyPrizes(options) {
    return this.fetchAllPrizes(options);
  },
  
  fetchShareCoupons() {
    return Promise.resolve();
  },

  // 恢复丢失的用户信息相关方法
  // 获取用户信息 (云函数版本)
  async fetchUserInfo() {
    try {
      const openid = app.globalData.openid;
      if (!openid) {
        setTimeout(() => {
          if (app.globalData.openid) this.fetchUserInfo();
        }, 1000);
        return;
      }

      const res = await wx.cloud.callFunction({
        name: 'getUserInfo'
      });

      if (res.result && res.result.success && res.result.data) {
        const userInfo = res.result.data;
        this.setData({
          userInfo: {
            avatarUrl: userInfo.avatarUrl || '',
            nickName: userInfo.nickName || '',
            objectId: userInfo._id
          }
        });
      } else {
        // 无数据
        this.setData({
          userInfo: {
            avatarUrl: '',
            nickName: '',
            objectId: ''
          }
        });
      }
    } catch (err) {
      console.error('获取用户信息失败:', err);
    }
  },

  startEditProfile() {
    this.setData({
      isEditingProfile: true,
      editingAvatarUrl: this.data.userInfo.avatarUrl,
      editingNickName: this.data.userInfo.nickName
    });
  },

  cancelEditProfile() {
    this.setData({
      isEditingProfile: false,
      editingAvatarUrl: '',
      editingNickName: ''
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (avatarUrl) {
      this.setData({
        editingAvatarUrl: avatarUrl
      });
    }
  },

  onNickNameInput(e) {
    this.setData({
      editingNickName: e.detail.value
    });
  },

  async saveUserInfo() {
    const { userInfo, editingNickName, editingAvatarUrl } = this.data;
    
    if (!editingNickName.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '保存中' });
      
      let finalAvatarUrl = editingAvatarUrl;
      try {
        finalAvatarUrl = await uploadAvatarIfNeeded(editingAvatarUrl);
        if (finalAvatarUrl && finalAvatarUrl.startsWith('cloud://')) {
          const tempRes = await wx.cloud.getTempFileURL({
            fileList: [finalAvatarUrl]
          });
          if (tempRes.fileList && tempRes.fileList[0] && tempRes.fileList[0].tempFileURL) {
            finalAvatarUrl = tempRes.fileList[0].tempFileURL;
          }
        }
      } catch (uploadErr) {
        console.error('头像上传失败:', uploadErr);
      }

      const res = await wx.cloud.callFunction({
        name: 'saveUserInfo',
        data: {
          nickName: editingNickName,
          avatarUrl: finalAvatarUrl
        }
      });

      if (!res.result || !res.result.success) {
        throw new Error(res.result ? res.result.error : '调用云函数失败');
      }

      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      app.globalData.needRefreshLeaderboard = true;
      
      this.setData({
        'userInfo.avatarUrl': finalAvatarUrl,
        'userInfo.nickName': editingNickName,
        isEditingProfile: false,
        editingAvatarUrl: '',
        editingNickName: ''
      });

      if (!userInfo.objectId) {
        this.fetchUserInfo();
      }

    } catch (err) {
      console.error('保存用户信息失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 统一核销逻辑 (带密码验证)
  async handleRedeem(id, collection) {
    wx.showModal({
      title: '店员核销',
      content: '', // 必须为空才能显示输入框 placeholder
      editable: true,
      placeholderText: '请输入店员核销密码',
      success: async (res) => {
        if (res.confirm) {
          const password = res.content;
          if (!password) {
             wx.showToast({ title: '请输入密码', icon: 'none' });
             return;
          }

          wx.showLoading({ title: '核销中' });
          try {
            const cloudRes = await wx.cloud.callFunction({
              name: 'redeemPrize',
              data: {
                id,
                collection,
                password
              }
            });

            wx.hideLoading();

            if (cloudRes.result && cloudRes.result.success) {
              wx.showToast({ title: '核销成功', icon: 'success' });
              // 刷新列表
              this.fetchAllPrizes({ showLoading: false });
            } else {
              wx.showToast({ 
                title: cloudRes.result?.message || '核销失败', 
                icon: 'none' 
              });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('核销调用失败:', err);
            wx.showToast({ title: '系统错误', icon: 'none' });
          }
        }
      }
    });
  },

  // 游戏奖品核销
  usePrize(e) {
    let id = e.currentTarget.dataset.id;
    this.handleRedeem(id, 'GameScore');
  },

  // 分享代金券核销
  useShareCoupon(e) {
    let id = e.currentTarget.dataset.id;
    this.handleRedeem(id, 'ShareCoupons');
  },

  async refreshPrizeLists(source = 'button') {
    if (this.data.isRefreshing) return;

    this.setData({ isRefreshing: true });
    wx.showNavigationBarLoading();

    try {
      // fetchAllPrizes 已经合并了获取所有奖品的逻辑，只需调用一次
      const success = await this.fetchAllPrizes({ showLoading: false });

      if (success) {
        if (source === 'button') {
          wx.showToast({ title: '已刷新', icon: 'success' });
        }
      } else {
        wx.showToast({ title: '刷新失败，请稍后重试', icon: 'none' });
      }
    } catch (err) {
      console.error('刷新奖品列表失败:', err);
      wx.showToast({ title: '刷新失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ isRefreshing: false });
      wx.hideNavigationBarLoading();
      if (source === 'pull') {
        wx.stopPullDownRefresh();
      }
    }
  },


  onPullDownRefresh() {
    this.refreshPrizeLists('pull');
  },

  onRefreshTap() {
    this.refreshPrizeLists('button');
  },

  // 分享代金券核销
  useShareCoupon(e) {
    let id = e.currentTarget.dataset.id;
    this.handleRedeem(id, 'ShareCoupons');
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    let path = '/pages/index/index';
    
    // 携带邀请来源参数（分享人的openid）
    const openid = app.globalData.openid;
    if (openid) {
      path = `/pages/index/index?inviteFrom=${openid}`;
    }
    
    return {
      title: '快来挑战芊泽风云榜，赢取大奖！',
      path: path,
      imageUrl: config.SHARE_IMAGE
    };
  },

  // // 分享到朋友圈
  // onShareTimeline() {
  //   return {
  //     title:  '快来挑战芊泽风云榜，赢取大奖！',
  //     imageUrl: config.SHARE_IMAGE
  //   };
  // },
});
