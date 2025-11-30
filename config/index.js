/**
 * 项目统一配置文件
 * 集中管理所有配置项，便于维护和修改
 */

// ==================== 基础 URL 配置 ====================
const BASE_URL = {
  // 图片资源基础 URL
  IMAGE: 'http://qianze.xyz/images',
  // 音频资源基础 URL
  MUSIC: 'http://qianze.xyz/music'
};

// ==================== Bmob 配置 ====================
// ⚠️ 安全警告：API密钥暴露在客户端代码中
// 建议：生产环境应使用云函数获取密钥
const BMOB_CONFIG = {
  APPLICATION_ID: '4fa0f30d648a4b33',
  REST_API_KEY: '123zbx'
};

// ==================== 音频配置 ====================
const AUDIO_CONFIG = {
  // 背景音乐
  BGM: {
    EASY: `${BASE_URL.MUSIC}/bgm1.mp4`,
    MEDIUM: `${BASE_URL.MUSIC}/bgm2.mp4`,
    HARD: `${BASE_URL.MUSIC}/bgm3.mp3`,
    DEFAULT: `${BASE_URL.MUSIC}/bgm1.mp4`
  },
  // 音效
  EFFECTS: {
    VICTORY: `${BASE_URL.MUSIC}/victory.mp3`,
    GAME_START: `${BASE_URL.MUSIC}/ReadyGo.mp3`,
    GAME_QUIT: `${BASE_URL.MUSIC}/drop.mp3`,
    SHUFFLE: `${BASE_URL.MUSIC}/shuffle2.mp3`,
    MATCH: `${BASE_URL.MUSIC}/disappear.mp3`
  },
  // 音量设置 (范围 0-1)
  VOLUME: {
    BGM: 0.6,
    VICTORY: 0.6,
    GAME_START: 0.7,
    GAME_QUIT: 0.6,
    SHUFFLE: 1.0,
    MATCH: 1.0
  }
};

// ==================== 游戏图片配置 ====================
const GAME_IMAGES = [
  `${BASE_URL.IMAGE}/012.jpg?text=芊`,
  `${BASE_URL.IMAGE}/013.jpg?text=泽`,
  `${BASE_URL.IMAGE}/001.jpg`,
  `${BASE_URL.IMAGE}/002.jpg`,
  `${BASE_URL.IMAGE}/003.jpg`,
  `${BASE_URL.IMAGE}/004.jpg`,
  `${BASE_URL.IMAGE}/005.jpg`,
  `${BASE_URL.IMAGE}/006.jpg`,
  `${BASE_URL.IMAGE}/007.jpg`,
  `${BASE_URL.IMAGE}/008.jpg`,
  `${BASE_URL.IMAGE}/009.jpg`,
  `${BASE_URL.IMAGE}/010.jpg`,
  `${BASE_URL.IMAGE}/011.jpg`
];

// ==================== 排行榜配置 ====================
const LEADERBOARD_CONFIG = {
  // 排名统计的时间范围（小时）
  DURATION_HOURS: 72,
  // 查询限制数量
  QUERY_LIMIT: 500
};

// ==================== 难度配置 ====================
const DIFFICULTY_CONFIG = {
  // 难度选项（用于UI展示）
  OPTIONS: [
    {
      id: 'easy',
      class: 'diff-easy',
      title: '养生小白',
      badge: ' 简单',
      badgeClass: 'badge-easy',
      multiplier: 1.0,
      desc: '轻松休闲·重在参与（低保奖励）',
      icon: '🍵'
    },
    {
      id: 'medium',
      class: 'diff-med',
      title: '养生达人',
      badge: ' 普通',
      badgeClass: 'badge-med',
      multiplier: 1.3,
      desc: '进阶挑战·稳中求进（小富即安）',
      icon: '🌿'
    },
    {
      id: 'hard',
      class: 'diff-hard',
      title: '养生宗师',
      badge: ' 困难',
      badgeClass: 'badge-hard',
      multiplier: 1.6,
      desc: '极限手速·冲高夺冠（抢代金券）',
      icon: '🏆'
    }
  ],
  // 游戏棋盘配置
  BOARD: {
    easy: { rows: 2, cols: 2 },
    medium: { rows: 6, cols: 6 },
    hard: { rows: 8, cols: 6 }
  },
  // 难度文案映射
  TEXT_MAP: {
    'easy': '简单',
    'medium': '普通',
    'hard': '困难'
  }
};

// ==================== 奖品配置 ====================
const PRIZE_CONFIG = {
  // 奖品等级配置
  TIERS: [
    { rankEnd: 1, level: 1, name: '10元代金券' },
    { rankEnd: 3, level: 2, name: '8元代金券' },
    { rankEnd: 10, level: 3, name: '6元代金券' },
    { rankEnd: 20, level: 4, name: '4元代金券' },
    { rankEnd: 50, level: 5, name: '2元代金券' },
    { rankEnd: 9999, level: 6, name: '再接再厉' }
  ],
  // 无效奖品等级标记
  INVALID_LEVEL: 999,
  // 洗牌奖励分数
  SHUFFLE_BONUS: 50
};

// ==================== 默认头像配置 ====================
const AVATAR_CONFIG = {
  // 随机默认头像：直接复用 GAME_IMAGES（在 getRandomAvatar 函数中实现）
  // 排行榜默认头像：使用服务器图片
  DEFAULT: `${BASE_URL.IMAGE}/avatar_default.png`
};

// ==================== 辅助函数 ====================
/**
 * 获取随机默认头像（从游戏图片中随机选择）
 * @returns {string} 随机头像的 URL
 */
function getRandomAvatar() {
  return GAME_IMAGES[Math.floor(Math.random() * GAME_IMAGES.length)];
}

/**
 * 根据难度获取背景音乐 URL
 * @param {string} difficulty - 难度等级 (easy/medium/hard)
 * @returns {string} 音乐 URL
 */
function getBgmUrl(difficulty) {
  switch (difficulty) {
    case 'easy':
      return AUDIO_CONFIG.BGM.EASY;
    case 'medium':
      return AUDIO_CONFIG.BGM.MEDIUM;
    case 'hard':
      return AUDIO_CONFIG.BGM.HARD;
    default:
      return AUDIO_CONFIG.BGM.DEFAULT;
  }
}

// ==================== 导出配置 ====================
module.exports = {
  BASE_URL,
  BMOB_CONFIG,
  AUDIO_CONFIG,
  GAME_IMAGES,
  LEADERBOARD_CONFIG,
  DIFFICULTY_CONFIG,
  PRIZE_CONFIG,
  AVATAR_CONFIG,
  // 辅助函数
  getRandomAvatar,
  getBgmUrl
};

