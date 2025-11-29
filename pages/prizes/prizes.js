// pages/prizes/prizes.js
var Bmob = require('../../utils/Bmob-2.6.3.min.js');
const dateFormat = require('../../utils/dateFormat.js'); // 引入日期格式化工具
const app = getApp();

const DIFF_MAP = {
  'easy': '小白',
  'medium': '达人',
  'hard': '宗师'
};

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
            item.set('status', 'used');
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