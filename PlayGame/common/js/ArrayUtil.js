var dict = [
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
