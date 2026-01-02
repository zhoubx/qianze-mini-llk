/**
 * 公共数据库工具模块
 * 提供连接池管理、简单查询、事务操作
 */
const mysql = require('mysql2/promise')
const cloud = require('wx-server-sdk')

// 初始化云环境（假设宿主环境已配置，或者使用默认环境）
// 注意：在 common 被 require 时，cloud 可能还没被宿主 init。
// 所以我们将 cloud.init 延迟到调用时，或者假设宿主已经 init。
// 安全起见，我们在获取配置前尝试 init 一次，或者直接使用 cloud.database()
// 通常建议由宿主云函数负责 cloud.init()

// 连接池（模块级别单例）
let pool = null
let initPromise = null

/**
 * 从云数据库加载 MySQL 配置
 */
const loadConfigFromDB = async () => {
  try {
    // 强制初始化云环境，确保 API 可用
    // 使用 DYNAMIC_CURRENT_ENV 自动适配当前环境
    cloud.init({
      env: cloud.DYNAMIC_CURRENT_ENV
    })

    const db = cloud.database()
    const res = await db.collection('appConfig').doc('mysql_config').get()
    
    if (!res.data) {
      throw new Error('配置不存在: app_config/mysql_config')
    }

    const config = res.data
    return {
      host: config.host,
      port: Number(config.port || 3306),
      user: config.user,
      password: config.password,
      database: config.database,
      dateStrings: true,
      waitForConnections: true,
      connectionLimit: Number(config.connectionLimit || 3),
      queueLimit: Number(config.queueLimit || 10),
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      idleTimeout: 60000
    }
  } catch (err) {
    console.error('加载数据库配置失败:', err)
    throw new Error(`加载数据库配置失败: ${err.message}`)
  }
}

/**
 * 获取数据库连接池（异步）
 */
const getPool = async () => {
  if (pool) return pool
  
  // 防止并发初始化
  if (initPromise) return initPromise

  initPromise = (async () => {
    const config = await loadConfigFromDB()
    // 简单校验
    if (!config.host || !config.user || !config.password || !config.database) {
        throw new Error('MySQL 配置不完整')
    }
    const newPool = mysql.createPool(config)
    pool = newPool
    return newPool
  })()

  try {
    return await initPromise
  } catch (e) {
    initPromise = null // 失败重置，允许重试
    throw e
  }
}

/**
 * 执行简单查询（自动管理连接）
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Promise<Array>} 查询结果
 */
const query = async (sql, params = []) => {
  const p = await getPool()
  const [rows] = await p.query(sql, params)
  return rows
}

/**
 * 执行更新/插入操作（返回完整结果）
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Promise<Object>} 包含 affectedRows, insertId 等
 */
const execute = async (sql, params = []) => {
  const p = await getPool()
  const [result] = await p.execute(sql, params)
  return result
}

/**
 * 执行事务操作
 * @param {Function} callback - 接收 connection 参数的异步函数
 * @returns {Promise<any>} callback 的返回值
 */
const transaction = async (callback) => {
  const p = await getPool()
  const connection = await p.getConnection()

  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (err) {
    await connection.rollback()
    throw err
  } finally {
    connection.release()
  }
}

module.exports = {
  query,
  execute,
  transaction,
  getPool,
  // 导出 cloud 实例，供主函数使用
  cloud
}

