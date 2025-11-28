// pages/prizes/prizes.js
var Bmob = require('../../utils/Bmob-2.6.3.min.js');
const app = getApp();

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
    query.set("openid", openid);
    // 这里先按时间倒序查出来，然后在前端做复杂的“状态排序”
    query.order("-createdAt"); 
    query.find().then(res => {
      
      // [需求1] 数据处理：格式化时间 + 排序
      let list = res.map(item => {
        // 时间格式化 mm-dd HH:mm
        let d = new Date(item.createdAt);
        let m = (d.getMonth()+1).toString().padStart(2, '0');
        let day = d.getDate().toString().padStart(2, '0');
        let h = d.getHours().toString().padStart(2, '0');
        let min = d.getMinutes().toString().padStart(2, '0');
        item.createTimeStr = `${m}-${day} ${h}:${min}`;

        // 状态文案
        if(item.status === 'pending') item.statusText = '待使用';
        else if(item.status === 'used') item.statusText = '已使用';
        else item.statusText = '已失效';
        
        return item;
      });

      // [需求1] 排序：可用的排在最前面，剩下的按时间倒序
      list.sort((a, b) => {
        // 定义权重：pending(0) < 其他(1)
        let weightA = a.status === 'pending' ? 0 : 1;
        let weightB = b.status === 'pending' ? 0 : 1;
        
        if (weightA !== weightB) {
          return weightA - weightB; // 权重小的在前
        } else {
          // 权重相同（都是待使用，或者都是已失效），按时间倒序
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