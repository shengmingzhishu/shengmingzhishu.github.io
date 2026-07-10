/**
 * 智能文本转Markdown格式化工具
 * 版本：2.1（换行优化版）
 * 功能：AI驱动的内容识别和自动排版
 * 作者：LeeCommon
 * 日期：2025年12月
 */

// 主入口函数 - 传入文章，传出格式化后的Markdown
function formatTextToMarkdown(text) {
    if (!text || typeof text !== 'string') return '';
    if (!text.trim()) return '';
    
    // 保留原始换行结构，但过滤空行
    const originalLines = text.split('\n');
    const lines = originalLines.map(line => line.trim()).filter(line => line);
    let markdown = [];
    
    // 智能内容分析和预处理
    const analysis = analyzeContentStructure(lines);
    
    // 智能生成主标题
    if (lines.length > 0 && !lines[0].startsWith('#') && !detectHeadingLevel(lines[0], analysis).isHeading) {
        const mainTitle = generateMainTitle(lines[0], analysis);
        markdown.push(`# ${mainTitle}\n`);
    }

    // 智能段落处理 - 保留原始换行语义
    let currentParagraph = [];
    let lastWasEmpty = false; // 跟踪空行
    let isInList = false;
    let consecutiveShortLines = 0; // 连续短句计数
    
    for (let i = 0; i < originalLines.length; i++) {
        const originalLine = originalLines[i];
        const line = originalLine.trim();
        
        // 如果是空行，保留换行并结束当前段落
        if (!line) {
            if (currentParagraph.length > 0) {
                // 空行表示段落结束
                markdown.push(formatParagraph(currentParagraph, analysis));
                currentParagraph = [];
            }
            // 保留换行：添加一个空行
            markdown.push('');
            lastWasEmpty = true;
            consecutiveShortLines = 0;
            isInList = false;
            continue;
        }
        
        // 检测内容类型
        const headingInfo = detectHeadingLevel(line, analysis);
        const isListItem = isLikelyListItem(line, i, originalLines, analysis);
        
        // 计算当前行在lines数组中的位置（确保索引正确）
        const filteredIndex = lines.indexOf(line);
        const isImportant = filteredIndex >= 0 ? isImportantSentence(line, analysis, filteredIndex, lines) : false;
        const isQuote = isQuoteText(line);
        
        // 检查是否是独立短句（适合独立段落）
        const isIndependentShort = isIndependentSentence(line);
        
        // 处理标题
        if (headingInfo.isHeading) {
            if (currentParagraph.length > 0) {
                markdown.push(formatParagraph(currentParagraph, analysis));
                currentParagraph = [];
            }
            markdown.push(`${'#'.repeat(headingInfo.level)} ${line}\n`);
            isInList = false;
            lastWasEmpty = false;
            consecutiveShortLines = 0;
            continue;
        }
        
        // 处理列表项
        if (isListItem) {
            if (currentParagraph.length > 0) {
                markdown.push(formatParagraph(currentParagraph, analysis));
                currentParagraph = [];
            }
            
            const formattedListItem = formatListItem(line, analysis);
            markdown.push(formattedListItem);
            isInList = true;
            lastWasEmpty = false;
            consecutiveShortLines = 0;
            continue;
        }
        
        // 处理引用
        if (isQuote) {
            if (currentParagraph.length > 0) {
                markdown.push(formatParagraph(currentParagraph, analysis));
                currentParagraph = [];
            }
            markdown.push(formatQuote(line, analysis));
            isInList = false;
            lastWasEmpty = false;
            consecutiveShortLines = 0;
            continue;
        }
        
        // 智能段落合并策略
        const shouldStartNewParagraph = shouldStartNewParagraphLogic(
            line, currentParagraph, lastWasEmpty, consecutiveShortLines, 
            isInList, i, originalLines, analysis
        );
        
        if (shouldStartNewParagraph && currentParagraph.length > 0) {
            markdown.push(formatParagraph(currentParagraph, analysis));
            currentParagraph = [];
            consecutiveShortLines = 0;
            isInList = false;
        }
        
        currentParagraph.push(line);
        
        // 更新短句计数
        if (line.length < 25 && !line.includes('，') && line.length > 3) {
            consecutiveShortLines++;
        } else {
            consecutiveShortLines = 0;
        }
        
        lastWasEmpty = false;
    }
    
    // 处理最后一个段落
    if (currentParagraph.length > 0) {
        markdown.push(formatParagraph(currentParagraph, analysis));
    }

    return cleanMarkdown(markdown.join('\n\n')).replace(/\n\n\n+/g, '\n\n');
}

// 智能段落判断逻辑
function shouldStartNewParagraphLogic(line, currentParagraph, lastWasEmpty, consecutiveShortLines, isInList, index, allLines, analysis) {
    // 如果刚有段落分隔，开始新段落
    if (lastWasEmpty) return true;
    
    // 如果当前是短句且连续多个，可能需要分段
    if (consecutiveShortLines >= 2 && line.length < 30) {
        return true;
    }
    
    // 检查是否是新的话题开始
    const prevLine = allLines[index - 1];
    if (prevLine && isNewTopic(line, prevLine)) {
        return true;
    }
    
    // 如果当前行很长且包含多个句号，说明是复合段落
    const sentenceCount = (line.match(/[。！？]/g) || []).length;
    if (sentenceCount >= 2 && currentParagraph.length === 0) {
        return false; // 这是一个完整的复合句，保持为一段
    }
    
    // 如果当前段落已经很长（超过200字符），建议分段
    const currentLength = currentParagraph.join(' ').length;
    if (currentLength > 200) {
        return true;
    }
    
    return false;
}

// 检测是否是新话题开始
function isNewTopic(currentLine, prevLine) {
    // 检查明显的转折
    const transitions = ['但是', '然而', '不过', '相反', '同时', '另外', '此外', '此外'];
    if (transitions.some(word => currentLine.includes(word))) {
        return true;
    }
    
    // 检查数字编号或新的章节
    if (/^[一二三四五六七八九十][、.]/.test(currentLine) || /^\d+[、.]/.test(currentLine)) {
        return true;
    }
    
    // 检查长度跳跃
    if (currentLine.length < 30 && prevLine.length > 50) {
        return true;
    }
    
    return false;
}

// 检测是否应该独立成段的短句
function isIndependentSentence(line) {
    // 包含冒号的定义性句子
    if (line.includes('：') || line.includes(':')) {
        return true;
    }
    
    // 以"所谓"、"即"、"指的是"开头的定义句
    if (/^(所谓|即|指的是|也就是说)/.test(line)) {
        return true;
    }
    
    // 包含"第一"、"第二"等序号的短句
    if (/^(第一|第二|第三|第四|第五|第六|第七|第八|第九|第十)[、.]/.test(line)) {
        return true;
    }
    
    // 非常短的定义性句子
    if (line.length < 20 && (line.includes('是') || line.includes('为'))) {
        return true;
    }
    
    return false;
}

// 内容结构分析
function analyzeContentStructure(lines) {
    const analysis = {
        lineCount: lines.length,
        avgLength: lines.reduce((sum, line) => sum + line.length, 0) / lines.length,
        shortLines: lines.filter(line => line.length < 30).length,
        numberedLines: lines.filter(line => /^\d+[.、]/.test(line)).length,
        chineseNumberedLines: lines.filter(line => /^[一二三四五六七八九十][、]/.test(line)).length,
        bracketLines: lines.filter(line => /^[【\[\(（].*[】\]\)]/.test(line)).length,
        questionLines: lines.filter(line => line.startsWith('如何') || line.startsWith('什么') || line.startsWith('为什么') || line.startsWith('怎么')).length,
        policyLines: lines.filter(line => line.startsWith('关于') || line.startsWith('根据') || line.startsWith('按照')).length,
        colonLines: lines.filter(line => line.includes('：') || line.includes(':')).length,
        hasSpecialChars: lines.filter(line => /[！!？?]$/.test(line)).length,
        contentTypes: []
    };
    
    // 分析内容类型分布
    for (const line of lines) {
        const type = getContentType(line);
        analysis.contentTypes.push(type);
    }
    
    return analysis;
}

// 获取内容类型
function getContentType(line) {
    if (/^[•·\-\*]\s/.test(line) || /^\d+[.、]\s/.test(line)) return 'list';
    if (/^[一二三四五六七八九十][、]\s/.test(line)) return 'chinese_list';
    if (/^[【\[\(（].*[】\]\)]/.test(line)) return 'bracket';
    if (/^\d+[.、]\s/.test(line)) return 'numbered';
    if (line.startsWith('关于') || line.startsWith('根据')) return 'policy';
    if (line.startsWith('如何') || line.includes('？') || line.includes('?')) return 'question';
    if (line.length < 15 && !line.includes('，') && !line.includes('。')) return 'short';
    if (line.includes('：') || line.includes(':')) return 'definition';
    return 'paragraph';
}

// 生成主标题
function generateMainTitle(firstLine, analysis) {
    if (!firstLine || typeof firstLine !== 'string') {
        return '智能排版文档';
    }
    
    if (firstLine.length <= 30 && !firstLine.includes('。')) {
        return firstLine;
    }
    
    // 根据内容类型选择标题
    const titlePatterns = [
        { pattern: /^(.{1,20})[：:]/, title: '$1' },
        { pattern: /^(.{1,25})[！!]/, title: '$1' },
        { pattern: /^[^。！？]{8,20}/, title: '首行内容' }
    ];
    
    for (const pattern of titlePatterns) {
        const match = firstLine.match(pattern.pattern);
        if (match && match.title) {
            return match.title.trim();
        }
    }
    
    return '智能排版文档';
}

// 增强的标题检测
function detectHeadingLevel(line, analysis = null) {
    const cleanLine = line.trim();
    const length = cleanLine.length;
    
    // 明确的标题标记
    const headingPatterns = [
        // 中文数字编号
        { pattern: /^[一二三四五六七八九十][、.．]\s*/, level: 2, weight: 1.0 },
        // 阿拉伯数字编号
        { pattern: /^\d+[、.．]\s*/, level: 3, weight: 0.9 },
        // 多级数字编号
        { pattern: /^(\d+\.){2,4}\d+/, level: 2, weight: 0.8 },
        // 括号编号
        { pattern: /^[（(][一二三四五六七八九十1-9][)）]\s*/, level: 3, weight: 0.7 },
        // 方括号包围
        { pattern: /^[【\[\(（].*[】\]\)]/, level: 2, weight: 0.8 },
        // 方括号开头
        { pattern: /^【.*?】/, level: 2, weight: 0.6 },
        // 政策文件开头
        { pattern: /^关于/, level: 2, weight: 0.9 },
        // 问题型标题
        { pattern: /^如何/, level: 2, weight: 0.8 },
        // 字母编号
        { pattern: /^[A-Z]\./, level: 3, weight: 0.6 },
        // 定义型标题
        { pattern: /^[^\s]{2,15}[：:]/, level: 3, weight: 0.7 }
    ];
    
    // 精确匹配
    for (const pattern of headingPatterns) {
        if (pattern.pattern.test(cleanLine)) {
            return { isHeading: true, level: pattern.level, confidence: pattern.weight };
        }
    }
    
    // 基于长度的启发式判断
    if (length < 25 && (analysis ? analysis.shortLines > 5 : true)) {
        // 短句且无句号，可能是标题
        if (!cleanLine.includes('。') && !cleanLine.includes('！') && !cleanLine.includes('？')) {
            return { isHeading: true, level: 3, confidence: 0.4 };
        }
    }
    
    // 基于内容特征的判断
    if (length < 20 && (
        /^[^\s,.]{3,15}$/.test(cleanLine) || // 纯词组
        /^[A-Z][a-z]+$/.test(cleanLine) || // 英文单词
        cleanLine.match(/^[一-龟]{2,8}/) // 中文词组
    )) {
        return { isHeading: true, level: 4, confidence: 0.3 };
    }
    
    return { isHeading: false, level: 0, confidence: 0 };
}

// 增强的列表项检测
function isLikelyListItem(line, index, allLines, analysis) {
    const cleanLine = line.trim();
    
    // 明确的列表标记
    if (/^[•·\-\*]\s/.test(cleanLine)) return true;
    if (/^\d+[.、]\s/.test(cleanLine)) return true;
    if (/^[一二三四五六七八九十][、]\s/.test(cleanLine)) return true;
    
    // 基于上下文的智能判断
    const prevLine = index > 0 ? allLines[index - 1] : null;
    const nextLine = index < allLines.length - 1 ? allLines[index + 1] : null;
    
    // 检查是否是列表项特征
    const isShortLine = cleanLine.length < 50;
    const startsWithClause = /^(在|对于|根据|按照|通过|使用|采用)/.test(cleanLine);
    const hasVerbStart = /^(进行|实现|达到|提供|确保|保证|满足)/.test(cleanLine);
    const hasNumberStart = /^\d+[\.个分钟天月年%]+/.test(cleanLine);
    
    // 上下文判断：如果前后也是类似短句，可能是列表
    const contextScore = calculateContextScore(line, prevLine, nextLine, allLines, index);
    
    return (isShortLine && (startsWithClause || hasVerbStart || hasNumberStart)) || 
           contextScore > 0.7;
}

// 计算上下文得分
function calculateContextScore(currentLine, prevLine, nextLine, allLines, index) {
    let score = 0;
    
    // 检查是否在列表环境中
    const beforeLines = allLines.slice(Math.max(0, index - 3), index);
    const afterLines = allLines.slice(index + 1, Math.min(allLines.length, index + 3));
    
    // 检查前后是否有其他列表项
    const hasListContext = [...beforeLines, ...afterLines].some(line => 
        /^[•·\-\*]\s/.test(line) || 
        /^\d+[.、]\s/.test(line) ||
        /^[一二三四五六七八九十][、]\s/.test(line)
    );
    
    if (hasListContext) score += 0.4;
    
    // 检查格式一致性
    if (prevLine && nextLine) {
        const currentHasNumber = /\d/.test(currentLine);
        const prevHasNumber = /\d/.test(prevLine);
        const nextHasNumber = /\d/.test(nextLine);
        
        if (currentHasNumber === prevHasNumber && currentHasNumber === nextHasNumber) {
            score += 0.3;
        }
    }
    
    // 检查长度一致性
    if (prevLine && nextLine) {
        const avgLength = (prevLine.length + nextLine.length) / 2;
        const lengthDiff = Math.abs(currentLine.length - avgLength) / avgLength;
        
        if (lengthDiff < 0.5) score += 0.3;
    }
    
    return Math.min(score, 1.0);
}

// 智能段落识别
function isNewParagraph(line, prevLine, analysis) {
    const cleanLine = line.trim();
    const cleanPrev = prevLine.trim();
    
    // 如果前一行是标题，开始新段落
    const prevIsHeading = detectHeadingLevel(cleanPrev, analysis).isHeading;
    if (prevIsHeading) return true;
    
    // 如果前一行是列表项，开始新段落
    if (/^[•·\-\*]\s/.test(cleanPrev) || /^\d+[.、]\s/.test(cleanPrev)) return true;
    
    // 基于内容跳跃判断
    const contentGap = calculateContentGap(cleanLine, cleanPrev);
    if (contentGap > 0.7) return true;
    
    // 如果当前行是新的主要话题开始
    if (cleanLine.length < 30 && !cleanLine.includes('，') && 
        (/^[一二三四五六七八九十]/.test(cleanLine) || cleanLine.match(/^[^\s,.]{3,10}$/))) {
        return true;
    }
    
    return false;
}

// 计算内容跳跃度
function calculateContentGap(line1, line2) {
    const words1 = extractKeywords(line1);
    const words2 = extractKeywords(line2);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = [...new Set([...words1, ...words2])].length;
    
    if (totalWords === 0) return 1.0;
    
    return 1 - (commonWords.length / totalWords);
}

// 提取关键词
function extractKeywords(line) {
    return line
        .replace(/[，。！？；：""''（）【】【\]\[]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1 && !/^\d+$/.test(word))
        .map(word => word.toLowerCase());
}

// 增强的重点句识别
function isImportantSentence(sentence, analysis, index, allLines) {
    // 扩展关键词库
    const keywords = {
        importance: ['重要', '关键', '核心', '注意', '警告', '切记', '谨记', '必须', '务必', '至关重要', '必不可少的'],
        summary: ['总结', '结论', '小结', '概述', '综上', '总的来说', '简而言之', '综上所述', '由此可见', '总体来说'],
        features: ['特点', '特征', '优势', '优点', '特色', '显著', '独特', '区别', '不同', '优势在于'],
        suggestions: ['建议', '推荐', '应该', '提议', '不妨', '最好', '推荐使用', '建议采用', '建议使用', '可以考虑'],
        emphasis: ['尤其', '特别', '格外', '极其', '非常', '最为', '主要', '重要', '关键', '核心'],
        transition: ['但是', '然而', '不过', '相反', '反之', '但是同时', '不过需要'],
        causality: ['因此', '所以', '导致', '引起', '造成', '由于', '因为', '由于此', '为此'],
        metrics: ['增长', '提升', '下降', '超过', '达到', '突破', '增加', '减少', '改善', '提高'],
        methods: ['方法', '途径', '手段', '措施', '方案', '策略', '技巧', '办法'],
        results: ['结果', '效果', '成果', '收获', '实现', '达到', '完成']
    };
    
    // 数字和单位检测
    const hasMetrics = /\d+\.?\d*\s*[%亿万元美元个分钟天月年倍]/.test(sentence);
    const hasRange = /\d+[-\~到至]\d+/.test(sentence);
    const hasPercentage = /\d+[%％]/.test(sentence);
    
    // 句式特征检测
    const isQuestion = sentence.includes('？') || sentence.includes('?');
    const isExclamation = sentence.includes('！') || sentence.includes('!');
    const isDefinition = /[：:]/.test(sentence) && sentence.length < 40;
    const hasQuote = /["'"].*["'"]]/.test(sentence);
    const hasBookTitle = /《.*》/.test(sentence);
    const hasEmotion = /[！!？?]$/.test(sentence);
    
    // 关键词密度检测
    const keywordCount = Object.values(keywords).reduce((count, category) => {
        return count + category.filter(keyword => sentence.includes(keyword)).length;
    }, 0);
    
    // 长度和结构检测
    const isShortEmphasis = sentence.length >= 5 && sentence.length <= 20;
    const hasParallelStructure = /[和与及以及]/.test(sentence);
    
    // 上下文重要性检测
    const contextImportance = calculateContextImportance(index, allLines);
    
    // 综合评分
    let score = 0;
    
    // 关键词权重
    score += keywordCount * 0.15;
    
    // 数字和度量权重
    if (hasMetrics) score += 0.2;
    if (hasRange) score += 0.15;
    if (hasPercentage) score += 0.1;
    
    // 句式权重
    if (isQuestion) score += 0.1;
    if (isExclamation) score += 0.15;
    if (isDefinition) score += 0.2;
    if (hasQuote) score += 0.1;
    if (hasBookTitle) score += 0.1;
    
    // 结构权重
    if (isShortEmphasis) score += 0.1;
    if (hasParallelStructure) score += 0.05;
    
    // 上下文权重
    score += contextImportance * 0.2;
    
    return score > 0.3; // 阈值判断
}

// 计算上下文重要性
function calculateContextImportance(index, allLines) {
    let importance = 0;
    
    // 边界检查
    if (!allLines || allLines.length === 0 || index < 0 || index >= allLines.length) {
        return 0;
    }
    
    // 检查是否是开头的重要信息
    if (index < 3) importance += 0.2;
    
    // 检查是否是结尾的总结信息
    if (index > allLines.length - 5) importance += 0.15;
    
    // 检查是否包含总结性词汇
    const currentLine = allLines[index];
    if (currentLine && typeof currentLine === 'string') {
        const summaryWords = ['总结', '结论', '总的来说', '综上所述', '最终'];
        if (summaryWords.some(word => currentLine.includes(word))) {
            importance += 0.3;
        }
    }
    
    return Math.min(importance, 0.5);
}

// 检测引用文本
function isQuoteText(line) {
    // 优先排除数字编号的列表项（避免误判为引用）
    if (/^[第]?[一二三四五六七八九十\d]+[、.]/.test(line) || /^\d+[.、]/.test(line)) {
        return false;
    }
    
    // 严格检查引用标记：必须同时开始和结束为引号，且长度适中
    const startsWithQuote = line.startsWith('"') || line.startsWith('"') || line.startsWith('「');
    const endsWithQuote = line.endsWith('"') || line.endsWith('"') || line.endsWith('」');
    const isShortQuote = line.length < 100 && !line.includes('——'); // 排除包含破折号的文本
    
    return line.startsWith('>') || 
           (startsWithQuote && endsWithQuote && isShortQuote);
}

// 格式化引用
function formatQuote(line, analysis) {
    // 只移除明显的引用标记，不要影响其他字符
    let content = line.trim();
    content = content.replace(/^>/, '').trim(); // 移除 >
    content = content.replace(/^[""«]/, '').replace(/[""»]$/, '').trim(); // 移除引号
    return `> ${content}`;
}

// 格式化列表项
function formatListItem(line, analysis) {
    const cleanLine = line.trim();
    
    // 保持原有的列表标记
    if (/^[•·\-\*]\s/.test(cleanLine)) {
        return cleanLine;
    }
    
    if (/^\d+[.、]\s/.test(cleanLine)) {
        return cleanLine;
    }
    
    if (/^[一二三四五六七八九十][、]\s/.test(cleanLine)) {
        return cleanLine;
    }
    
    // 如果没有明确的列表标记，添加默认的
    return `- ${cleanLine}`;
}

// 格式化段落
function formatParagraph(lines, analysis) {
    if (lines.length === 0) return '';
    
    if (lines.length === 1) {
        // 单行段落
        const line = lines[0];
        
        // 检查是否是重点内容
        const isImportant = isImportantSentence(line, analysis, 0, lines);
        if (isImportant) {
            // 对重要内容添加加粗标记
            return `**${line}**`;
        }
        
        return line;
    }
    
    // 多行段落 - 智能合并
    let paragraph = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 检查是否需要加粗
        const isImportant = isImportantSentence(line, analysis, i, lines);
        
        if (isImportant) {
            paragraph += `**${line}**`;
        } else {
            paragraph += line;
        }
        
        // 添加连接词（除了最后一行）
        if (i < lines.length - 1) {
            paragraph += '，';
        }
    }
    
    return paragraph;
}

// 清理和优化Markdown
function cleanMarkdown(markdown) {
    return markdown
        .replace(/。{2,}/g, '。') // 多个句号合并
        .replace(/！{2,}/g, '！') // 多个感叹号合并
        .replace(/？{2,}/g, '？') // 多个问号合并
        .replace(/^([•·\-\*])\s+/gm, '$1 ') // 清理列表格式
        .replace(/\n#+\s*\n/g, '\n') // 移除空的标题
        .trim();
}

// 导出为全局函数（兼容浏览器和Node.js环境）
if (typeof module !== 'undefined' && module.exports) {
    // Node.js 环境
    module.exports = {
        formatTextToMarkdown
    };
} else if (typeof window !== 'undefined') {
    // 浏览器环境
    window.formatTextToMarkdown = formatTextToMarkdown;
}

// 使用示例：
// 在HTML中引入：<script src="js/text-formatter.js"></script>
// 使用方法：formatTextToMarkdown("你的原始文本")
// 或使用Node.js：const formatter = require('./js/text-formatter.js'); formatter.formatTextToMarkdown("你的原始文本")