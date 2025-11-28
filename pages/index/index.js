// index.js
var Bmob = require('../../utils/Bmob-2.6.3.min.js'); // 引入SDK

// 初始化 (填入您的密钥)
Bmob.initialize("4fa0f30d648a4b33", "123zbx");

const imgBaseUrl = "http://qianze.xyz/images"; // 同样记得换成您OSS的图
const imgConfig = [
  `${imgBaseUrl}/012.jpg?text=芊`, 
  `${imgBaseUrl}/013.jpg?text=泽`,
  // ... 把您之前的10张图链接填在这里，凑齐10个
  `${imgBaseUrl}/001.jpg`,
  `${imgBaseUrl}/002.jpg`,
  `${imgBaseUrl}/003.jpg`,
  `${imgBaseUrl}/004.jpg`,
  `${imgBaseUrl}/005.jpg`,
  `${imgBaseUrl}/006.jpg`,
  `${imgBaseUrl}/007.jpg`,
  `${imgBaseUrl}/008.jpg`,
  `${imgBaseUrl}/009.jpg`,
  `${imgBaseUrl}/010.jpg`,
  `${imgBaseUrl}/011.jpg`
];

// 音效上下文
const bgmCtx = wx.createInnerAudioContext();
bgmCtx.src = 'https://game.qianze.com/music/relax.mp3'; // 背景乐
bgmCtx.loop = true;

const matchCtx = wx.createInnerAudioContext();
matchCtx.src = 'https://game.qianze.com/music/pop.mp3'; // 💡 需求：消除音效 (请上传一个短促的pop声到OSS)

Page({
  data: {
    isMusicPlaying: false,
    isGameActive: false,
    showModal: false,
    diffConfig: [
      { id: 'easy', class: 'diff-easy', title: '养生小白', badge: '简单', badgeClass: 'badge-easy', multiplier: 1.0, desc: '重在参与', icon: '🍵' },
      { id: 'medium', class: 'diff-med', title: '养生达人', badge: '普通', badgeClass: 'badge-med', multiplier: 1.3, desc: '冲代金券', icon: '🌿' },
      { id: 'hard', class: 'diff-hard', title: '养生宗师', badge: '困难', badgeClass: 'badge-hard', multiplier: 1.6, desc: '抢大时长', icon: '🏆' }
    ],
    config: {
      easy: { rows: 2, cols: 2 },
      medium: { rows: 6, cols: 6 },
      hard: { rows: 8, cols: 6 }
    },
    prizeTiers: [
      { rankEnd: 1,  level: 1, name: "10元代金券" },
      { rankEnd: 3,  level: 2, name: "8元代金券" },
      { rankEnd: 10, level: 3, name: "6元代金券" },
      { rankEnd: 20, level: 4, name: "4元代金券" },
      { rankEnd: 50, level: 5, name: "2元代金券" },
      { rankEnd: 9999, level: 6, name: "再接再厉" }
    ],
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
    submitting: false
  },

  onLoad: function() {
    this.fetchLeaderboard();
  },

  toggleMusic() {
    if (this.data.isMusicPlaying) {
      bgmCtx.pause();
      this.setData({ isMusicPlaying: false });
    } else {
      bgmCtx.play();
      this.setData({ isMusicPlaying: true });
    }
  },

  fetchLeaderboard() {
    const query = Bmob.Query("GameScore");
    // 💡 需求：72小时制度
    let date = new Date();
    date.setHours(date.getHours() - 72);
    query.equalTo("createdAt", ">", date.toISOString());
    query.order("-score");
    query.limit(50);
    query.find().then(res => {
      res.forEach(item => {
        let d = new Date(item.createdAt);
        item.createTimeStr = `${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()<10?'0'+d.getMinutes():d.getMinutes()}`;
      });
      this.setData({ rankList: res });
    });
  },

  startGame(e) {
    let diff = e.currentTarget.dataset.diff;
    let conf = this.data.config[diff];
    
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

    if (!this.data.isMusicPlaying) this.toggleMusic();

    clearInterval(this.timer);
    this.timer = setInterval(() => {
      let s = Math.floor((Date.now() - this.gameState.startTime) / 1000);
      let score = this.calculateScore(s, this.gameState.matchedPairs);
      this.setData({ timeDisplay: s, liveScore: score });
    }, 1000);

    let size = conf.rows >= 8 ? '80rpx' : '100rpx';
    this.setData({ isGameActive: true, cols: conf.cols, tileSize: size, timeDisplay: 0, liveScore: 0 });
    this.initBoard();
  },

  initBoard() {
    let { rows, cols, totalPairs } = this.gameState;
    let data = [];
    for(let i=0; i<totalPairs; i++) data.push(i % imgConfig.length, i % imgConfig.length);
    data.sort(() => Math.random() - 0.5);

    let tr = rows + 2, tc = cols + 2;
    this.gameState.logicBoard = Array(tr).fill(null).map(() => Array(tc).fill(-1));
    
    let viewTiles = [];
    let idx = 0;
    
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        let type = data[idx++];
        this.gameState.logicBoard[r][c] = type;
        viewTiles.push({
          id: `${r}-${c}`, r, c, img: imgConfig[type],
          selected: false, matched: false, isPath: false
        });
      }
    }
    
    this.setData({ domTiles: viewTiles });
    this.checkDeadlock(); // 初始死局检测
  },

  handleTileClick(e) {
    let { r, c } = e.currentTarget.dataset;
    let logicBoard = this.gameState.logicBoard;
    if (logicBoard[r][c] === -1) return;

    let tiles = this.data.domTiles;
    let idx = tiles.findIndex(t => t.r === r && t.c === c);
    let currentTile = tiles[idx];
    if (currentTile.matched) return;

    if (this.gameState.selected && this.gameState.selected.r === r && this.gameState.selected.c === c) {
      currentTile.selected = false;
      this.setData({ domTiles: tiles });
      this.gameState.selected = null;
      return;
    }

    if (!this.gameState.selected) {
      currentTile.selected = true;
      this.gameState.selected = { r, c, idx };
      this.setData({ domTiles: tiles });
    } else {
      let prev = this.gameState.selected;
      let prevTile = tiles[prev.idx];

      if (logicBoard[prev.r][prev.c] === logicBoard[r][c]) {
        let path = this.findPathBFS(prev.r, prev.c, r, c);
        if (path) {
          currentTile.selected = true;
          this.setData({ domTiles: tiles });
          this.matchSuccess(prev, {r,c,idx}, path);
        } else {
          prevTile.selected = false;
          currentTile.selected = true;
          this.gameState.selected = { r, c, idx };
          this.setData({ domTiles: tiles });
        }
      } else {
        prevTile.selected = false;
        currentTile.selected = true;
        this.gameState.selected = { r, c, idx };
        this.setData({ domTiles: tiles });
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
       if(pIdx > -1) tiles[pIdx].isPath = true;
    });
    this.setData({ domTiles: tiles });

    setTimeout(() => {
      tiles.forEach(t => t.isPath = false);
      tiles[t1.idx].selected = false; tiles[t1.idx].matched = true;
      tiles[t2.idx].selected = false; tiles[t2.idx].matched = true;
      
      this.gameState.logicBoard[t1.r][t1.c] = -1;
      this.gameState.logicBoard[t2.r][t2.c] = -1;
      this.gameState.selected = null;
      this.gameState.matchedPairs++;
      
      this.setData({ domTiles: tiles });
      
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
    if (!this.hasMoves()) {
      wx.showToast({ title: '无解！自动洗牌', icon: 'none' });
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
        if (board[r][c] !== -1) pts.push({r, c, type: board[r][c]});
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
      tiles[idx].img = imgConfig[types[i]];
      tiles[idx].selected = false;
    });
    
    this.gameState.selected = null;
    this.setData({ domTiles: tiles });
  },

  findPathBFS(r1, c1, r2, c2) {
    let q = [{r:r1, c:c1, dir:0, turns:0, path:[{r:r1,c:c1}]}];
    let visited = new Set(); 
    const dr = [-1, 1, 0, 0], dc = [0, 0, -1, 1], dCode = [1, 2, 3, 4];
    let board = this.gameState.logicBoard;
    let rows = this.gameState.rows + 2;
    let cols = this.gameState.cols + 2;

    while(q.length > 0) {
      let cur = q.shift();
      for(let i=0; i<4; i++) {
        let nr = cur.r + dr[i], nc = cur.c + dc[i], ndir = dCode[i];
        if(nr<0 || nr>=rows || nc<0 || nc>=cols) continue;
        let nturns = cur.turns + (cur.dir !== 0 && cur.dir !== ndir ? 1 : 0);
        if(nturns > 2) continue;
        let newPath = [...cur.path, {r:nr, c:nc}];
        if(nr===r2 && nc===c2) return newPath;
        if(board[nr][nc] !== -1) continue;
        let key = `${nr},${nc},${ndir},${nturns}`;
        if(visited.has(key)) continue; 
        visited.add(key);
        q.push({r:nr, c:nc, dir:ndir, turns:nturns, path:newPath});
      }
    }
    return null;
  },

  calculateScore(s, p) {
    if (s <= 0) s = 1;
    let mult = 1.0;
    this.data.diffConfig.forEach(d => { if(d.id === this.gameState.diff) mult = d.multiplier; });
    return Math.floor(((p * 1000) / s) * mult);
  },

  gameWin() {
    clearInterval(this.timer);
    let s = Math.floor((Date.now() - this.gameState.startTime) / 1000);
    let score = this.calculateScore(s, this.gameState.totalPairs);
    
    let rank = 1;
    this.data.rankList.forEach(r => { if(r.score > score) rank++; });

    let prize = "再接再厉";
    let level = 6;
    for (let tier of this.data.prizeTiers) {
      if(rank <= tier.rankEnd) {
        prize = tier.name;
        level = tier.level;
        break;
      }
    }

    this.setData({
      isGameActive: false,
      showModal: true,
      tempScore: score,
      tempTime: s,
      myRank: rank,
      finalPrizeName: prize,
      finalPrizeLevel: level
    });
  },

  onNameInput(e) { this.setData({ inputName: e.detail.value }); },

  // 💡 需求：复杂的奖品更新逻辑
  async submitScore() {
    let name = this.data.inputName;
    if (!name) { wx.showToast({ title: '请输入名字', icon: 'none' }); return; }
    
    this.setData({ submitting: true });

    try {
      // 1. 查找该用户是否已有“待使用”的奖品
      const queryOld = Bmob.Query("GameScore");
      queryOld.set("playerName", name);
      queryOld.set("status", "pending"); // 状态：pending, used, expired
      const oldRecords = await queryOld.find();

      // 2. 比较奖品等级
      let currentLevel = this.data.finalPrizeLevel;
      // 奖品等级越小越好 (1级最好)
      
      // 批量处理旧记录
      if (oldRecords.length > 0) {
        for (let record of oldRecords) {
           const queryUpdate = Bmob.Query('GameScore');
           // 如果新奖品更好(level更小)，旧奖品失效
           if (currentLevel < record.prizeLevel) {
             queryUpdate.get(record.objectId).then(res => {
               res.set('status', 'expired');
               res.save();
             });
           } else {
             // 如果旧奖品更好，新奖品直接标记为失效(但仍然记录分数)
             // 或者：保留两者？需求说“最优的奖品为待使用”。
             // 策略：如果新奖品不如旧奖品，新奖品直接存为 'expired'
             // 但为了鼓励，我们可以不存为expired，而是这次挑战不算“有效赢取”。
             // 按照需求：多次过关，只有最好成绩奖品有效。
             // 所以这里我们把新记录存为 'expired' 状态即可。
             currentLevel = 999; // 标记一下，下面的保存逻辑会用到
           }
        }
      }

      // 3. 保存新记录
      const query = Bmob.Query('GameScore');
      query.set("playerName", name);
      query.set("score", this.data.tempScore);
      query.set("timeCost", this.data.tempTime);
      query.set("difficulty", this.gameState.diff);
      query.set("prizeName", this.data.finalPrizeName);
      query.set("prizeLevel", this.data.finalPrizeLevel);
      // 如果currentLevel被标记为999，说明不如旧奖品，直接过期；否则为待使用
      query.set("status", currentLevel === 999 ? "expired" : "pending");
      
      await query.save();

      wx.showToast({ title: '上榜成功', icon: 'success' });
      this.setData({ showModal: false, submitting: false });
      this.fetchLeaderboard();

    } catch (err) {
      console.log(err);
      wx.showToast({ title: '提交失败', icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  backToMenu() {
    clearInterval(this.timer);
    this.setData({ isGameActive: false, showModal: false });
    this.fetchLeaderboard();
  }
});