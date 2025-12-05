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
const { GAME_IMAGES, AVATAR_CONFIG, SHARE_COUPON_CONFIG } = config;

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
    this.fetchMyPrizes();
    this.fetchShareCoupons(); // 获取分享代金券

    // 同步音乐状态，确保页面显示时音乐组件状态正确
    const musicControl = this.selectComponent('#musicControl');
    if (musicControl) {
      musicControl.syncMusicStatus();
    }
  },

  // 获取用户信息 (云数据库版本)
  async fetchUserInfo() {
    try {
      const openid = app.globalData.openid;
      if (!openid) {
        // 等待 openid 获取
        setTimeout(() => {
          if (app.globalData.openid) this.fetchUserInfo();
        }, 1000);
        return;
      }

      const res = await db.collection('UserInfo')
        .where({ _openid: openid })
        .get();

      if (res.data.length > 0) {
        const userInfo = res.data[0];
        this.setData({
          userInfo: {
            avatarUrl: userInfo.avatarUrl || '',  // 如果没有头像则为空字符串（显示占位符）
            nickName: userInfo.nickName || '',
            objectId: userInfo._id // 云数据库使用 _id
          }
        });
      } else {
        // 用户没有保存过信息，头像为空（显示占位符）
        this.setData({
          userInfo: {
            avatarUrl: '',  // 不再使用随机头像，而是显示占位符
            nickName: '',
            objectId: ''
          }
        });
      }
    } catch (err) {
      console.error('获取用户信息失败:', err);
    }
  },

  // 开始编辑用户信息
  startEditProfile() {
    // 初始化编辑状态为当前用户信息
    this.setData({
      isEditingProfile: true,
      editingAvatarUrl: this.data.userInfo.avatarUrl,
      editingNickName: this.data.userInfo.nickName
    });
  },

  // 取消编辑
  cancelEditProfile() {
    this.setData({
      isEditingProfile: false,
      editingAvatarUrl: '',
      editingNickName: ''
    });
  },

  // 阻止事件冒泡
  preventBubble() {
    // 空函数，仅用于阻止事件冒泡
  },

  // 处理头像选择
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (avatarUrl) {
      // 编辑模式：只更新编辑状态变量
      this.setData({
        editingAvatarUrl: avatarUrl
      });
    }
  },

  // 处理昵称输入（仿照 index 页面的简洁实现）
  onNickNameInput(e) {
    this.setData({
      editingNickName: e.detail.value
    });
  },

  // 保存用户信息 (云数据库版本)
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
      
      const openid = app.globalData.openid;
      if (!openid) {
        wx.hideLoading();
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }

      // 先上传头像到云存储获取永久 URL
      let finalAvatarUrl = editingAvatarUrl;
      try {
        finalAvatarUrl = await uploadAvatarIfNeeded(editingAvatarUrl);
        
        // 双重保障：如果返回的仍然是 cloud:// 开头，尝试在页面端再转换一次
        if (finalAvatarUrl && finalAvatarUrl.startsWith('cloud://')) {
          console.log('saveUserInfo: 检测到 cloud:// 路径，尝试二次转换为 https');
          const tempRes = await wx.cloud.getTempFileURL({
            fileList: [finalAvatarUrl]
          });
          if (tempRes.fileList && tempRes.fileList[0] && tempRes.fileList[0].tempFileURL) {
            finalAvatarUrl = tempRes.fileList[0].tempFileURL;
          }
        }
      } catch (uploadErr) {
        console.error('头像上传失败，将使用原路径继续:', uploadErr);
        // 即使上传失败也继续流程
      }

      // 改为调用云函数保存用户信息
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

      // 如果是新创建的记录，云函数可能没有返回 _id，这里尝试重新获取或直接更新本地状态
      // 由于云函数已经成功，我们可以放心地更新本地 UI
      
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      
      // 设置标志位，通知首页刷新排行榜
      app.globalData.needRefreshLeaderboard = true;
      
      // 保存成功后，更新 userInfo 并清除编辑状态
      this.setData({
        'userInfo.avatarUrl': finalAvatarUrl,
        'userInfo.nickName': editingNickName,
        isEditingProfile: false,
        editingAvatarUrl: '',
        editingNickName: ''
      });

      // 如果需要 objectId，可以重新拉取一次用户信息（或者让云函数返回 _id）
      if (!userInfo.objectId) {
        this.fetchUserInfo();
      }

    } catch (err) {
      console.error('保存用户信息失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
  
  // 获取我的奖品列表 (云数据库版本)
  async fetchMyPrizes(options = {}) {
    const { showLoading = true } = options;
    const openid = app.globalData.openid;
    if (!openid) {
      setTimeout(() => {
        if (app.globalData.openid) this.fetchMyPrizes(options);
      }, 1000);
      return false;
    }

    if (showLoading) {
      wx.showLoading({ title: '加载中' });
    }
    
    try {
      const res = await db.collection('GameScore')
        .where({ _openid: openid })
        .orderBy('createdAt', 'desc')
        .get();

      let list = res.data.map(item => {
        // 使用统一的日期格式化工具函数
        item.createTimeStr = dateFormat.formatDate(item.createdAt);

        // 状态文案
        if (item.status === 'pending') item.statusText = '待使用';
        else if (item.status === 'used') item.statusText = '已使用';
        else item.statusText = '已失效';

        // [需求] 难度文案映射
        item.diffText = DIFF_MAP[item.difficulty] || '未知';
        
        // [需求] 处理排名 (旧数据可能没有 rankSnapshot)
        item.rankText = item.rankSnapshot ? `第${item.rankSnapshot}名` : '未记录';

        // 处理核销时间显示
        if (item.redeemedTime) {
          try {
            // 处理不同格式的时间数据
            let redeemedDate;

            // 云数据库可能返回不同的时间格式，尝试多种处理方式
            if (typeof item.redeemedTime === 'string') {
              // 如果是字符串，可能是ISO格式或普通格式
              redeemedDate = new Date(item.redeemedTime);
            } else if (item.redeemedTime instanceof Date) {
              // 如果已经是Date对象
              redeemedDate = item.redeemedTime;
            } else if (item.redeemedTime && typeof item.redeemedTime === 'object') {
              // 云数据库返回的时间对象
              redeemedDate = new Date(item.redeemedTime);
            } else {
              // 其他情况，尝试直接构造
              redeemedDate = new Date(item.redeemedTime);
            }

            if (!isNaN(redeemedDate.getTime())) {
              const month = (redeemedDate.getMonth() + 1).toString().padStart(2, '0');
              const day = redeemedDate.getDate().toString().padStart(2, '0');
              const hours = redeemedDate.getHours().toString().padStart(2, '0');
              const minutes = redeemedDate.getMinutes().toString().padStart(2, '0');
              const seconds = redeemedDate.getSeconds().toString().padStart(2, '0');
              item.redeemedTimeStr = `${month}-${day} ${hours}:${minutes}:${seconds}`;
            } else {
              item.redeemedTimeStr = '时间格式错误';
            }
          } catch (error) {
            console.warn('核销时间格式化失败:', error);
            item.redeemedTimeStr = '时间格式错误';
          }
        } else {
          item.redeemedTimeStr = '暂无时间记录';
        }

        return item;
      });

      // [需求] 排序优化: 待使用(0) > 已使用(1) > 已失效(2)
      const statusWeight = { 'pending': 0, 'used': 1, 'expired': 2 };
      
      list.sort((a, b) => {
        let wa = statusWeight[a.status] !== undefined ? statusWeight[a.status] : 3;
        let wb = statusWeight[b.status] !== undefined ? statusWeight[b.status] : 3;
        
        if (wa !== wb) {
          return wa - wb; // 权重小的在前
        } else {
          // 权重相同，按时间倒序
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
      });

      this.setData({ prizes: list, loading: false });
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

  // 核销奖品 (云数据库版本)
  usePrize(e) {
    let id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认核销',
      content: '请确认为店员操作，核销后将无法撤销',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.collection('GameScore').doc(id).update({
              data: {
                status: 'used',
                redeemedTime: db.serverDate()
              }
            });
            wx.showToast({ title: '核销成功' });
            this.fetchMyPrizes(); // 刷新列表
          } catch (err) {
            console.error('核销失败:', err);
            wx.showToast({
              title: '核销失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 获取分享代金券列表 (云数据库版本)
  async fetchShareCoupons() {
    const openid = app.globalData.openid;
    if (!openid) {
      setTimeout(() => {
        if (app.globalData.openid) this.fetchShareCoupons();
      }, 1000);
      return false;
    }

    try {
      // 查询当前用户的分享代金券（使用 sharerOpenid 字段）
      const res = await db.collection('ShareCoupons')
        .where({ sharerOpenid: openid })
        .orderBy('createdAt', 'desc')
        .get();

      let list = res.data.map(item => {
        // 格式化创建时间
        item.createTimeStr = dateFormat.formatDate(item.createdAt);

        // 状态文案
        if (item.status === 'pending') item.statusText = '待使用';
        else if (item.status === 'used') item.statusText = '已使用';
        else item.statusText = '已失效';

        // 处理核销时间显示
        if (item.redeemedTime) {
          try {
            let redeemedDate;
            if (typeof item.redeemedTime === 'string') {
              redeemedDate = new Date(item.redeemedTime);
            } else if (item.redeemedTime instanceof Date) {
              redeemedDate = item.redeemedTime;
            } else if (item.redeemedTime && typeof item.redeemedTime === 'object') {
              redeemedDate = new Date(item.redeemedTime);
            } else {
              redeemedDate = new Date(item.redeemedTime);
            }

            if (!isNaN(redeemedDate.getTime())) {
              const month = (redeemedDate.getMonth() + 1).toString().padStart(2, '0');
              const day = redeemedDate.getDate().toString().padStart(2, '0');
              const hours = redeemedDate.getHours().toString().padStart(2, '0');
              const minutes = redeemedDate.getMinutes().toString().padStart(2, '0');
              const seconds = redeemedDate.getSeconds().toString().padStart(2, '0');
              item.redeemedTimeStr = `${month}-${day} ${hours}:${minutes}:${seconds}`;
            } else {
              item.redeemedTimeStr = '时间格式错误';
            }
          } catch (error) {
            console.warn('核销时间格式化失败:', error);
            item.redeemedTimeStr = '时间格式错误';
          }
        } else {
          item.redeemedTimeStr = '暂无时间记录';
        }

        return item;
      });

      // 排序优化: 待使用(0) > 已使用(1) > 已失效(2)
      const statusWeight = { 'pending': 0, 'used': 1, 'expired': 2 };
      
      list.sort((a, b) => {
        let wa = statusWeight[a.status] !== undefined ? statusWeight[a.status] : 3;
        let wb = statusWeight[b.status] !== undefined ? statusWeight[b.status] : 3;
        
        if (wa !== wb) {
          return wa - wb;
        } else {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
      });

      this.setData({ shareCoupons: list });
      return true;
    } catch (err) {
      console.error('获取分享代金券列表失败:', err);
      return false;
    }
  },

  async refreshPrizeLists(source = 'button') {
    if (this.data.isRefreshing) return;

    this.setData({ isRefreshing: true });
    wx.showNavigationBarLoading();

    try {
      const [prizeOk, couponOk] = await Promise.all([
        this.fetchMyPrizes({ showLoading: false }),
        this.fetchShareCoupons()
      ]);

      if (prizeOk && couponOk) {
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

  // 核销分享代金券 (通过云函数，解决权限问题)
  useShareCoupon(e) {
    let id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认核销',
      content: '请确认为店员操作，核销后将无法撤销',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 调用云函数核销代金券（解决 _openid 权限问题）
            const result = await wx.cloud.callFunction({
              name: 'redeemShareCoupon',
              data: { couponId: id }
            });

            if (result.result && result.result.success) {
              wx.showToast({ title: '核销成功' });
              this.fetchShareCoupons(); // 刷新列表
            } else {
              wx.showToast({
                title: result.result?.message || '核销失败',
                icon: 'none'
              });
            }
          } catch (err) {
            console.error('核销失败:', err);
            wx.showToast({
              title: '核销失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    });
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
