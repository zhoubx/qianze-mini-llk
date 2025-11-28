// app.js
var Bmob = require('utils/Bmob-2.6.3.min.js');

// 初始化 Bmob
Bmob.initialize("4fa0f30d648a4b33", "123zbx");

App({
  globalData: {
    openid: null,
    userInfo: null
  },
  onLaunch: function () {
    // 一键登录获取 OpenID
    Bmob.User.auth().then(res => {
      console.log('登录成功', res);
      // [需求2] 保存 OpenID 到全局
      this.globalData.openid = res.authData.weapp.openid;
    }).catch(err => {
      console.log('登录失败', err);
    });
  }
})