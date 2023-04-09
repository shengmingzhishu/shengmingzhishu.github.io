

function getBookEnum(){
    return {
        BOOK50TO700Words: { bookNo: 1, bookName: '50句子7000词', path: 'wordlearn/phrase/50句子700词.js.js' },
        LuoMaJiaRi: { bookNo: 2, bookName: '羅馬假日', path: 'wordlearn/phrase/罗马假日.js' },
        ZaoAnYingYu: { bookNo: 3, bookName: '早安英语', path: 'wordlearn/phrase/早安英语.js' }
    }
}

function getIndexBook(num){
    switch (num){
        case 1:
            return get50To7000BookStr()
        case 2:
            return getLuoMaJiaRiBookStr()
        case 3:
            return getZaoAnYingYuBookStr()
        default:
            return get50To7000BookStr()
    }
}