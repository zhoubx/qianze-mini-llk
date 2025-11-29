// pages/prizes/prizes.js
var Bmob = require('../../utils/Bmob-2.6.3.min.js');
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
        // 时间格式化 mm-dd HH:mm
        // [核心修复] iOS 日期格式兼容
        let timeStr = item.createdAt.replace(/-/g, '/');
        let d = new Date(timeStr);
        
        let m = (d.getMonth()+1).toString().padStart(2, '0');
        let day = d.getDate().toString().padStart(2, '0');
        let h = d.getHours().toString().padStart(2, '0');
        let min = d.getMinutes().toString().padStart(2, '0');
        item.createTimeStr = `${m}-${day} ${h}:${min}`;

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
      console.log(err);
      wx.hideLoading();
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
            });
          });
        }
      }
    })
  }

})