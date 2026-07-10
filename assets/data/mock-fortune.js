/**
 * Mock数据服务 - 为前端独立运行提供模拟数据
 */

// Mock数据配置
const USE_MOCK = true  // 设置为true使用mock数据，false使用真实API

// 模拟延迟
const MOCK_DELAY = 800

// 模拟用户数据
const mockUser = {
  userId: 1,
  nickname: "测试用户",
  avatar: "https://cdn.example.com/avatar.png",
  gender: 1,
  totalDraws: 5,
  totalConsults: 2,
  totalCards: 3,
  vipLevel: 0,
  createdAt: "2024-01-15T10:00:00Z"
}

// 模拟签文数据
const mockFortuneTypes = [
  {
    type: "事业",
    name: "事业运势",
    description: "职场发展、工作机会相关咨询",
    icon: "career_icon",
    color: "#3B82F6"
  },
  {
    type: "姻缘", 
    name: "姻缘运势",
    description: "感情运势、桃花运相关咨询",
    icon: "love_icon",
    color: "#EF4444"
  },
  {
    type: "健康",
    name: "健康运势", 
    description: "身体状况、养生保健相关咨询",
    icon: "health_icon",
    color: "#10B981"
  },
  {
    type: "财运",
    name: "财运运势",
    description: "投资理财、财富运势相关咨询", 
    icon: "wealth_icon",
    color: "#F59E0B"
  },
  {
    type: "综合",
    name: "综合运势",
    description: "整体运势、重要决策相关咨询",
    icon: "fortune_icon",
    color: "#8B5CF6"
  }
]

const mockFortunes = [
  {
    id: 1,
    type: "事业",
    category: "职场发展",
    title: "上上签·鹏程万里",
    content: "春风得意马蹄疾，一日看尽长安花",
    explanation: "近期事业运势极佳，正是展翅高飞的好时机。工作中的努力将得到认可，有望获得晋升机会或重要项目的主导权。建议把握当下机遇，主动承担责任，展现领导才能。",
    level: 1,
    drawCount: 156,
    status: 1
  },
  {
    id: 2,
    type: "事业",
    category: "职场发展", 
    title: "上签·稳中求进",
    content: "山重水复疑无路，柳暗花明又一村",
    explanation: "事业路上虽有波折，但坚持不懈终将迎来转机。新项目或投资机会即将出现，需要谨慎评估后果断行动。保持耐心，积攒实力，静待时机成熟。",
    level: 2,
    drawCount: 89,
    status: 1
  },
  {
    id: 3,
    type: "事业",
    category: "创业投资",
    title: "上签·财源广进", 
    content: "海阔凭鱼跃，天高任鸟飞",
    explanation: "创业投资运势良好，适合开展新事业或扩大现有业务。贵人运佳，易得到合作伙伴或投资人的支持。建议在决策时多听取意见，稳扎稳打，避免盲目冒进。",
    level: 2,
    drawCount: 67,
    status: 1
  },
  {
    id: 4,
    type: "姻缘",
    category: "恋爱桃花",
    title: "上上签·佳偶天成",
    content: "关关雎鸠，在河之洲。窈窕淑女，君子好逑",
    explanation: "姻缘运势旺盛，单身者有望在社交场合遇到心仪对象。有伴侣者感情更加稳定甜蜜，适合考虑进一步发展。建议主动参与社交活动，保持开放心态，真诚待人。",
    level: 1,
    drawCount: 203,
    status: 1
  },
  {
    id: 5,
    type: "姻缘",
    category: "婚姻感情",
    title: "上签·琴瑟和鸣",
    content: "执子之手，与子偕老",
    explanation: "感情运势平稳上升，已有伴侣者关系更加和谐。夫妻间沟通顺畅，相互理解支持，适合讨论婚嫁或家庭规划。单身者桃花运不错，但要避免快餐式恋爱，注重精神契合。",
    level: 2,
    drawCount: 134,
    status: 1
  },
  {
    id: 6,
    type: "健康",
    category: "身体状况",
    title: "上签·身康体健",
    content: "但愿人长久，千里共婵娟", 
    explanation: "身体健康状况良好，精神饱满。适合进行适量运动，注意作息规律，保持良好的生活习惯。建议规律作息，适度锻炼，均衡饮食，保持心情愉悦。",
    level: 2,
    drawCount: 98,
    status: 1
  },
  {
    id: 7,
    type: "健康",
    category: "养生保健",
    title: "上上签·福寿安康",
    content: "松鹤延年，福如东海",
    explanation: "健康运势极佳，身体抵抗力强，精神状态良好。老年人身体健康状况稳定，年轻人精力充沛。建议注意劳逸结合，避免过度疲劳，定期体检预防为主。",
    level: 1,
    drawCount: 176,
    status: 1
  },
  {
    id: 8,
    type: "财运",
    category: "投资理财",
    title: "上签·财源滚滚",
    content: "金银财宝滚滚来，富贵荣华自然来",
    explanation: "财运亨通，投资理财运势较好。股票、基金等投资有机会获得收益，但需谨慎选择，避免盲目跟风。建议分散投资，稳健为主，不宜孤注一掷。",
    level: 2,
    drawCount: 145,
    status: 1
  },
  {
    id: 9,
    type: "财运",
    category: "偏财运",
    title: "上上签·意外之财",
    content: "忽如一夜春风来，千树万树梨花开",
    explanation: "偏财运旺盛，有机会获得意外之财，如中奖、礼物或其他收入来源。但要注意理财规划，避免挥霍无度。建议将意外之财合理规划，用于投资或储蓄。",
    level: 1,
    drawCount: 189,
    status: 1
  },
  {
    id: 10,
    type: "综合",
    category: "整体运势",
    title: "上上签·万事如意",
    content: "一帆风顺年年好，万事如意步步高",
    explanation: "整体运势极佳，各方面都有良好的发展机会。工作、学习、生活都能顺心如意，是收获满满的好时期。建议把握机遇，积极进取，同时保持谦逊态度，善待他人。",
    level: 1,
    drawCount: 298,
    status: 1
  }
]

// 模拟卡牌数据
const mockCards = [
  {
    id: 1,
    name: "鹏程万里卡",
    type: "事业",
    imageUrl: "https://cdn.example.com/cards/career_bird.png",
    thumbnailUrl: "https://cdn.example.com/cards/career_bird_thumb.png",
    obtainedTime: "2024-11-22T10:00:00Z",
    expireTime: "2024-12-22T10:00:00Z",
    status: "valid",
    isFavorite: true,
    viewCount: 25,
    description: "象征事业运势旺盛，必能展翅高飞"
  },
  {
    id: 2,
    name: "佳偶天成卡",
    type: "姻缘", 
    imageUrl: "https://cdn.example.com/cards/love_birds.png",
    thumbnailUrl: "https://cdn.example.com/cards/love_birds_thumb.png",
    obtainedTime: "2024-11-20T14:30:00Z",
    expireTime: "2024-12-20T14:30:00Z",
    status: "valid",
    isFavorite: false,
    viewCount: 18,
    description: "象征姻缘美满，桃花运旺盛"
  },
  {
    id: 3,
    name: "福寿安康卡",
    type: "健康",
    imageUrl: "https://cdn.example.com/cards/health_lotus.png", 
    thumbnailUrl: "https://cdn.example.com/cards/health_lotus_thumb.png",
    obtainedTime: "2024-11-18T09:15:00Z",
    expireTime: "2024-12-18T09:15:00Z",
    status: "valid",
    isFavorite: true,
    viewCount: 31,
    description: "象征身体健康，精神饱满"
  }
]

// 模拟AI咨询数据
const mockAIResponses = {
  "事业": {
    "summary": "近期工作压力较大，但正面临重要的转变机遇。",
    "suggestions": [
      "保持冷静，理性分析当前工作状况",
      "可以开始关注新的机会，但不要急于行动", 
      "与信任的朋友或导师交流，获得建议"
    ],
    "cautions": [
      "避免因为一时冲动而做出重大决定",
      "注意身体健康，适当减压"
    ]
  },
  "姻缘": {
    "summary": "感情运势平稳上升，单身者有望遇到心仪对象。",
    "suggestions": [
      "保持积极乐观的心态，真诚待人",
      "可以多参加社交活动，扩大交友圈",
      "注意自身形象，展现个人魅力"
    ],
    "cautions": [
      "避免过于急躁，爱情需要耐心等待",
      "不要被表面现象迷惑，要用心观察"
    ]
  },
  "健康": {
    "summary": "身体状况良好，精神饱满，抵抗力较强。",
    "suggestions": [
      "保持规律的作息，早睡早起身体好",
      "适量运动，增强体质和免疫力",
      "注意饮食均衡，多吃蔬菜水果"
    ],
    "cautions": [
      "避免过度疲劳，注意劳逸结合",
      "定期体检，预防胜于治疗"
    ]
  },
  "财运": {
    "summary": "财运平稳，适合稳健理财，不宜冒险投资。",
    "suggestions": [
      "可以关注低风险的理财产品",
      "合理规划支出，避免冲动消费",
      "适当储蓄，为未来做准备"
    ],
    "cautions": [
      "避免高风险投资，防范财务风险", 
      "不要轻信他人建议，做好独立判断"
    ]
  }
}

// 模拟抽签历史数据
const mockDrawHistory = [
  {
    id: 1,
    fortune: {
      id: 1,
      type: "事业",
      title: "上上签·鹏程万里",
      content: "春风得意马蹄疾，一日看尽长安花"
    },
    card: {
      id: 1,
      name: "鹏程万里卡",
      type: "事业",
      imageUrl: "https://cdn.example.com/cards/career_bird.png"
    },
    drawTime: "2024-11-22T10:00:00Z",
    hasCard: true
  },
  {
    id: 2,
    fortune: {
      id: 4,
      type: "姻缘", 
      title: "上上签·佳偶天成",
      content: "关关雎鸠，在河之洲"
    },
    card: null,
    drawTime: "2024-11-21T15:30:00Z",
    hasCard: false
  },
  {
    id: 3,
    fortune: {
      id: 7,
      type: "健康",
      title: "上上签·福寿安康", 
      content: "松鹤延年，福如东海"
    },
    card: {
      id: 3,
      name: "福寿安康卡",
      type: "健康",
      imageUrl: "https://cdn.example.com/cards/health_lotus.png"
    },
    drawTime: "2024-11-20T09:15:00Z",
    hasCard: true
  }
]

// 模拟AI咨询历史数据
const mockAIHistory = [
  {
    id: 1,
    consultType: "事业",
    question: "最近工作压力很大，是否应该考虑换工作？",
    response: {
      summary: "近期工作压力较大，但正面临重要的转变机遇。"
    },
    createdAt: "2024-11-22T11:00:00Z",
    aiProvider: "baidu"
  },
  {
    id: 2,
    consultType: "健康",
    question: "最近总是失眠，有什么好的建议吗？",
    response: {
      summary: "身体状况良好，精神饱满，抵抗力较强。"
    },
    createdAt: "2024-11-21T20:30:00Z", 
    aiProvider: "baidu"
  }
]

/**
 * 模拟请求延迟
 */
const delay = (ms = MOCK_DELAY) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 随机选择签文
 */
const getRandomFortune = (type) => {
  const filteredFortunes = type ? mockFortunes.filter(f => f.type === type) : mockFortunes
  const randomIndex = Math.floor(Math.random() * filteredFortunes.length)
  return filteredFortunes[randomIndex]
}

/**
 * 随机选择是否获得卡牌 (30%概率)
 */
const getRandomCard = (fortuneId) => {
  if (Math.random() < 0.3) {
    const card = mockCards.find(c => c.id === Math.floor(Math.random() * mockCards.length) + 1)
    return {
      ...card,
      id: Date.now(),
      obtainedTime: new Date().toISOString(),
      expireTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30天后过期
    }
  }
  return null
}

/**
 * Mock API服务类
 */
class MockAPIService {
  constructor() {
    this.user = mockUser
    this.drawHistory = mockDrawHistory
    this.aiHistory = mockAIHistory
  }

  /**
   * 用户相关接口
   */
  async getUserInfo() {
    await delay()
    return {
      data: this.user
    }
  }

  async login(loginData) {
    await delay()
    const token = 'mock_token_' + Date.now()
    return {
      data: {
        userId: 1,
        token,
        expiresIn: 3600,
        userInfo: {
          nickname: "测试用户",
          avatar: "https://cdn.example.com/avatar.png",
          vipLevel: 0
        }
      }
    }
  }

  /**
   * 签文相关接口
   */
  async getFortunes(type = '', page = 1, size = 20) {
    await delay()
    const filteredFortunes = type ? mockFortunes.filter(f => f.type === type) : mockFortunes
    const start = (page - 1) * size
    const end = start + size
    return {
      data: {
        total: filteredFortunes.length,
        page,
        size,
        fortunes: filteredFortunes.slice(start, end)
      }
    }
  }

  async getFortuneTypes() {
    await delay()
    return {
      data: mockFortuneTypes
    }
  }

  /**
   * 抽签相关接口
   */
  async drawLottery(type) {
    await delay(1500) // 抽签动画延迟
    const fortune = getRandomFortune(type)
    const card = getRandomCard(fortune.id)
    const record = {
      id: Date.now(),
      fortune,
      card,
      drawTime: new Date().toISOString(),
      hasCard: !!card
    }
    
    this.drawHistory.unshift(record)
    
    return {
      data: {
        recordId: record.id,
        fortune,
        card,
        coolDownMinutes: 10,
        nextCoolDown: card ? null : new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
    }
  }

  async getDrawHistory(page = 1, size = 20) {
    await delay()
    const start = (page - 1) * size
    const end = start + size
    return {
      data: {
        total: this.drawHistory.length,
        page,
        size,
        records: this.drawHistory.slice(start, end)
      }
    }
  }

  async getCooldownStatus(type) {
    await delay()
    return {
      data: {
        canDraw: true,
        nextCoolDown: null,
        remainingMinutes: 0
      }
    }
  }

  /**
   * AI算命相关接口
   */
  async aiConsult(consultData) {
    await delay(2000) // AI计算延迟
    const response = mockAIResponses[consultData.consultType] || mockAIResponses["事业"]
    const consultId = Date.now()
    
    const consult = {
      id: consultId,
      response,
      aiProvider: "mock",
      tokensUsed: 150,
      responseTime: 2.0,
      createdAt: new Date().toISOString()
    }
    
    this.aiHistory.unshift({
      id: consultId,
      consultType: consultData.consultType,
      question: consultData.question,
      response,
      createdAt: consult.createdAt,
      aiProvider: "mock"
    })
    
    return {
      data: consult
    }
  }

  async getAIHistory(page = 1, size = 20) {
    await delay()
    const start = (page - 1) * size
    const end = start + size
    return {
      data: {
        total: this.aiHistory.length,
        page,
        size,
        consultations: this.aiHistory.slice(start, end)
      }
    }
  }

  async getConsultTypes() {
    await delay()
    return {
      data: mockFortuneTypes.slice(0, 4).map(type => ({
        type: type.type,
        name: type.name,
        description: type.description,
        icon: type.icon
      }))
    }
  }

  /**
   * 卡牌相关接口
   */
  async getCardCollection(page = 1, size = 20, filters = {}) {
    await delay()
    const start = (page - 1) * size
    const end = start + size
    return {
      data: {
        total: mockCards.length,
        page,
        size,
        cards: mockCards.slice(start, end)
      }
    }
  }

  async getCardStatistics() {
    await delay()
    return {
      data: {
        totalCards: 3,
        validCards: 3,
        expiredCards: 0,
        favoriteCards: 2,
        typeStats: {
          "事业": 1,
          "姻缘": 1,
          "健康": 1
        },
        rarityStats: {
          "普通": 0,
          "稀有": 2,
          "史诗": 1,
          "传说": 0
        }
      }
    }
  }

  async favoriteCard(cardId) {
    await delay()
    const card = mockCards.find(c => c.id === cardId)
    if (card) card.isFavorite = true
    return { data: { success: true } }
  }

  async unfavoriteCard(cardId) {
    await delay()
    const card = mockCards.find(c => c.id === cardId)
    if (card) card.isFavorite = false
    return { data: { success: true } }
  }
}

// 创建mock API实例
export const mockAPI = new MockAPIService()

// 导出配置
export { USE_MOCK }

export default {
  mockAPI,
  USE_MOCK,
  delay,
  getRandomFortune,
  getRandomCard
}