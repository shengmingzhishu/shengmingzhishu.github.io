

function getBookEnum(){
    return {
        BOOK50TO700Words: { bookNo: 1, bookName: '50句子7000词', path: 'wordlearn/phrase/50句子700词.min.js' },
        BOOK50Words: { bookNo: 2, bookName: '50短句', path: 'wordlearn/phrase/50短句.min.js' },
        LuoMaJiaRi: { bookNo: 3, bookName: '羅馬假日', path: 'wordlearn/phrase/罗马假日.min.js' },
        ZaoAnYingYu: { bookNo: 4, bookName: '早安英语', path: 'wordlearn/phrase/早安英语.min.js' }
    }
}

function getIndexBook(num){
    switch (num){
        case 1:
            return get50To7000BookStr()
        case 2:
            return get50BookStr()
        case 3:
            return getLuoMaJiaRiBookStr()
        case 4:
            return getZaoAnYingYuBookStr()
        default:
            return get50To7000BookStr()
    }
}