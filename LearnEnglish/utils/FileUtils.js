/**
 * 段落拆分
 * */
function readParagraph(paragraph) {
    debugger
    paragraphArr = paragraph.replaceAll("\n\n", "\n").replaceAll("\n\n", "\n").split("\n");
    paragraphArr = paragraphArr.map(item => item.trim()).filter(item => item !== '')
    let len = paragraphArr.length % 2 == 0 ? paragraphArr.length : paragraphArr.length - 1

    // 拼接短句数组元素
    let list = []
    for (let i = 0; i < len; i = i + 2) {
        let obj = {
            EnglishPhrase: paragraphArr[i],
            ChinesePhrase: paragraphArr[i + 1],
            EnglishWordInfo: {
                Words: paragraphArr[i].split(' '),
                HideWords: paragraphArr[i].split(' ').map(item => toLine(item)),
                ShowFlags:  paragraphArr[i].split(' ').map(item => true),// 默认显示单词
            },
            ChineseWordInfo: {
                Words: paragraphArr[i + 1].split(''),
                HideWords: paragraphArr[i+1].split('').map(item => toLine(item)),
                ShowFlags:  paragraphArr[i+1].split('').map(item => true),// 默认显示单词
            }
        }
        list.push(obj)
    }
    return list
}

function toLine(str) {
    let ret = ''
    for (let i = 0; i < str.length; i++) {
        ret = ret + '_'
    }
    return ret
}