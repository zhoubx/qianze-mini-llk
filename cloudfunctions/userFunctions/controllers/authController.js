const { cloud } = require('../common/mysqlAndWxCloud')

exports.login = async () => {
  const wxContext = cloud.getWXContext()
  return {
    success: true,
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID
  }
}
