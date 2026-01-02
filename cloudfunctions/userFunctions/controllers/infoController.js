const { cloud } = require('../common/mysqlAndWxCloud')

const userService = require('../services/userService')

exports.getUserInfo = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const data = await userService.getUserInfo(openid)
  return { success: true, data }
}

exports.saveUserInfo = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { nickName, avatarUrl, bestScoreCandidate } = event || {}
  const result = await userService.saveUserInfo(openid, { nickName, avatarUrl, bestScoreCandidate })
  return result
}
