// pages/prizes/prizes.js
var Bmob = require('../../utils/Bmob-2.6.3.min.js');
const dateFormat = require('../../utils/dateFormat.js'); // 引入日期格式化工具
const config = require('../../config/index.js'); // 引入配置文件
const app = getApp();

// 从配置文件获取难度文案映射
const DIFF_MAP = config.DIFFICULTY_CONFIG.TEXT_MAP;

Page({
  data: {
    prizes: [],
    loading: true
  },
  
  onShow() {
    this.fetchMyPrizes();

    // 同步音乐状态，确保页面显示时音乐组件状态正确
    const musicControl = this.selectComponent('#musicControl');
    if (musicControl) {
      musicControl.syncMusicStatus();
    }
  },
  
  fetchMyPrizes() {
    const openid = app.globalData.openid;
    if(!openid) {
      setTimeout(() => {
        if(app.globalData.openid) this.fetchMyPrizes();
      }, 1000);
      return;
    }

    wx.showLoading({title: '加载中'});
    
    const query = Bmob.Query("GameScore");
    query.equalTo("openid", "==", openid);
    query.order("-createdAt"); 
    query.find().then(res => {
      
      let list = res.map(item => {
        // 使用统一的日期格式化工具函数
        item.createTimeStr = dateFormat.formatDate(item.createdAt);

        // 状态文案
        if(item.status === 'pending') item.statusText = '待使用';
        else if(item.status === 'used') item.statusText = '已使用';
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

            // Bmob可能返回不同的时间格式，尝试多种处理方式
            if (typeof item.redeemedTime === 'string') {
              // 如果是字符串，可能是ISO格式或普通格式
              redeemedDate = new Date(item.redeemedTime);
            } else if (item.redeemedTime instanceof Date) {
              // 如果已经是Date对象
              redeemedDate = item.redeemedTime;
            } else if (item.redeemedTime && typeof item.redeemedTime === 'object' && item.redeemedTime.iso) {
              // Bmob特有的时间对象格式
              redeemedDate = new Date(item.redeemedTime.iso);
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
    }).catch(err => {
      console.error('获取奖品列表失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '获取奖品列表失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    });
  },

  usePrize(e) {
    let id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认核销',
      content: '请确认为店员操作，核销后将无法撤销',
      success: (res) => {
        if(res.confirm) {
          const query = Bmob.Query('GameScore');
          query.get(id).then(item => {
            const currentTime = new Date();
            item.set('status', 'used');
            item.set('redeemedTime', currentTime); // 记录核销时间
            item.save().then(() => {
              wx.showToast({ title: '核销成功' });
              this.fetchMyPrizes(); // 刷新列表
            }).catch(err => {
              console.error('核销失败:', err);
              wx.showToast({
                title: '核销失败，请重试',
                icon: 'none'
              });
            });
          }).catch(err => {
            console.error('获取奖品信息失败:', err);
            wx.showToast({
              title: '操作失败，请重试',
              icon: 'none'
            });
          });
        }
      }
    })
  }

})
