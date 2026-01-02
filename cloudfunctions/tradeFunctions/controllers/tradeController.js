const { cloud } = require('../common/mysqlAndWxCloud')
const tradeService = require('../services/tradeService')

exports.getUserPrizes = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  return await tradeService.getUserPrizes(openid)
}

exports.redeemPrize = async (event) => {
  const { id, collection, password } = event || {}
  return await tradeService.redeemPrize({ id, collection, password })
}

exports.redeemShareCoupon = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { couponId } = event || {}
  return await tradeService.redeemShareCoupon({ openid, couponId })
}
