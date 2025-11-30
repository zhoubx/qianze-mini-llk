// index.js
var Bmob = require('../../utils/Bmob-2.6.3.min.js'); // 引入SDK
const dateFormat = require('../../utils/dateFormat.js'); // 引入日期格式化工具
const config = require('../../config/index.js'); // 引入配置文件
const app = getApp();

// 从配置文件获取配置项
const { 
  GAME_IMAGES, 
  LEADERBOARD_CONFIG, 
  DIFFICULTY_CONFIG, 
  PRIZE_CONFIG, 
  AVATAR_CONFIG, 
  AUDIO_CONFIG,
  getRandomAvatar 
} = config;

// 消除音效上下文
const matchCtx = wx.createInnerAudioContext();
matchCtx.src = AUDIO_CONFIG.EFFECTS.MATCH;
matchCtx.volume = AUDIO_CONFIG.VOLUME.MATCH;

Page({
  data: {
    isGameActive: false,
    showModal: false,
    showPostSubmitModal: false,
    avatarUrl: getRandomAvatar(), // 默认随机头像
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
    wechatNickName: '', // 新增：用于存储获取到的微信昵称
    isUsingWechatNick: false, // 新增：标记是否使用了微信昵称
    defaultAvatarUrl: AVATAR_CONFIG.DEFAULT, // 排行榜默认头像
    isRefreshing: false // 新增：标记是否正在刷新排行榜
  },

  onLoad: function () {
    this.fetchLeaderboard();
  },

  onShow: function () {
    // 同步音乐状态，确保页面显示时音乐组件状态正确
    const musicControl = this.selectComponent('#musicControl');
    if (musicControl) {
      musicControl.syncMusicStatus();
    }
  },


  // [需求5, 6, 7] 修改排行榜获取逻辑：去重、取最高分、配置化时间
  // [Bug修复] 修复 iOS 日期解析问题
  fetchLeaderboard() {
    // 开始刷新，显示加载动画
    this.setData({
      isRefreshing: true
    });

    const query = Bmob.Query("GameScore");

    let date = new Date();
    date.setHours(date.getHours() - LEADERBOARD_CONFIG.DURATION_HOURS);
    query.equalTo("createdAt", ">", date.toISOString());
    query.order("-score");
    query.limit(LEADERBOARD_CONFIG.QUERY_LIMIT);

    query.find().then(res => {
      let userMap = {}; // 数据处理：同一用户取最高分

      res.forEach(item => {
        let key = item.openid || item.playerName;

        // 如果该用户还没记录，或者当前这条分数更高，则保存/更新
        if (!userMap[key] || item.score > userMap[key].score) {
          // 使用统一的日期格式化工具函数
          item.createTimeStr = dateFormat.formatDate(item.createdAt);

          userMap[key] = item;
        }
      });

      let uniqueList = Object.values(userMap);
      uniqueList.sort((a, b) => b.score - a.score);
      let finalRankList = uniqueList;

      this.setData({
        rankList: finalRankList,
        isRefreshing: false // 刷新完成，隐藏加载动画
      });
    }).catch(err => {
      console.error('获取排行榜失败:', err);
      wx.showToast({
        title: '获取排行榜失败',
        icon: 'none'
      });
      this.setData({
        isRefreshing: false // 刷新失败，也要隐藏加载动画
      });
    });
  },

  startGame(e) {
    let diff = e.currentTarget.dataset.diff;
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

    let size = conf.rows >= 8 ? '80rpx' : '100rpx';
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
    let data = [];
    for (let i = 0; i < totalPairs; i++) data.push(i % GAME_IMAGES.length, i % GAME_IMAGES.length);
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
          img: GAME_IMAGES[type],
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

      // 给予分数奖励（使用配置文件中的值）
      const bonusScore = PRIZE_CONFIG.SHUFFLE_BONUS;
      this.gameState.bonusScore = (this.gameState.bonusScore || 0) + bonusScore;

      // 醒目显示奖励信息（不打断游戏节奏）
      wx.showToast({
        title: `🔄 自动洗牌 +${bonusScore}分奖励！`,
        icon: 'none',
        duration: 3000,
        mask: false
      });

      this.shuffleBoard();
    }
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

    availableTiles.forEach((t, i) => {
      this.gameState.logicBoard[t.r][t.c] = types[i];
      // 更新视图
      let idx = tiles.findIndex(x => x.id === t.id);
      tiles[idx].img = GAME_IMAGES[types[i]];
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

    // 检查是否打破个人最好成绩
    let scoreBreakthrough = '';
    const userHistory = wx.getStorageSync('userHistory') || {};
    if (userHistory.bestScore && score > userHistory.bestScore) {
      scoreBreakthrough = '🎉 打破个人最好成绩！';
    }

    // 播放胜利音乐（挑战成功时播放）
    const app = getApp();
    app.playVictoryMusic();

    this.setData({
      isGameActive: false,
      showModal: true,
      tempScore: score,
      tempTime: s,
      myRank: rank,
      finalPrizeName: prize,
      finalPrizeLevel: level,
      scoreBreakthrough: scoreBreakthrough
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

  // 主要修改 submitScore 函数
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

    try {
      const app = getApp();
      const openid = app.globalData.openid;

      // 1. 查找旧的待使用奖品
      const queryOld = Bmob.Query("GameScore");
      if (openid) {
        queryOld.equalTo("openid", "==", openid);
      } else {
        queryOld.equalTo("playerName", "==", name);
      }
      queryOld.equalTo("status", "==", "pending");
      const oldRecords = await queryOld.find();

      let currentLevel = this.data.finalPrizeLevel;
      let currentScore = this.data.tempScore; // 获取当前分数
      let shouldSavePrize = true; // 是否保存奖品

      if (oldRecords.length > 0) {
        // 检查是否有更高等级的奖品
        const highestExistingLevel = Math.min(...oldRecords.map(r => r.prizeLevel));

        // 如果当前奖品等级低于现有奖品等级，则不保存
        if (currentLevel > highestExistingLevel) {
          wx.showModal({
            title: '奖品等级不足',
            content: '您当前已有更高等级的奖品，本次奖品将不予保存。如需领取本次奖品，请先使用现有的高等级奖品。',
            showCancel: false,
            confirmText: '知道了'
          });
          shouldSavePrize = false;
        }

        // 使用 Promise.all 确保所有异步操作完成，并添加错误处理
        const updatePromises = [];

        for (let record of oldRecords) {
          // 情况A: 新奖品等级更高 (数值更小) -> 旧奖品失效
          if (currentLevel < record.prizeLevel) {
            const updatePromise = Bmob.Query('GameScore')
              .get(record.objectId)
              .then(res => {
                res.set('status', 'expired');
                return res.save();
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
              const updatePromise = Bmob.Query('GameScore')
                .get(record.objectId)
                .then(res => {
                  res.set('status', 'expired');
                  return res.save();
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

      // 3. 保存新记录
      const query = Bmob.Query('GameScore');
      query.set("playerName", name);
      query.set("score", this.data.tempScore);
      query.set("timeCost", this.data.tempTime);
      query.set("difficulty", this.gameState.diff);
      query.set("prizeName", this.data.finalPrizeName);
      query.set("prizeLevel", this.data.finalPrizeLevel);
      query.set("rankSnapshot", this.data.myRank);

      // 如果 currentLevel 被标记为无效等级，说明PK输了，直接存为 expired
      // 如果 shouldSavePrize 为 false，说明奖品等级不足，设为 invalid
      let status = "pending";
      if (currentLevel === PRIZE_CONFIG.INVALID_LEVEL) {
        status = "expired";
      } else if (!shouldSavePrize) {
        status = "invalid";
      }
      query.set("status", status);

      if (openid) query.set("openid", openid);
      if (this.data.wechatNickName) query.set("wechatNickName", this.data.wechatNickName);
      if (this.data.avatarUrl) query.set("avatarUrl", this.data.avatarUrl);

      await query.save();

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
    // 重新开始游戏选择界面
    this.setData({
      isGameActive: false
    });
  },

  // 查看排行榜
  viewLeaderboard() {
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
    wx.showToast({
      title: '即将开放，敬请期待',
      icon: 'none'
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
  }
});
