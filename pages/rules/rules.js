
// pages/rules/rules.js
Page({

  /**
   * 页面的初始数据
   */
  data: {

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