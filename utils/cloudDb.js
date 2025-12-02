/**
 * 云数据库操作封装工具
 * 提供统一的数据库操作接口，替代 Bmob SDK
 */

// 获取数据库引用
const db = wx.cloud.database();
const _ = db.command;

/**
 * 查询数据
 * @param {string} collection 集合名称
 * @param {object} options 查询选项
 * @param {object} options.where 查询条件
 * @param {object} options.orderBy 排序 { field: 'fieldName', order: 'asc'|'desc' }
 * @param {number} options.limit 限制数量，默认 100
 * @param {number} options.skip 跳过数量，默认 0
 * @returns {Promise<Array>} 查询结果数组
 */
async function query(collection, options = {}) {
  const { where, orderBy, limit = 100, skip = 0 } = options;
  
  let q = db.collection(collection);
  
  if (where) {
    q = q.where(where);
  }
  
  if (orderBy) {
    q = q.orderBy(orderBy.field, orderBy.order || 'asc');
  }
  
  q = q.skip(skip).limit(limit);
  
  const res = await q.get();
  return res.data;
}

/**
 * 根据 ID 获取单条记录
 * @param {string} collection 集合名称
 * @param {string} id 文档 ID
 * @returns {Promise<object>} 文档数据
 */
async function getById(collection, id) {
  const res = await db.collection(collection).doc(id).get();
  return res.data;
}

/**
 * 新增数据
 * @param {string} collection 集合名称
 * @param {object} data 要添加的数据
 * @returns {Promise<object>} 包含新文档 ID 的对象
 */
async function add(collection, data) {
  // 自动添加创建时间
  const dataWithTime = {
    ...data,
    createdAt: db.serverDate()
  };
  const res = await db.collection(collection).add({ data: dataWithTime });
  return { _id: res._id, ...dataWithTime };
}

/**
 * 更新数据
 * @param {string} collection 集合名称
 * @param {string} id 文档 ID
 * @param {object} data 要更新的数据
 * @returns {Promise<object>} 更新结果
 */
async function update(collection, id, data) {
  // 自动添加更新时间
  const dataWithTime = {
    ...data,
    updatedAt: db.serverDate()
  };
  await db.collection(collection).doc(id).update({ data: dataWithTime });
  return { _id: id };
}

/**
 * 删除数据
 * @param {string} collection 集合名称
 * @param {string} id 文档 ID
 * @returns {Promise<void>}
 */
async function remove(collection, id) {
  await db.collection(collection).doc(id).remove();
}

/**
 * 查询某字段值在数组中的记录 (替代 Bmob containedIn)
 * @param {string} collection 集合名称
 * @param {string} field 字段名
 * @param {Array} values 值数组
 * @param {object} options 其他查询选项
 * @returns {Promise<Array>} 查询结果数组
 */
async function queryIn(collection, field, values, options = {}) {
  const where = { [field]: _.in(values) };
  return query(collection, { ...options, where: { ...options.where, ...where } });
}

/**
 * 条件查询 - 大于等于
 * @param {*} value 比较值
 * @returns {object} 查询条件
 */
function gte(value) {
  return _.gte(value);
}

/**
 * 条件查询 - 小于等于
 * @param {*} value 比较值
 * @returns {object} 查询条件
 */
function lte(value) {
  return _.lte(value);
}

/**
 * 条件查询 - 包含于
 * @param {Array} values 值数组
 * @returns {object} 查询条件
 */
function inArray(values) {
  return _.in(values);
}

/**
 * 获取服务端时间
 * @returns {object} 服务端时间对象
 */
function serverDate() {
  return db.serverDate();
}

module.exports = {
  db,
  _,
  query,
  getById,
  add,
  update,
  remove,
  queryIn,
  gte,
  lte,
  inArray,
  serverDate
};

