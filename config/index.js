/**
 * 项目统一配置文件
 * 集中管理所有配置项，便于维护和修改
 */

// ==================== 云开发配置 ====================
const CLOUD_CONFIG = {
  ENV_ID: 'cloud1-5gcovdng3cfbf3ee'
};

// 云存储基础路径
const CLOUD_BASE_URL = 'cloud://cloud1-5gcovdng3cfbf3ee.636c-cloud1-5gcovdng3cfbf3ee-1390068510';

// ==================== 游戏图片配置 ====================
const GAME_IMAGES = [
  `${CLOUD_BASE_URL}/images/012.jpg`,
  `${CLOUD_BASE_URL}/images/013.jpg`,
  `${CLOUD_BASE_URL}/images/001.jpg`,
  `${CLOUD_BASE_URL}/images/002.jpg`,
  `${CLOUD_BASE_URL}/images/003.jpg`,
  `${CLOUD_BASE_URL}/images/004.jpg`,
  `${CLOUD_BASE_URL}/images/005.jpg`,
  `${CLOUD_BASE_URL}/images/006.jpg`,
  `${CLOUD_BASE_URL}/images/007.jpg`,
  `${CLOUD_BASE_URL}/images/008.jpg`,
  `${CLOUD_BASE_URL}/images/009.jpg`,
  `${CLOUD_BASE_URL}/images/010.jpg`,
  `${CLOUD_BASE_URL}/images/011.jpg`
];

// ==================== 音频配置 ====================
const AUDIO_CONFIG = {
  BGM: {
    EASY: `${CLOUD_BASE_URL}/music/bgm1.mp4`,
    MEDIUM: `${CLOUD_BASE_URL}/music/bgm2.mp4`,
    HARD: `${CLOUD_BASE_URL}/music/bgm3.mp3`,
    DEFAULT: `${CLOUD_BASE_URL}/music/bgm1.mp4`
  },
  EFFECTS: {
    VICTORY: `${CLOUD_BASE_URL}/music/victory.mp3`,
    GAME_START: `${CLOUD_BASE_URL}/music/ReadyGo.mp3`,
    GAME_QUIT: `${CLOUD_BASE_URL}/music/drop.mp3`,
    SHUFFLE: `${CLOUD_BASE_URL}/music/shuffle2.mp3`,
    MATCH: `${CLOUD_BASE_URL}/music/disappear.mp3`
  },
  VOLUME: {
    BGM: 0.6,
    VICTORY: 0.6,
    GAME_START: 0.7,
    GAME_QUIT: 0.6,
    SHUFFLE: 1.0,
    MATCH: 1.0
  }
};

// ==================== 排行榜配置 ====================
const LEADERBOARD_CONFIG = {
  DURATION_HOURS: 72,
  QUERY_LIMIT: 500
};

// ==================== 难度配置 ====================
const DIFFICULTY_CONFIG = {
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
  BOARD: {
    easy: { rows: 6, cols: 4 },
    medium: { rows: 6, cols: 6 },
    hard: { rows: 8, cols: 6 }
  },
  TEXT_MAP: {
    'easy': '简单',
    'medium': '普通',
    'hard': '困难'
  }
};

// ==================== 奖品配置 ====================
const PRIZE_CONFIG = {
  TIERS: [
    { rankEnd: 1, level: 1, name: '10元代金券' },
    { rankEnd: 3, level: 2, name: '8元代金券' },
    { rankEnd: 10, level: 3, name: '6元代金券' },
    { rankEnd: 20, level: 4, name: '4元代金券' },
    { rankEnd: 50, level: 5, name: '2元代金券' },
    { rankEnd: 9999, level: 6, name: '再接再厉' }
  ],
  INVALID_LEVEL: 999,
  SHUFFLE_BONUS: {
    easy: 0,
    medium: 50,
    hard: 100
  }
};

// ==================== 分享代金券配置 ====================
const SHARE_COUPON_CONFIG = {
  AMOUNT: 5,           // 代金券金额（元）
  MAX_COUNT: 5         // 每人最多获得数量
};

// ==================== 默认头像配置 ====================
const AVATAR_CONFIG = {
  DEFAULT: `${CLOUD_BASE_URL}/images/avatar_default.png`
};

// ==================== 辅助函数 ====================
function getRandomAvatar() {
  return GAME_IMAGES[Math.floor(Math.random() * GAME_IMAGES.length)];
}

function getBgmUrl(difficulty) {
  return AUDIO_CONFIG.BGM[difficulty.toUpperCase()] || AUDIO_CONFIG.BGM.DEFAULT;
}

// ==================== 导出配置 ====================
module.exports = {
  CLOUD_CONFIG,
  CLOUD_BASE_URL,
  AUDIO_CONFIG,
  GAME_IMAGES,
  LEADERBOARD_CONFIG,
  DIFFICULTY_CONFIG,
  PRIZE_CONFIG,
  SHARE_COUPON_CONFIG,
  AVATAR_CONFIG,
  SHARE_IMAGE: '/images/share-landing.png',
  getRandomAvatar,
  getBgmUrl
};
