function getTotalPages(dataList, currentPage, pageSize) {
  return Math.ceil(dataList.length / pageSize);
}

function getPageData(dataList, currentPage, pageSize) {
  var start = (currentPage - 1) * pageSize;
  var end = start + pageSize;
  return dataList.slice(start, end);
}

function previousPage(dataList, currentPage, pageSize) {
  if (currentPage > 1) {
    currentPage--;
  }
  return getPageData(dataList, currentPage, pageSize);
}

function nextPage(dataList, currentPage, pageSize) {
  if (currentPage < getTotalPages(dataList, currentPage, pageSize)) {
    currentPage++;
  }
  return getPageData(dataList, currentPage, pageSize);
}
