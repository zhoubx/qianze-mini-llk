// components/champion-celebration/champion-celebration.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    rank: {
      type: Number,
      value: 1
    },
    prizeName: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的初始数据
   */
  data: {

  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 显示庆祝动画
    showCelebration(rank, prizeName) {
      this.setData({
        show: true,
        rank: rank,
        prizeName: prizeName
      });

      // 3秒后自动隐藏
      setTimeout(() => {
        this.hideCelebration();
      }, 3000);
    },

    // 隐藏庆祝动画
    hideCelebration() {
      this.setData({
        show: false
      });
    }
  }
})
