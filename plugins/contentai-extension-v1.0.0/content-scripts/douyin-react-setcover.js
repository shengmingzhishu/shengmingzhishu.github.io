(function() {
  'use strict';

  window.__qinghu_douyin = window.__qinghu_douyin || {};

  function findReactFiber(element) {
    for (var key of Object.keys(element)) {
      if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance')) return element[key];
    }
    return null;
  }

  function findComponentWithSetItem(startFiber) {
    var current = startFiber, depth = 0;
    while (current && depth < 30) {
      var props = current.memoizedProps;
      if (props && typeof props.setItem === 'function' && props.item && typeof props.item === 'object') {
        if (Object.keys(props.item).includes('long_article_title') || Object.keys(props.item).includes('long_article_cover_info')) return current;
      }
      current = current.return; depth++;
    }
    return null;
  }

  function getImageSize(dataUri) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload = function() { resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
      img.onerror = function() { resolve({ width: 800, height: 1200 }); };
      img.src = dataUri;
    });
  }

  window.__qinghu_douyin.setCover = async function(coverUri) {
    try {
      var coverDiv = document.querySelector('.mycard-c48v6G, .content-upload-ksKds3');
      if (!coverDiv) return { success: false, error: 'no cover area' };
      var fiber = findReactFiber(coverDiv);
      if (!fiber) return { success: false, error: 'no fiber' };
      var cf = findComponentWithSetItem(fiber);
      if (!cf) return { success: false, error: 'setItem not found' };
      var item = cf.memoizedProps.item;
      var setItem = cf.memoizedProps.setItem;
      var size = await getImageSize(coverUri);

      setItem({...item, long_article_cover_info: { uri: coverUri, width: size.width, height: size.height, is_default_cover: false }, cover_editor: { ...item.cover_editor, background: { uri: coverUri, width: size.width, height: size.height } }});

      document.querySelectorAll('.cover-Uudq5y').forEach(function(el) {
        el.style.backgroundImage = 'url("' + coverUri + '")';
        el.style.backgroundColor = '#000';
        el.style.backgroundSize = '100%';
        el.style.backgroundPositionY = 'center';
        el.style.backgroundRepeat = 'no-repeat';
      });

      await new Promise(function(r) { setTimeout(r, 2000); });

      document.querySelectorAll('.cover-Uudq5y').forEach(function(el) {
        el.style.backgroundImage = 'url("' + coverUri + '")';
        el.style.backgroundColor = '#000';
      });

      var ci = document.querySelector('.cover-Uudq5y');
      if (ci) {
        var fi = findReactFiber(ci);
        if (fi && fi.return && fi.return.type && fi.return.type.name === 'oN') {
          var dispatch = fi.return.memoizedState && fi.return.memoizedState.queue && fi.return.memoizedState.queue.dispatch;
          if (dispatch) {
            dispatch({backgroundImage: 'url("' + coverUri + '")', backgroundColor: '#000', backgroundSize: '100%', backgroundPositionY: 'center', backgroundRepeat: 'no-repeat'});
          }
        }
      }

      return { success: true };
    } catch(e) {
      return { success: false, error: e.message };
    }
  };

  window.__qinghu_douyin.setHeadCover = async function(headCoverUri) {
    try {
      var se = document.querySelector('.uploadButton-B4xMQ2') || document.querySelector('.mycard-c48v6G');
      if (!se) return { success: false, error: 'no start element' };
      var fiber = findReactFiber(se);
      if (!fiber) return { success: false, error: 'no fiber' };
      var cf = findComponentWithSetItem(fiber);
      if (!cf) return { success: false, error: 'setItem not found' };
      var item = cf.memoizedProps.item;
      var setItem = cf.memoizedProps.setItem;
      var size = await getImageSize(headCoverUri);

      setItem({...item, long_article_head_cover_info: { ...item.long_article_head_cover_info, uri: headCoverUri, width: size.width, height: size.height, isHeadImageMode: true }});

      document.querySelectorAll('.cover-M3xhmW').forEach(function(el) {
        var img = el.querySelector('img');
        if (img) img.src = headCoverUri;
      });

      await new Promise(function(r) { setTimeout(r, 2000); });

      document.querySelectorAll('.cover-M3xhmW').forEach(function(el) {
        var img = el.querySelector('img');
        if (img) img.src = headCoverUri;
      });

      var hd = document.querySelector('.cover-M3xhmW');
      if (hd) {
        var hf = findReactFiber(hd);
        if (hf && hf.return && hf.return.type && hf.return.type.name === 'aQ') {
          var s1 = hf.return.memoizedState;
          if (s1) {
            var dI = s1.queue && s1.queue.dispatch;
            var dL = s1.next && s1.next.queue && s1.next.queue.dispatch;
            var dE = s1.next && s1.next.next && s1.next.next.queue && s1.next.next.queue.dispatch;
            if (dL) dL(false);
            if (dE) dE(false);
            if (dI) setTimeout(function() { dI(headCoverUri); }, 100);
          }
        }
      }

      return { success: true };
    } catch(e) {
      return { success: false, error: e.message };
    }
  };

  console.log('[Qinghu] douyin-react-setcover.js v6 loaded');
})();
