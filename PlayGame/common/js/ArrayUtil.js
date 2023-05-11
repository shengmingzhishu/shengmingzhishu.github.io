var dict = [
    {cn: '1', en: '1'}, 
    {cn: '2', en: '2'}, 
    {cn: '3', en: '3'}, 
    {cn: '4', en: '4'}, 
    {cn: '5', en: '5'}, 
    {cn: '6', en: '6'}, 
    {cn: '7', en: '7'}, 
    {cn: '8', en: '8'}
];
var currentPage = 1; 
var pageSize = 3;

function getTotalPages() {
  return Math.ceil(dict.length / pageSize);
}

function getPageData() {
  var start = (currentPage - 1) * pageSize;
  var end = start + pageSize;
  return dict.slice(start, end);
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    getPageData();
  }
}

function nextPage() {
  if (currentPage < getTotalPages()) {
    currentPage++;
    getPageData();
  }
}
