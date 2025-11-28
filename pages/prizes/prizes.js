var Bmob = require('../../utils/Bmob-2.6.3.min.js');

Page({
  data: {
    queryName: '',
    prizes: []
  },
  onInput(e) { this.setData({queryName: e.detail.value}) },
  
  fetchPrizes() {
    if(!this.data.queryName) return;
    wx.showLoading();
    const query = Bmob.Query("GameScore");
    query.equalTo("playerName", this.data.queryName);
    query.order("-createdAt");
    query.find().then(res => {
      res.forEach(item => {
        let d = new Date(item.createdAt);
        item.createTimeStr = `${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
        if(item.status === 'pending') item.statusText = '待使用';
        else if(item.status === 'used') item.statusText = '已使用';
        else item.statusText = '已失效';
      });
      this.setData({ prizes: res });
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
              this.fetchPrizes();
            });
          });
        }
      }
    })
  }
})