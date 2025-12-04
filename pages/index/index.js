// index.js
const dateFormat = require('../../utils/dateFormat.js');
const config = require('../../config/index.js');
const { uploadAvatarIfNeeded } = require('../../utils/avatarUploader.js');
const app = getApp();

const db = wx.cloud.database();
const _ = db.command;

const { 
  GAME_IMAGES, 
  LEADERBOARD_CONFIG, 
  DIFFICULTY_CONFIG, 
  PRIZE_CONFIG, 
  SHARE_COUPON_CONFIG,
  AVATAR_CONFIG, 
  AUDIO_CONFIG,
  getRandomAvatar 
} = config;

// 消除音效
const matchCtx = wx.createInnerAudioContext();
matchCtx.src = AUDIO_CONFIG.EFFECTS.MATCH;
matchCtx.volume = AUDIO_CONFIG.VOLUME.MATCH;

Page({
  data: {
    isGameActive: false,
    showModal: false,
    showPostSubmitModal: false,
    avatarUrl: '',
    hasCustomAvatar: false,  // 标记用户是否有自定义头像
    diffConfig: DIFFICULTY_CONFIG.OPTIONS,
    config: DIFFICULTY_CONFIG.BOARD,
    prizeTiers: PRIZE_CONFIG.TIERS,
    rankList: [],
    domTiles: [],
    tileSize: '100rpx',
    cols: 4,
    timeDisplay: 0,
    liveScore: 0,
    tempScore: 0,
    tempTime: 0,
    myRank: '-',
    finalPrizeName: '',
    finalPrizeLevel: 6,
    inputName: '',
    bestScore: null,
    defaultAvatarUrl: AVATAR_CONFIG.DEFAULT,
    isRefreshing: false,
    submitting: false,
    shuffleToastText: '',
    shuffleToastVisible: false,
    // 分享代金券通知
    showShareRewardModal: false,
    newShareCouponCount: 0,
    newShareCouponAmount: 0
  },

  onLoad: function (options) {
    // 解析邀请来源参数
    if (options && options.inviteFrom) {
      app.globalData.inviteFrom = options.inviteFrom;
      console.log('页面参数检测到邀请来源:', options.inviteFrom);
    }
    this.fetchLeaderboard();
  },

  onShow: function () {
    if (app.globalData.needRefreshLeaderboard) {
      app.globalData.needRefreshLeaderboard = false;
      this.fetchLeaderboard();
    }
    
    const musicControl = this.selectComponent('#musicControl');
    if (musicControl) {
      musicControl.syncMusicStatus();
    }

    // 检查是否有新的分享代金券
    this.checkNewShareCoupons();
  },


  // [需求5, 6, 7] 修改排行榜获取逻辑：去重、取最高分、配置化时间
  // [重构] 用户信息从 UserInfo 表获取，通过 openid 关联
  async fetchLeaderboard() {
    // 开始刷新，显示加载动画
    this.setData({
      isRefreshing: true
    });

    try {
      // 1. 计算时间范围
      let date = new Date();
      date.setHours(date.getHours() - LEADERBOARD_CONFIG.DURATION_HOURS);

      // 2. 查询 GameScore 表获取排行榜数据 (云数据库版本)
      const gameScoresRes = await db.collection('GameScore')
        .where({
          createdAt: _.gte(date)
        })
        .orderBy('score', 'desc')
        .limit(LEADERBOARD_CONFIG.QUERY_LIMIT)
        .get();

      const gameScores = gameScoresRes.data;

      // 2. 数据处理：同一用户取最高分
      let userMap = {};
      let openidSet = new Set();

      gameScores.forEach(item => {
        let key = item._openid;
        if (!key) return; // 跳过没有 _openid 的记录

        openidSet.add(key);

        // 如果该用户还没记录，或者当前这条分数更高，则保存/更新
        if (!userMap[key] || item.score > userMap[key].score) {
          item.createTimeStr = dateFormat.formatDate(item.createdAt);
          item.diffText = DIFFICULTY_CONFIG.TEXT_MAP[item.difficulty] || '未知';
          userMap[key] = item;
        }
      });

      // 3. 批量查询 UserInfo 表获取用户信息
      const openidList = Array.from(openidSet);
      let userInfoMap = {};

      if (openidList.length > 0) {
        // 云数据库的 in 查询 (使用 _openid 字段)
        const userInfosRes = await db.collection('UserInfo')
          .where({
            _openid: _.in(openidList)
          })
          .limit(500)
          .get();

        // 收集需要转换的云文件 ID
        const cloudFileIds = [];
        userInfosRes.data.forEach(info => {
          if (info.avatarUrl && info.avatarUrl.startsWith('cloud://')) {
            cloudFileIds.push(info.avatarUrl);
          }
        });

        // 直接使用客户端API获取临时链接（云存储已设置为所有用户可读）
        let fileUrlMap = {};
        if (cloudFileIds.length > 0) {
          try {
            const tempUrlRes = await wx.cloud.getTempFileURL({
              fileList: cloudFileIds
            });
            tempUrlRes.fileList.forEach(file => {
              if (file.status === 0 && file.tempFileURL) {
                fileUrlMap[file.fileID] = file.tempFileURL;
              }
            });
          } catch (err) {
            console.warn('获取云文件临时链接失败:', err);
          }
        }

        userInfosRes.data.forEach(info => {
          let avatarUrl = info.avatarUrl || '';
          // 如果是云文件 ID，使用转换后的临时链接
          if (avatarUrl.startsWith('cloud://') && fileUrlMap[avatarUrl]) {
            avatarUrl = fileUrlMap[avatarUrl];
          }
          userInfoMap[info._openid] = {
            nickName: info.nickName || '匿名玩家',
            avatarUrl: avatarUrl
          };
        });
      }

      // 4. 合并数据：将用户信息添加到排行榜数据中
      let uniqueList = Object.values(userMap);
      uniqueList.forEach(item => {
        const userInfo = userInfoMap[item._openid] || {};
        item.playerName = userInfo.nickName || '匿名玩家';
        item.avatarUrl = userInfo.avatarUrl || '';
      });

      // 5. 按分数排序
      uniqueList.sort((a, b) => b.score - a.score);

      this.setData({
        rankList: uniqueList,
        isRefreshing: false
      });

    } catch (err) {
      console.error('获取排行榜失败:', err);
      wx.showToast({
        title: '获取排行榜失败',
        icon: 'none'
      });
      this.setData({
        isRefreshing: false
      });
    }
  },

  startGame(e) {
    let diff;
    if (typeof e === 'string') {
      diff = e;
    } else {
      diff = e.currentTarget.dataset.diff;
    }
    let conf = this.data.config[diff];

    // 切换难度背景音乐
    const app = getApp();
    app.switchDifficultyMusic(diff);

    // 播放开始游戏音效
    app.playGameStartSound();

    this.gameState = {
      diff: diff,
      rows: conf.rows,
      cols: conf.cols,
      totalPairs: (conf.rows * conf.cols) / 2,
      matchedPairs: 0,
      logicBoard: [],
      startTime: Date.now(),
      selected: null
    };


    clearInterval(this.timer);
    this.timer = setInterval(() => {
      let s = Math.floor((Date.now() - this.gameState.startTime) / 1000);
      let score = this.calculateScore(s, this.gameState.matchedPairs, this.gameState.bonusScore || 0);
      this.setData({
        timeDisplay: s,
        liveScore: score
      });
    }, 1000);

    let size = conf.clos > 6 ? '80rpx' : '100rpx';
    this.setData({
      isGameActive: true,
      cols: conf.cols,
      tileSize: size,
      timeDisplay: 0,
      liveScore: 0
    });
    this.initBoard();
  },

  initBoard() {
    let {
      rows,
      cols,
      totalPairs
    } = this.gameState;
    
    // 使用预加载后的游戏图片
    const images = GAME_IMAGES;
    
    let data = [];
    for (let i = 0; i < totalPairs; i++) data.push(i % images.length, i % images.length);
    data.sort(() => Math.random() - 0.5);

    let tr = rows + 2,
      tc = cols + 2;
    this.gameState.logicBoard = Array(tr).fill(null).map(() => Array(tc).fill(-1));

    let viewTiles = [];
    let idx = 0;

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        let type = data[idx++];
        this.gameState.logicBoard[r][c] = type;
        viewTiles.push({
          id: `${r}-${c}`,
          r,
          c,
          img: images[type],
          selected: false,
          matched: false,
          isPath: false
        });
      }
    }

    this.setData({
      domTiles: viewTiles
    });
    this.checkDeadlock(); // 初始死局检测
  },

  handleTileClick(e) {
    let {
      r,
      c
    } = e.currentTarget.dataset;
    let logicBoard = this.gameState.logicBoard;
    if (logicBoard[r][c] === -1) return;

    let tiles = this.data.domTiles;
    let idx = tiles.findIndex(t => t.r === r && t.c === c);
    let currentTile = tiles[idx];
    if (currentTile.matched) return;

    if (this.gameState.selected && this.gameState.selected.r === r && this.gameState.selected.c === c) {
      currentTile.selected = false;
      this.setData({
        domTiles: tiles
      });
      this.gameState.selected = null;
      return;
    }

    if (!this.gameState.selected) {
      currentTile.selected = true;
      this.gameState.selected = {
        r,
        c,
        idx
      };
      this.setData({
        domTiles: tiles
      });
    } else {
      let prev = this.gameState.selected;
      let prevTile = tiles[prev.idx];

      if (logicBoard[prev.r][prev.c] === logicBoard[r][c]) {
        let path = this.findPathBFS(prev.r, prev.c, r, c);
        if (path) {
          currentTile.selected = true;
          this.setData({
            domTiles: tiles
          });
          this.matchSuccess(prev, {
            r,
            c,
            idx
          }, path);
        } else {
          prevTile.selected = false;
          currentTile.selected = true;
          this.gameState.selected = {
            r,
            c,
            idx
          };
          this.setData({
            domTiles: tiles
          });
        }
      } else {
        prevTile.selected = false;
        currentTile.selected = true;
        this.gameState.selected = {
          r,
          c,
          idx
        };
        this.setData({
          domTiles: tiles
        });
      }
    }
  },

  matchSuccess(t1, t2, path) {
    let tiles = this.data.domTiles;

    // 💡 需求：消除音效
    matchCtx.stop();
    matchCtx.play();

    // 💡 需求：连线动画效果 (通过CSS类名 path-highlight 实现)
    path.forEach(p => {
      let pIdx = tiles.findIndex(t => t.r === p.r && t.c === p.c);
      if (pIdx > -1) tiles[pIdx].isPath = true;
    });
    this.setData({
      domTiles: tiles
    });

    setTimeout(() => {
      tiles.forEach(t => t.isPath = false);
      tiles[t1.idx].selected = false;
      tiles[t1.idx].matched = true;
      tiles[t2.idx].selected = false;
      tiles[t2.idx].matched = true;

      this.gameState.logicBoard[t1.r][t1.c] = -1;
      this.gameState.logicBoard[t2.r][t2.c] = -1;
      this.gameState.selected = null;
      this.gameState.matchedPairs++;

      this.setData({
        domTiles: tiles
      });

      if (this.gameState.matchedPairs >= this.gameState.totalPairs) {
        this.gameWin();
      } else {
        // 💡 Bug修复：消除后检测是否死局
        this.checkDeadlock();
      }
    }, 200);
  },

  // 💡 Bug修复：死局检测与自动洗牌
  checkDeadlock() {
    while (!this.hasMoves()) {
      // 播放洗牌音效
      const app = getApp();
      app.playShuffleSound();

      // 计算剩余方块数量
      const remainingTiles = this.data.domTiles.filter(t => !t.matched).length;
      
      // 根据难度从配置中获取洗牌加分
      const difficulty = this.gameState.diff;
      const bonusScore = PRIZE_CONFIG.SHUFFLE_BONUS[difficulty] || 0;
      
      // 生成提示文字
      const toastText = bonusScore > 0 
        ? `自动洗牌 +${bonusScore}分！` 
        : `自动洗牌（简单模式不加分）`;
      
      this.gameState.bonusScore = (this.gameState.bonusScore || 0) + bonusScore;

      // 使用自定义提示显示奖励信息
      this.showShuffleToast(toastText);

      this.shuffleBoard();
    }
  },

  // 显示洗牌奖励提示
  showShuffleToast(text) {
    this.setData({
      shuffleToastText: text,
      shuffleToastVisible: true
    });
    
    // 3秒后隐藏
    setTimeout(() => {
      this.setData({
        shuffleToastVisible: false
      });
      // 再等动画结束后清空文字
      setTimeout(() => {
        this.setData({
          shuffleToastText: ''
        });
      }, 300);
    }, 2000);
  },

  hasMoves() {
    let pts = [];
    let board = this.gameState.logicBoard;
    let rows = this.gameState.rows;
    let cols = this.gameState.cols;

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        if (board[r][c] !== -1) pts.push({
          r,
          c,
          type: board[r][c]
        });
      }
    }

    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (pts[i].type === pts[j].type) {
          // 这里使用简化版BFS只判断通不通，不求路径
          if (this.canConnectSimple(pts[i].r, pts[i].c, pts[j].r, pts[j].c)) return true;
        }
      }
    }
    return false;
  },

  canConnectSimple(r1, c1, r2, c2) {
    // 简化版BFS，逻辑同HTML版，略去具体实现以省篇幅，实际部署时请保留完整BFS逻辑
    return !!this.findPathBFS(r1, c1, r2, c2);
  },

  shuffleBoard() {
    let tiles = this.data.domTiles;
    let availableTiles = tiles.filter(t => !t.matched);
    let types = availableTiles.map(t => this.gameState.logicBoard[t.r][t.c]);

    types.sort(() => Math.random() - 0.5);

    // 使用预加载后的游戏图片
    const images = GAME_IMAGES;

    availableTiles.forEach((t, i) => {
      this.gameState.logicBoard[t.r][t.c] = types[i];
      // 更新视图
      let idx = tiles.findIndex(x => x.id === t.id);
      tiles[idx].img = images[types[i]];
      tiles[idx].selected = false;
    });

    this.gameState.selected = null;
    this.setData({
      domTiles: tiles
    });
  },

  findPathBFS(r1, c1, r2, c2) {
    let q = [{
      r: r1,
      c: c1,
      dir: 0,
      turns: 0,
      path: [{
        r: r1,
        c: c1
      }]
    }];
    let visited = new Set();
    const dr = [-1, 1, 0, 0],
      dc = [0, 0, -1, 1],
      dCode = [1, 2, 3, 4];
    let board = this.gameState.logicBoard;
    let rows = this.gameState.rows + 2;
    let cols = this.gameState.cols + 2;

    while (q.length > 0) {
      let cur = q.shift();
      for (let i = 0; i < 4; i++) {
        let nr = cur.r + dr[i],
          nc = cur.c + dc[i],
          ndir = dCode[i];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        let nturns = cur.turns + (cur.dir !== 0 && cur.dir !== ndir ? 1 : 0);
        if (nturns > 2) continue;
        let newPath = [...cur.path, {
          r: nr,
          c: nc
        }];
        if (nr === r2 && nc === c2) return newPath;
        if (board[nr][nc] !== -1) continue;
        let key = `${nr},${nc},${ndir},${nturns}`;
        if (visited.has(key)) continue;
        visited.add(key);
        q.push({
          r: nr,
          c: nc,
          dir: ndir,
          turns: nturns,
          path: newPath
        });
      }
    }
    return null;
  },

  calculateScore(s, p, bonusScore = 0) {
    if (s <= 0) s = 1;
    let mult = 1.0;
    this.data.diffConfig.forEach(d => {
      if (d.id === this.gameState.diff) mult = d.multiplier;
    });
    return Math.floor(((p * 1000) / s) * mult + bonusScore);
  },

  gameWin() {
    clearInterval(this.timer);
    let s = Math.floor((Date.now() - this.gameState.startTime) / 1000);
    let score = this.calculateScore(s, this.gameState.totalPairs, this.gameState.bonusScore || 0);

    let rank = 1;
    this.data.rankList.forEach(r => {
      if (r.score > score) rank++;
    });

    let prize = "再接再厉";
    let level = 6;
    for (let tier of this.data.prizeTiers) {
      if (rank <= tier.rankEnd) {
        prize = tier.name;
        level = tier.level;
        break;
      }
    }

    // 播放胜利音乐（挑战成功时播放）
    const app = getApp();
    app.playVictoryMusic();

    // 先尝试读取用户已保存的信息
    this.loadUserInfo().then(userInfo => {
      const storedBestScore = typeof userInfo.bestScore === 'number'
        ? userInfo.bestScore
        : (typeof this.data.bestScore === 'number' ? this.data.bestScore : null);
      let scoreBreakthrough = '';
      if (storedBestScore !== null && score > storedBestScore) {
        scoreBreakthrough = '🎉 打破个人最好成绩！';
      }

      // 判断用户是否有自定义头像
      const hasAvatar = !!userInfo.avatarUrl;

      this.setData({
        isGameActive: false,
        showModal: true,
        tempScore: score,
        tempTime: s,
        myRank: rank,
        finalPrizeName: prize,
        finalPrizeLevel: level,
        scoreBreakthrough: scoreBreakthrough,
        bestScore: storedBestScore,
        // 如果有保存的头像则使用，否则设为空（显示占位符）
        avatarUrl: userInfo.avatarUrl || '',
        hasCustomAvatar: hasAvatar,
        inputName: userInfo.nickName || ''
      });
    });

    // 冠军、亚军、季军显示庆祝动画
    if (rank <= 3) {
      const championCelebration = this.selectComponent('#championCelebration');
      if (championCelebration) {
        championCelebration.showCelebration(rank, prize);
      }
    }
  },

  onNameInput(e) {
    this.setData({
      inputName: e.detail.value
    });
  },

  // 处理微信头像选择
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (avatarUrl) {
      this.setData({
        avatarUrl: avatarUrl,
        hasCustomAvatar: true  // 用户选择了头像
      });
    }
  },

  // 从 UserInfo 表读取用户信息 (云数据库版本)
  async loadUserInfo() {
    try {
      const openid = app.globalData.openid;
      if (!openid) {
        return { avatarUrl: '', nickName: '', bestScore: null };
      }

      const res = await db.collection('UserInfo')
        .where({ _openid: openid })
        .get();

      if (res.data.length > 0) {
        const userInfo = res.data[0];
        const bestScore = typeof userInfo.bestScore === 'number' ? userInfo.bestScore : null;
        return {
          avatarUrl: userInfo.avatarUrl || '',
          nickName: userInfo.nickName || '',
          objectId: userInfo._id, // 云数据库使用 _id
          bestScore
        };
      }
      return { avatarUrl: '', nickName: '', bestScore: null };
    } catch (err) {
      console.error('读取用户信息失败:', err);
      return { avatarUrl: '', nickName: '', bestScore: null };
    }
  },

  // 保存用户信息到 UserInfo 表，并根据需要刷新 bestScore (云数据库版本)
  async saveUserInfo(nickName, avatarUrl, bestScoreCandidate = null) {
    try {
      const openid = app.globalData.openid;
      if (!openid) return;

      // 先查找是否已存在记录 (使用 _openid 字段)
      const res = await db.collection('UserInfo')
        .where({ _openid: openid })
        .get();

      if (res.data.length > 0) {
        // 更新现有记录
        const record = res.data[0];
        const updateData = {
          nickName: nickName,
          avatarUrl: avatarUrl,
          updatedAt: db.serverDate()
        };

        if (bestScoreCandidate !== null && bestScoreCandidate !== undefined) {
          const serverBestScore = typeof record.bestScore === 'number' ? record.bestScore : null;
          if (serverBestScore === null || bestScoreCandidate > serverBestScore) {
            updateData.bestScore = bestScoreCandidate;
          }
        }

        await db.collection('UserInfo').doc(record._id).update({
          data: updateData
        });
      } else {
        // 创建新记录 (_openid 会由云数据库自动添加)
        const newData = {
          nickName: nickName,
          avatarUrl: avatarUrl,
          createdAt: db.serverDate()
        };
        if (bestScoreCandidate !== null && bestScoreCandidate !== undefined) {
          newData.bestScore = bestScoreCandidate;
        }
        await db.collection('UserInfo').add({ data: newData });
      }
    } catch (err) {
      console.error('保存用户信息失败:', err);
    }
  },

  // 检查并为分享人发放代金券
  async checkAndGrantShareCoupon() {
    try {
      const inviteFrom = app.globalData.inviteFrom;
      const currentOpenid = app.globalData.openid;

      // 1. 检查是否有邀请来源
      if (!inviteFrom || !currentOpenid) {
        console.log('无邀请来源或当前用户openid未获取');
        return;
      }

      // 2. 不能自己邀请自己
      if (inviteFrom === currentOpenid) {
        console.log('不能自己邀请自己');
        return;
      }

      // 3. 检查是否已经有分享记录（防止重复奖励）
      const shareRecordRes = await db.collection('ShareRecords')
        .where({
          sharerOpenid: inviteFrom,
          inviteeOpenid: currentOpenid
        })
        .get();

      if (shareRecordRes.data.length > 0) {
        console.log('该邀请关系已存在记录，不重复发放');
        return;
      }

      // 4. 检查当前用户是否为新用户（首次提交成绩）
      // 查询该用户在本次之前是否有其他成绩记录
      const userScoresRes = await db.collection('GameScore')
        .where({ _openid: currentOpenid })
        .limit(2)
        .get();

      // 如果有超过1条记录，说明不是首次提交（刚提交的那条已存在）
      if (userScoresRes.data.length > 1) {
        console.log('非新用户，不发放代金券');
        return;
      }

      // 5. 检查分享人已获得的代金券数量是否达到上限
      const sharerCouponsRes = await db.collection('ShareCoupons')
        .where({ _openid: inviteFrom })
        .get();

      if (sharerCouponsRes.data.length >= SHARE_COUPON_CONFIG.MAX_COUNT) {
        console.log('分享人代金券数量已达上限:', SHARE_COUPON_CONFIG.MAX_COUNT);
        return;
      }

      // 6. 所有条件满足，创建代金券和分享记录
      // 创建分享记录
      await db.collection('ShareRecords').add({
        data: {
          sharerOpenid: inviteFrom,
          inviteeOpenid: currentOpenid,
          createdAt: db.serverDate()
        }
      });

      // 为分享人创建代金券（注意：这里需要用云函数来设置指定的 _openid）
      // 由于客户端无法直接设置其他用户的 _openid，我们使用 sharerOpenid 字段
      await db.collection('ShareCoupons').add({
        data: {
          sharerOpenid: inviteFrom,  // 代金券所有者
          amount: SHARE_COUPON_CONFIG.AMOUNT,
          status: 'pending',
          inviteeOpenid: currentOpenid,
          createdAt: db.serverDate()
        }
      });

      console.log('成功为分享人发放代金券:', inviteFrom);

      // 清除邀请来源，避免重复触发
      app.globalData.inviteFrom = null;

    } catch (err) {
      console.error('检查/发放分享代金券失败:', err);
    }
  },

  // 检查是否有新的分享代金券（用于通知分享人）
  async checkNewShareCoupons() {
    try {
      const openid = app.globalData.openid;
      if (!openid) {
        // openid 还没获取到，等待后重试
        setTimeout(() => {
          if (app.globalData.openid) this.checkNewShareCoupons();
        }, 1000);
        return;
      }

      // 获取上次检查时间
      const lastCheckTime = wx.getStorageSync('lastShareCouponCheckTime') || 0;
      const lastCheckDate = lastCheckTime ? new Date(lastCheckTime) : new Date(0);

      // 查询自上次检查以来新获得的代金券
      const res = await db.collection('ShareCoupons')
        .where({
          sharerOpenid: openid,
          createdAt: _.gt(lastCheckDate)
        })
        .get();

      if (res.data.length > 0) {
        // 计算总金额
        const totalAmount = res.data.reduce((sum, item) => sum + (item.amount || 0), 0);
        
        // 更新检查时间
        wx.setStorageSync('lastShareCouponCheckTime', Date.now());

        // 显示恭喜弹窗
        this.setData({
          showShareRewardModal: true,
          newShareCouponCount: res.data.length,
          newShareCouponAmount: totalAmount
        });
      }
    } catch (err) {
      console.error('检查新分享代金券失败:', err);
    }
  },

  // 关闭分享奖励弹窗
  closeShareRewardModal() {
    this.setData({
      showShareRewardModal: false
    });
  },

  // 从分享奖励弹窗前往我的奖品
  goToPrizesFromShareReward() {
    this.setData({
      showShareRewardModal: false
    });
    wx.navigateTo({
      url: '/pages/prizes/prizes'
    });
  },

  // 主要修改 submitScore 函数 (云数据库版本)
  // [需求1] 提交成绩：同级别奖品按分数高低PK
  async submitScore() {
    let name = this.data.inputName;
    if (!name) {
      wx.showToast({
        title: '请输入名字',
        icon: 'none'
      });
      return;
    }

    // 防止重复提交
    if (this.data.submitting) return;
    
    this.setData({ submitting: true });

    try {
      // 0. 如果用户没有选择头像，自动分配一个随机头像
      let finalAvatarUrl = this.data.avatarUrl;
      if (!this.data.hasCustomAvatar || !finalAvatarUrl) {
        finalAvatarUrl = getRandomAvatar();
        this.setData({ 
          avatarUrl: finalAvatarUrl,
          hasCustomAvatar: true 
        });
      }

      // 1. 上传头像获取永久 URL
      try {
        finalAvatarUrl = await uploadAvatarIfNeeded(finalAvatarUrl);
        // 如果上传成功且 URL 变了，更新 data
        if (finalAvatarUrl !== this.data.avatarUrl) {
          this.setData({ avatarUrl: finalAvatarUrl });
        }
      } catch (uploadErr) {
        console.error('头像上传失败，将使用临时路径继续:', uploadErr);
        // 即使上传失败也继续流程，避免卡死，虽然图片可能会失效
      }

      const app = getApp();
      const openid = app.globalData.openid;

      // 1. 查找旧的待使用奖品 (云数据库版本)
      let oldRecordsQuery = db.collection('GameScore')
        .where({
          status: 'pending'
        });
      
      if (openid) {
        oldRecordsQuery = db.collection('GameScore')
          .where({
            _openid: openid,
            status: 'pending'
          });
      }
      
      const oldRecordsRes = await oldRecordsQuery.get();
      const oldRecords = oldRecordsRes.data;

      let currentLevel = this.data.finalPrizeLevel;
      let currentScore = this.data.tempScore; // 获取当前分数
      let shouldSavePrize = true; // 是否保存奖品

      if (oldRecords.length > 0) {
        // 使用 Promise.all 确保所有异步操作完成，并添加错误处理
        const updatePromises = [];

        for (let record of oldRecords) {
          // 情况A: 新奖品等级更高 (数值更小) -> 旧奖品失效
          if (currentLevel < record.prizeLevel) {
            const updatePromise = db.collection('GameScore')
              .doc(record._id)
              .update({
                data: { status: 'expired' }
              })
              .catch(err => {
                console.error('更新旧奖品状态失败:', err);
                // 继续执行，不中断流程
              });
            updatePromises.push(updatePromise);
          }
          // 情况B: [新需求] 奖品等级相同 -> 比较分数
          else if (currentLevel === record.prizeLevel) {
            if (currentScore > record.score) {
              // 新分数更高 -> 旧奖品失效，保留新奖品
              const updatePromise = db.collection('GameScore')
                .doc(record._id)
                .update({
                  data: { status: 'expired' }
                })
                .catch(err => {
                  console.error('更新旧奖品状态失败:', err);
                  // 继续执行，不中断流程
                });
              updatePromises.push(updatePromise);
            } else {
              // 旧分数更高(或相等) -> 新奖品直接失效（使用配置文件中的常量）
              currentLevel = PRIZE_CONFIG.INVALID_LEVEL;
            }
          }
          // 情况C: 旧奖品等级更高 -> 新奖品直接失效
          else {
            currentLevel = PRIZE_CONFIG.INVALID_LEVEL;
          }
        }
        
        // 等待所有更新操作完成（即使有错误也继续）
        await Promise.allSettled(updatePromises);
      }

      // 3. 先保存用户信息到 UserInfo 表，并在需要时刷新 bestScore
      // 使用上传后的永久 URL
      await this.saveUserInfo(name, finalAvatarUrl, currentScore);

      // 4. 保存游戏记录到 GameScore 表（不再保存用户信息，只保留 openid 关联）
      // 如果 currentLevel 被标记为无效等级，说明PK输了，直接存为 expired
      // 如果 shouldSavePrize 为 false，说明奖品等级不足，设为 invalid
      let status = "pending";
      if (currentLevel === PRIZE_CONFIG.INVALID_LEVEL) {
        status = "expired";
      } else if (!shouldSavePrize) {
        status = "invalid";
      }

      const gameScoreData = {
        score: this.data.tempScore,
        timeCost: this.data.tempTime,
        difficulty: this.gameState.diff,
        prizeName: this.data.finalPrizeName,
        prizeLevel: this.data.finalPrizeLevel,
        rankSnapshot: this.data.myRank,
        status: status,
        createdAt: db.serverDate()
      };

      // _openid 会由云数据库自动添加，无需手动设置
      await db.collection('GameScore').add({ data: gameScoreData });

      // 检查是否需要为分享人发放代金券
      await this.checkAndGrantShareCoupon();

      // 本地同步 bestScore，便于下一次挑战使用
      const prevBestScore = typeof this.data.bestScore === 'number' ? this.data.bestScore : null;
      if (prevBestScore === null || currentScore > prevBestScore) {
        this.setData({ bestScore: currentScore });
      }

      wx.showToast({
        title: '上榜成功',
        icon: 'success'
      });

      // 显示后续操作选择弹窗
      this.setData({
        showModal: false,
        showPostSubmitModal: true,
      });
      this.fetchLeaderboard();

    } catch (err) {
      console.log(err);
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  backToMenu() {
    // 播放退出游戏音效
    const app = getApp();
    app.playGameQuitSound();

    clearInterval(this.timer);
    this.setData({
      isGameActive: false,
      showModal: false,
      showPostSubmitModal: false
    });
    this.fetchLeaderboard();
  },

  // 继续挑战
  continueChallenge() {
    this.setData({
      showPostSubmitModal: false
    });
    
    // 直接重新开始游戏 (使用当前难度)
    if (this.gameState && this.gameState.diff) {
      this.startGame(this.gameState.diff);
    } else {
      // Fallback: 重新开始游戏选择界面
      this.setData({
        isGameActive: false
      });
    }
  },

  // 我的奖品
  viewPrizes() {
    this.setData({
      showPostSubmitModal: false
    });
    wx.navigateTo({
      url: '/pages/prizes/prizes'
    });
  },

  // 进店看看
  visitStore() {
    this.setData({
      showPostSubmitModal: false
    });
    
    // 跳转到美团小程序 - 门店详情页
    wx.navigateToMiniProgram({
      appId: 'wxde8ac0a21135c07d', // 美团小程序的 appId
      path: 'service-retail-poi/pages/poi/index?entrypoint=channel&id=932031008&pricecipher=vH4THqgHbPMHcB_0K6VVVionFo5BRsk9elX3jodyFoVa4Ok_vkJRXcQ68A48qFYBXeqakTylckRG7c0aJMsG9gz_NQ8_i0hGJhlCL1iEj1ZDQsJwjyMolP5vYHR-KwKkMPdLjkmpkC3qNGfQEOarC7catVQGplHT0_jjfG5fMbPoqbXwaA0ghw1Ox9bM4FrM0dtbw7mPGX9AlDHVIxbVih0HGzmO0pr4pWMwKbWuftzZkrwvr3f365vU8IKzhc5x0UPtjszVSYL8hkvTXUzrbxmnBa5TqjwqZIxD74EPZNBUe2i-IGbSE_ml2NyRwaHV52nLacxyTIcGLzuL3E6yACgn3ll6pXBxVD9otTVtn2sepvTwukfwLSpCbQaUhu_x5MElEokVala5owiy5hs0VezPXY6NvAssZyCXDrlj5ldeFEEY5nJK8ZGnlbuf34X-5QA4zgDj_MxNhi7zkqpdIKNnUb63c4l9Msb3q_JScjdacQuaHeFkeellgU_cdpAdcidUv47VlS148uT740nFZ0gmf3iiqf2ekw4Az1_mijqrziH5loLAPnG8qO3lABCfy0I6EvJK5MRHaj9z9BAMUZEZLLm2Uvi-s_gZak86NsQjonKiadtgxDVNXbS1Ii9h',
      envVersion: 'release', // 正式版
      success: function(res) {
        console.log('跳转美团小程序成功', res);
      },
      fail: function(err) {
        console.error('跳转美团小程序失败', err);
        wx.showToast({
          title: '跳转失败，请稍后重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 关闭后续操作弹窗
  closePostSubmitModal() {
    this.setData({
      showPostSubmitModal: false
    });
  },

  // 页面卸载时清理资源，防止内存泄漏
  onUnload() {
    // 清除定时器
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    // 停止消除音效（matchCtx 是本文件的模块级变量）
    if (matchCtx) {
      matchCtx.stop();
    }
    // 注意：bgmCtx 是 app.js 中的全局变量，不应在此处直接访问
    // 全局背景音乐由 app.js 统一管理，无需在页面卸载时停止
  },

  // 分享给好友
  onShareAppMessage() {
    let title = '快来挑战芊泽风云榜，赢取大奖！';
    let path = '/pages/index/index';
    
    // 携带邀请来源参数（分享人的openid）
    const openid = app.globalData.openid;
    if (openid) {
      path = `/pages/index/index?inviteFrom=${openid}`;
    }
    
    // 如果是在挑战成功弹窗中分享，带上战绩信息
    if (this.data.showModal && this.data.tempScore) {
      title = `我以 ${this.data.tempScore} 分赢得了【${this.data.finalPrizeName}】，排名第 ${this.data.myRank}！不服来战！`;
    }
    
    return {
      title: title,
      path: path,
      imageUrl: config.SHARE_IMAGE
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    let title = '快来挑战芊泽风云榜，赢取大奖！';
    if (this.data.showModal && this.data.tempScore) {
      title = `我以 ${this.data.tempScore} 分赢得了【${this.data.finalPrizeName}】，排名第 ${this.data.myRank}！`;
    }
    
    // 携带邀请来源参数（分享人的openid）
    let query = '';
    const openid = app.globalData.openid;
    if (openid) {
      query = `inviteFrom=${openid}`;
    }
    
    return {
      title: title,
      query: query,
      imageUrl: config.SHARE_IMAGE
    };
  },


  // 在 index.js 中添加（正式上线前删除）
  debugClearData() {
    console.log("调用ClearData函数");
    // return; // 已禁用：正式上线前应删除此函数
    wx.showModal({
      title: '警告',
      content: '确定要清空分享相关数据吗？',
      success: async (res) => {
        if (res.confirm) {
          await wx.cloud.callFunction({
            name: 'clearCollection',
            data: { collection: 'GameScore' }
          })
          await wx.cloud.callFunction({
            name: 'clearCollection',
            data: { collection: 'UserInfo' }
          })
          await wx.cloud.callFunction({
            name: 'clearCollection',
            data: { collection: 'ShareCoupons' }
          })
          await wx.cloud.callFunction({
            name: 'clearCollection',
            data: { collection: 'ShareRecords' }
          })
          // 清除本地检查时间
          wx.removeStorageSync('lastShareCouponCheckTime')
          wx.showToast({ title: '已清空' })
        }
      }
    })
  }

});
