// pages/prizes/prizes.js
var Bmob = require('../../utils/Bmob-2.6.3.min.js');
const app = getApp();

Page({
  data: {
    prizes: [],
    loading: true
  },
  
  onShow() {
    // 页面显示时自动拉取
    this.fetchMyPrizes();
  },
  
  fetchMyPrizes() {
    // [需求2] 获取全局 OpenID
    const openid = app.globalData.openid;
    
    if(!openid) {
      // 如果还没获取到 openid (比如刚进小程序就点奖品页，登录可能还没完成)
      // 可以稍微延迟一下重试，或者提示用户
      setTimeout(() => {
        if(app.globalData.openid) this.fetchMyPrizes();
        else {
          wx.showToast({ title: '登录信息加载中...', icon: 'loading' });
        }
      }, 1000);
      return;
    }

    wx.showLoading({title: '加载中'});
    
    const query = Bmob.Query("GameScore");
    // [需求3] 直接根据 openid 查询
    query.set("openid", openid);
    query.order("-createdAt");
    query.find().then(res => {
      res.forEach(item => {
        let d = new Date(item.createdAt);
        item.createTimeStr = `${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
        if(item.status === 'pending') item.statusText = '待使用';
        else if(item.status === 'used') item.statusText = '已使用';
        else item.statusText = '已失效';
      });
      this.setData({ prizes: res, loading: false });
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