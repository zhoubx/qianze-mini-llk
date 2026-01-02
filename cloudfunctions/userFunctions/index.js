const { cloud } = require('./common/mysqlAndWxCloud')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const authController = require('./controllers/authController')
const infoController = require('./controllers/infoController')

const routes = {
  login: authController.login,
  getUserInfo: infoController.getUserInfo,
  saveUserInfo: infoController.saveUserInfo
}

exports.main = async (event, context) => {
  const action = event && event.action
  const handler = routes[action]
  if (!handler) {
    return { success: false, message: `unknown action: ${action}` }
  }
  try {
    return await handler(event, context)
  } catch (err) {
    return { success: false, message: err.message || String(err) }
  }
}
