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
const { GAME_IMAGES, AVATAR_CONFIG } = config;

Page({
  data: {
    prizes: [],
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
    isEditingProfile: false // 是否正在编辑用户信息
  },
  
  onShow() {
    this.fetchUserInfo(); // 获取用户信息
    this.fetchMyPrizes();

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
            avatarUrl: userInfo.avatarUrl || '',
            nickName: userInfo.nickName || '',
            objectId: userInfo._id // 云数据库使用 _id
          }
        });
      } else {
        // 用户没有保存过信息，使用随机头像
        this.setData({
          userInfo: {
            avatarUrl: GAME_IMAGES[Math.floor(Math.random() * GAME_IMAGES.length)],
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
      if (this.data.isEditingProfile) {
        // 编辑模式：只更新编辑状态变量
        this.setData({
          editingAvatarUrl: avatarUrl
        });
      } else {
        // 非编辑模式：直接保存头像
        this.setData({
          'userInfo.avatarUrl': avatarUrl
        });
        this.saveAvatarOnly(avatarUrl);
      }
    }
  },

  // 仅保存头像 (云数据库版本)
  async saveAvatarOnly(avatarUrl) {
    try {
      const openid = app.globalData.openid;
      if (!openid) return;

      wx.showLoading({ title: '上传中' });

      // 先上传头像到云存储获取永久 URL
      let finalAvatarUrl = avatarUrl;
      try {
        finalAvatarUrl = await uploadAvatarIfNeeded(avatarUrl);
        // 更新页面显示
        if (finalAvatarUrl !== avatarUrl) {
          this.setData({ 'userInfo.avatarUrl': finalAvatarUrl });
        }
      } catch (uploadErr) {
        console.error('头像上传失败:', uploadErr);
        wx.hideLoading();
        wx.showToast({ title: '上传失败', icon: 'none' });
        return;
      }

      const res = await db.collection('UserInfo')
        .where({ _openid: openid })
        .get();

      if (res.data.length > 0) {
        // 更新现有记录
        await db.collection('UserInfo').doc(res.data[0]._id).update({
          data: {
            avatarUrl: finalAvatarUrl,
            updatedAt: db.serverDate()
          }
        });
        wx.hideLoading();
        wx.showToast({ title: '头像已更新', icon: 'success' });
        // 设置标志位，通知首页刷新排行榜
        app.globalData.needRefreshLeaderboard = true;
      } else {
        // 如果没有记录，创建新记录 (_openid 会由云数据库自动添加)
        await db.collection('UserInfo').add({
          data: {
            avatarUrl: finalAvatarUrl,
            nickName: this.data.userInfo.nickName || '',
            createdAt: db.serverDate()
          }
        });
        wx.hideLoading();
        wx.showToast({ title: '头像已更新', icon: 'success' });
        // 设置标志位，通知首页刷新排行榜
        app.globalData.needRefreshLeaderboard = true;
      }
    } catch (err) {
      console.error('保存头像失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 处理昵称输入
  onNickNameInput(e) {
    this.setData({
      editingNickName: e.detail.value
    });
  },

  // 处理昵称输入框失去焦点
  onNickNameBlur(e) {
    // 确保失去焦点时保存最新值
    if (e.detail.value) {
      this.setData({
        editingNickName: e.detail.value
      });
    }
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
      } catch (uploadErr) {
        console.error('头像上传失败，将使用原路径继续:', uploadErr);
        // 即使上传失败也继续流程
      }

      if (userInfo.objectId) {
        // 更新现有记录
        await db.collection('UserInfo').doc(userInfo.objectId).update({
          data: {
            nickName: editingNickName,
            avatarUrl: finalAvatarUrl,
            updatedAt: db.serverDate()
          }
        });
      } else {
        // 创建新记录 (_openid 会由云数据库自动添加)
        const result = await db.collection('UserInfo').add({
          data: {
            nickName: editingNickName,
            avatarUrl: finalAvatarUrl,
            createdAt: db.serverDate()
          }
        });
        this.setData({
          'userInfo.objectId': result._id
        });
      }

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

    } catch (err) {
      console.error('保存用户信息失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
  
  // 获取我的奖品列表 (云数据库版本)
  async fetchMyPrizes() {
    const openid = app.globalData.openid;
    if (!openid) {
      setTimeout(() => {
        if (app.globalData.openid) this.fetchMyPrizes();
      }, 1000);
      return;
    }

    wx.showLoading({ title: '加载中' });
    
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
      wx.hideLoading();
    } catch (err) {
      console.error('获取奖品列表失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '获取奖品列表失败',
        icon: 'none'
      });
      this.setData({ loading: false });
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

  // // 分享到朋友圈
  // onShareTimeline() {
  //   return {
  //     title:  '快来挑战芊泽风云榜，赢取大奖！',
  //     imageUrl: config.SHARE_IMAGE
  //   };
  // },
});
