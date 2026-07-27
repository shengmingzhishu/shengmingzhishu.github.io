(function() {
  'use strict';

  var div = document.getElementById('qinghu-cover-executor');
  if (!div) return;

  var action = div.getAttribute('data-action');
  var dataUrl = div.getAttribute('data-url');
  var markerId = div.getAttribute('data-marker');
  var marker = document.getElementById(markerId);

  if (!action || !dataUrl || !marker) {
    if (marker) marker.setAttribute('data-result', JSON.stringify({ success: false, error: 'missing params' }));
    return;
  }

  (async function() {
    try {
      if (action === 'setCover') {
        if (!window.__qinghu_douyin || !window.__qinghu_douyin.setCover) {
          marker.setAttribute('data-result', JSON.stringify({ success: false, error: 'setCover not available' }));
          return;
        }
        var r = await window.__qinghu_douyin.setCover(dataUrl);
        marker.setAttribute('data-result', JSON.stringify(r));
      } else if (action === 'setHeadCover') {
        if (!window.__qinghu_douyin || !window.__qinghu_douyin.setHeadCover) {
          marker.setAttribute('data-result', JSON.stringify({ success: false, error: 'setHeadCover not available' }));
          return;
        }
        var r = await window.__qinghu_douyin.setHeadCover(dataUrl);
        marker.setAttribute('data-result', JSON.stringify(r));
      }
    } catch(e) {
      marker.setAttribute('data-result', JSON.stringify({ success: false, error: e.message }));
    }
  })();
})();
