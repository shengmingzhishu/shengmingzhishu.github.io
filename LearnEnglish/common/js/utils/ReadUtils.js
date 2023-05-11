/**
 * 段落拆分
 * */
function readSplitParagraph(englishParagraph, chineseParagraph) {
    // 中文与英文段落拆分为 短句数组
    let English = splitEnglish(englishParagraph)
    let Chinese = splitChinese(chineseParagraph)
    let len = Math.min(English.length, Chinese.length)

    // 拼接短句数组元素
    let list = []
    for (let i = 0; i < len; i++) {
        let obj = {
            EnglishPhrase: English[i],
            ChinesePhrase: Chinese[i],
            EnglishWords: English[i].split(' '),
            ChineseWords: Chinese[i].split(''),
        }
        list.push(obj)
    }
    return list
}

/**
 * 章节拆分英文短语数组
 */
function splitEnglish(englishParagraph) {
    let phrase = englishParagraph.replaceAll(',', '.')
        .replaceAll('  ', ' ')
        .split('.');
    phrase = phrase.map(item => item.trim()).filter(item => item !== '')
    return phrase
}

/**
 * 章节拆分中文短语数组
 */
function splitChinese(chineseParagraph) {
    let phrase = chineseParagraph.replaceAll('，', '。')
        .replaceAll('；', '。')
        .replaceAll('  ', ' ')
        .split('。');
    phrase = phrase.map(item => item.trim()).filter(item => item !== '')
    return phrase
}
