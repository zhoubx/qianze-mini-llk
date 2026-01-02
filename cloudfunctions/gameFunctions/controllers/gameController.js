const { cloud } = require('../common/mysqlAndWxCloud')
const gameService = require('../services/gameService')

exports.submitGameScore = async (event) => {
  return await gameService.submitGameScore(event)
}

exports.getLeaderboard = async (event) => {
  const { limit = 50, timeLimit = 72, isAllTime = false } = event || {}
  const data = await gameService.getLeaderboard({ limit, timeLimit, isAllTime })
  return { success: true, data }
}
