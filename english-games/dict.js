// 英语单词数据
const wordDictionary = [
  {
    en: "apple",
    cn: "苹果",
    yb: "/ˈæpl/",
    ljen: "She ate an apple for breakfast.",
    ljcn: "她早餐吃了一个苹果。"
  },
  {
    en: "banana",
    cn: "香蕉",
    yb: "/bəˈnɑːnə/",
    ljen: "He likes to eat banana bread.",
    ljcn: "他喜欢吃香蕉面包。"
  },
  {
    en: "cat",
    cn: "猫",
    yb: "/kæt/",
    ljen: "The cat is sleeping on the sofa.",
    ljcn: "猫在沙发上睡觉。"
  },
  {
    en: "dog",
    cn: "狗",
    yb: "/dɒɡ/",
    ljen: "My dog's name is Max.",
    ljcn: "我的狗叫马克斯。"
  },
  {
    en: "elephant",
    cn: "大象",
    yb: "/ˈelɪfənt/",
    ljen: "Elephants are very intelligent animals.",
    ljcn: "大象是非常聪明的动物。"
  },
  {
    en: "fish",
    cn: "鱼",
    yb: "/fɪʃ/",
    ljen: "There are many colorful fish in the ocean.",
    ljcn: "海洋里有很多彩色的鱼。"
  },
  {
    en: "grape",
    cn: "葡萄",
    yb: "/ɡreɪp/",
    ljen: "I bought a bunch of grapes from the market.",
    ljcn: "我从市场买了一串葡萄。"
  },
  {
    en: "house",
    cn: "房子",
    yb: "/haʊs/",
    ljen: "They live in a big house with a garden.",
    ljcn: "他们住在一个带花园的大房子里。"
  },
  {
    en: "ice cream",
    cn: "冰淇淋",
    yb: "/aɪs kriːm/",
    ljen: "Children love to eat ice cream in summer.",
    ljcn: "孩子们夏天喜欢吃冰淇淋。"
  },
  {
    en: "juice",
    cn: "果汁",
    yb: "/dʒuːs/",
    ljen: "She drinks a glass of orange juice every morning.",
    ljcn: "她每天早上喝一杯橙汁。"
  },
  {
    en: "kite",
    cn: "风筝",
    yb: "/kaɪt/",
    ljen: "We flew kites in the park yesterday.",
    ljcn: "我们昨天在公园放风筝。"
  },
  {
    en: "lion",
    cn: "狮子",
    yb: "/ˈlaɪən/",
    ljen: "The lion is known as the king of the jungle.",
    ljcn: "狮子被称为丛林之王。"
  },
  {
    en: "monkey",
    cn: "猴子",
    yb: "/ˈmʌŋki/",
    ljen: "The monkey is swinging from tree to tree.",
    ljcn: "猴子在树间荡来荡去。"
  },
  {
    en: "notebook",
    cn: "笔记本",
    yb: "/ˈnəʊtbʊk/",
    ljen: "I write down my thoughts in a notebook.",
    ljcn: "我在笔记本上写下我的想法。"
  },
  {
    en: "orange",
    cn: "橙子",
    yb: "/ˈɒrɪndʒ/",
    ljen: "Would you like a slice of orange?",
    ljcn: "你想要一片橙子吗？"
  },
  {
    en: "pen",
    cn: "钢笔",
    yb: "/pen/",
    ljen: "She signed the document with a pen.",
    ljcn: "她用钢笔签署了文件。"
  },
  {
    en: "queen",
    cn: "女王",
    yb: "/kwiːn/",
    ljen: "The queen waved to the crowd from the balcony.",
    ljcn: "女王从阳台上向人群挥手。"
  },
  {
    en: "rabbit",
    cn: "兔子",
    yb: "/ˈræbɪt/",
    ljen: "The rabbit hopped through the garden.",
    ljcn: "兔子蹦蹦跳跳地穿过花园。"
  },
  {
    en: "sun",
    cn: "太阳",
    yb: "/sʌn/",
    ljen: "The sun rises in the east and sets in the west.",
    ljcn: "太阳从东方升起，从西方落下。"
  },
  {
    en: "tree",
    cn: "树",
    yb: "/triː/",
    ljen: "There are many trees in the forest.",
    ljcn: "森林里有很多树。"
  },
  {
    en: "umbrella",
    cn: "雨伞",
    yb: "/ʌmˈbrelə/",
    ljen: "Don't forget to take your umbrella when it rains.",
    ljcn: "下雨时别忘了带伞。"
  },
  {
    en: "violin",
    cn: "小提琴",
    yb: "/ˌvaɪəˈlɪn/",
    ljen: "She plays the violin beautifully.",
    ljcn: "她小提琴拉得非常好。"
  },
  {
    en: "water",
    cn: "水",
    yb: "/ˈwɔːtə/",
    ljen: "We need to drink enough water every day.",
    ljcn: "我们每天需要喝足够的水。"
  },
  {
    en: "box",
    cn: "盒子",
    yb: "/bɒks/",
    ljen: "He put the礼物 in a box.",
    ljcn: "他把礼物放在一个盒子里。"
  },
  {
    en: "yellow",
    cn: "黄色",
    yb: "/ˈjeləʊ/",
    ljen: "Sunflowers are yellow.",
    ljcn: "向日葵是黄色的。"
  },
  {
    en: "zebra",
    cn: "斑马",
    yb: "/ˈzebrə/",
    ljen: "Zebras have black and white stripes.",
    ljcn: "斑马有黑白条纹。"
  },
  {
    en: "teacher",
    cn: "老师",
    yb: "/ˈtiːtʃə/",
    ljen: "My teacher is very kind and helpful.",
    ljcn: "我的老师非常善良和乐于助人。"
  },
  {
    en: "student",
    cn: "学生",
    yb: "/ˈstjuːdənt/",
    ljen: "She is a hardworking student.",
    ljcn: "她是一个勤奋的学生。"
  },
  {
    en: "book",
    cn: "书",
    yb: "/bʊk/",
    ljen: "I enjoy reading books in my free time.",
    ljcn: "我喜欢在空闲时间读书。"
  },
  {
    en: "computer",
    cn: "电脑",
    yb: "/kəmˈpjuːtə/",
    ljen: "He uses a computer for his work.",
    ljcn: "他用电脑工作。"
  }
];

// 从字典中随机获取指定数量的单词
function getRandomWords(count) {
  // 创建字典的副本，避免修改原始数据
  const shuffled = [...wordDictionary];
  
  // Fisher-Yates 洗牌算法
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // 返回前count个单词
  return shuffled.slice(0, count);
}

// 从字典中获取指定索引的单词
function getWordByIndex(index) {
  if (index >= 0 && index < wordDictionary.length) {
    return wordDictionary[index];
  }
  return null;
}

// 获取字典中单词的总数
function getTotalWords() {
  return wordDictionary.length;
}
