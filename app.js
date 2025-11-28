// app.js
var Bmob = require('utils/Bmob-2.6.3.min.js');

// 初始化 Bmob
Bmob.initialize("4fa0f30d648a4b33", "123zbx");

App({
  onLaunch: function () {
    // 一键登录获取 OpenID
    Bmob.User.auth().then(res => {
      console.log('登录成功', res);
      // res.openid 就是用户的唯一标识
      // 用户信息已缓存在本地，后续页面可以直接调用 Bmob.User.current()
    }).catch(err => {
      console.log('登录失败', err);
    });
  }
})