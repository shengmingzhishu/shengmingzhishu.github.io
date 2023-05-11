const colorList = [
    "btn mr5 mb5 btn-primary"
    , "btn mr5 mb5 btn-success"
    , "btn mr5 mb5 btn-danger"
    , "btn mr5 mb5 btn-warning"
    , "btn mr5 mb5 btn-info"]

/**
 * 段落拆分
 * */
function readParagraph(paragraph) {
    paragraphArr = paragraph.replaceAll("\n\n", "\n").replaceAll("\n\n", "\n").split("\n");
    paragraphArr = paragraphArr.map(item => item.trim()).filter(item => item !== '')
    let len = paragraphArr.length % 2 == 0 ? paragraphArr.length : paragraphArr.length - 1

    // 拼接短句数组元素
    let list = []
    for (let i = 0; i < len; i = i + 2) {
        let EnglishWords = paragraphArr[i].split(' ');
        let ChineseWords = paragraphArr[i + 1].split('');
        let obj = {
            EnglishPhrase: paragraphArr[i],
            ChinesePhrase: paragraphArr[i + 1],
            EnglishWordInfo: {
                SuccessWords: EnglishWords.map(item => item),
                Words: EnglishWords.map(item => item),
                WordsClass: EnglishWords.map((item, index) => buttonColorClass(index)),
                WordsEnabled: EnglishWords.map((item, index) => false),
                HideWords: EnglishWords.map(item => toLine(item)),
                ShowFlags: EnglishWords.map(item => true),// 默认显示单词
                SelectedWords: EnglishWords.map(item => toLine(item))
            },
            ChineseWordInfo: {
                Words: ChineseWords.map(item => item),
                HideWords: ChineseWords.map(item => toLine(item)),
                ShowFlags: ChineseWords.map(item => true),// 默认显示单词
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

function buttonColorClass(index) {
    let arr = colorList
    return arr[parseInt(index % arr.length)]
}