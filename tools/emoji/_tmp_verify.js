// -*- coding: utf-8 -*-
const puppeteer=require('puppeteer-core');
const path=require('path');

const HTML=path.resolve(__dirname,'emoji-splitter-v11.html');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';

(async()=>{
  const browser=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-web-security']});
  const page=await browser.newPage();
  await page.setViewport({width:1500,height:950,deviceScaleFactor:1});
  const errors=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('pageerror',e=>errors.push('PAGEERR: '+e.message));
  await page.goto('file:///'+HTML.replace(/\\/g,'/'),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction('typeof parseBulkText==="function" && typeof eraseThinLines==="function" && typeof setBannerCropPreset==="function"',{timeout:15000});

  const results=await page.evaluate(async()=>{
    const out=[];
    function rec(name,pass,detail){out.push({name,pass,detail});}

    // ===== 1 & 2: 文字等比例缩放 =====
    try{
      const emoji={custom:createDefaultCustom(),text:'T',text2:''};
      const r240=getEffectiveStyles(emoji,1,1);
      const r120=getEffectiveStyles(emoji,120/240,1);
      const r50 =getEffectiveStyles(emoji,50/240,1);
      const r96 =getEffectiveStyles(emoji,96/240,1);
      const ok = r120.strokeWidth<r240.strokeWidth && r50.strokeWidth<r120.strokeWidth
              && r120.strokeWidth===2 && r120.fontSize===14 && r120.offset===4 && r120.shadowBlur===2
              && r50.strokeWidth===1 && r50.fontSize===6
              && r96.strokeWidth===Math.round(3*96/240);
      rec('1&2 文字等比例缩放(描边/阴影/偏移随尺寸变小)',ok,
        '240:'+JSON.stringify({fs:r240.fontSize,sw:r240.strokeWidth,off:r240.offset,sb:r240.shadowBlur})+
        ' | 120:'+JSON.stringify({fs:r120.fontSize,sw:r120.strokeWidth,off:r120.offset,sb:r120.shadowBlur})+
        ' | 50:'+JSON.stringify({fs:r50.fontSize,sw:r50.strokeWidth})+
        ' | 96:'+JSON.stringify({sw:r96.strokeWidth}));
    }catch(e){rec('1&2 文字等比例缩放',false,String(e));}

    // ===== 4: 批量文字空格分隔双文字 =====
    try{
      state.emojis=[
        {text:'',text2:'',custom:createDefaultCustom()},
        {text:'',text2:'',custom:createDefaultCustom()}
      ];
      $('bulkText').value='开心 很开心\n难过 伤心的';
      parseBulkText();
      const e0=state.emojis[0], e1=state.emojis[1];
      const ok=e0.text==='开心'&&e0.text2==='很开心'&&e1.text==='难过'&&e1.text2==='伤心的';
      rec('4 批量文字 空格分隔->文字1/文字2',ok,JSON.stringify({e0:e0.text+'/'+e0.text2,e1:e1.text+'/'+e1.text2}));
    }catch(e){rec('4 批量文字',false,String(e));}

    // ===== 3: 横幅预设/自定义尺寸 =====
    try{
      openBannerModal();
      await new Promise(r=>setTimeout(r,120));
      // 预设 1080x1080
      const p1080=document.querySelector('#v10BannerSizePresets .preset-btn[data-w="1080"][data-h="1080"]');
      p1080.click();
      await new Promise(r=>setTimeout(r,30));
      const cw=state.bannerState.cropW, ch=state.bannerState.cropH;
      const title=$('v10BannerTitleSize').textContent;
      const presetOk = cw===1080&&ch===1080&&title==='1080×1080';
      // 自定义尺寸
      $('v10BannerCustomSize').checked=true; toggleBannerCustomSize(true);
      await new Promise(r=>setTimeout(r,20));
      $('v10BannerCustomW').value=300; $('v10BannerCustomH').value=200; setBannerCustomSize();
      await new Promise(r=>setTimeout(r,20));
      const cw2=state.bannerState.cropW, ch2=state.bannerState.cropH;
      const customOk = state.bannerState.customSize===true && cw2===300 && ch2===200;
      // 切回预设应退出自定义
      document.querySelector('#v10BannerSizePresets .preset-btn[data-w="750"][data-h="400"]').click();
      await new Promise(r=>setTimeout(r,20));
      const backOk = state.bannerState.customSize===false && state.bannerState.cropW===750;
      rec('3 横幅预设/自定义尺寸切换', presetOk&&customOk&&backOk,
        'preset1080:'+presetOk+'(cw='+cw+',ch='+ch+',title='+title+') custom:'+customOk+'(cw2='+cw2+',ch2='+ch2+') back:'+backOk);
      closeBannerModal();
    }catch(e){rec('3 横幅尺寸',false,String(e));}

    // ===== 6: 擦窄线算法 =====
    try{
      // 30x30: 白色细横线 + 细竖线(交叉) + 6x6 白色实心块
      const c=document.createElement('canvas');c.width=30;c.height=30;
      const cx=c.getContext('2d');cx.clearRect(0,0,30,30);
      cx.fillStyle='#ffffff';
      cx.fillRect(2,15,26,1);   // 横线 y=15
      cx.fillRect(15,2,1,26);   // 竖线 x=15 (与横线交叉)
      cx.fillRect(0,0,6,6);     // 厚块
      eraseThinLines(c,'#ffffff',2,45);
      const d=cx.getImageData(0,0,30,30).data;
      const a=(x,y)=>d[(y*30+x)*4+3];
      const lineGone = a(8,15)===0 && a(22,15)===0;
      const vlineGone = a(15,8)===0 && a(15,22)===0;
      const crossGone = a(15,15)===0;
      const blockKept = a(2,2)!==0 && a(4,4)!==0 && a(3,5)!==0;
      rec('6 擦窄线(横/竖/交叉擦除,厚块保留)', lineGone&&vlineGone&&crossGone&&blockKept,
        JSON.stringify({lineGone,vlineGone,crossGone,blockKept}));
    }catch(e){rec('6 擦窄线算法',false,String(e));}

    // ===== 6b: 抠图设置面板 & 橡皮擦弹窗 擦窄线控件存在性 =====
    try{
      const cutChk=!!$('cleanThinLine');
      const cutColor=!!$('cleanThinLineColor');
      const cutW=!!$('cleanThinLineWidth');
      // 橡皮擦弹窗按钮
      const ribBtns=Array.from(document.querySelectorAll('.er-sm-btn')).map(b=>b.textContent.trim());
      const hasRib=ribBtns.includes('擦窄线');
      const erW=!!$('eraserThinWidth');
      rec('6 擦窄线控件存在(抠图面板+橡皮擦弹窗)', cutChk&&cutColor&&cutW&&hasRib&&erW,
        JSON.stringify({cutChk,cutColor,cutW,hasRib,erW,ribBtns}));
    }catch(e){rec('6 擦窄线控件',false,String(e));}

    // ===== 5: 文字拖拽可达上半部分(模拟 mousedown+mousemove) =====
    try{
      // 准备一张带白色主体的 100x100 表情
      const sc=document.createElement('canvas');sc.width=100;sc.height=100;
      const sx=sc.getContext('2d');sx.fillStyle='#ffffff';sx.fillRect(35,35,30,30);
      state.emojis=[{canvas:sc,text:'测试',text2:'',index:0,cropInfo:{},custom:createDefaultCustom()}];
      state.styles.position='bottom';
      renderEmojis();
      await new Promise(r=>setTimeout(r,40));
      const canvas=document.querySelector('#preview-0 canvas');
      const rect=canvas.getBoundingClientRect();
      const tb=state.emojis[0].textBounds;
      if(!tb){rec('5 文字拖拽可达上半部分',false,'textBounds null');return out;}
      // 点击文字中心
      const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
      const cxp=rect.left+(tb.x+tb.w/2)/scaleX;
      const cyp=rect.top+(tb.y+tb.h/2)/scaleY;
      canvas.scrollIntoView();
      canvas.dispatchEvent(new MouseEvent('mousedown',{clientX:cxp,clientY:cyp,bubbles:true,cancelable:true}));
      // 向上拖动 1.2 倍画布高(超过旧 -40 上限)
      window.dispatchEvent(new MouseEvent('mousemove',{clientX:cxp,clientY:cyp-rect.height*1.2,bubbles:true,cancelable:true}));
      window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,cancelable:true}));
      const tp=state.emojis[0].custom.textPosY;
      rec('5 文字拖拽可达上半部分(textPosY<=-80)', tp<=-80, 'textPosY='+tp);
    }catch(e){rec('5 文字拖拽',false,String(e));}

    return out;
  });

  // 检查源码: 旧 -40 clamp 已移除
  const srcCheck=await page.evaluate(()=>{
    const code=document.documentElement.outerHTML;
    return {
      oldClampGone: !code.includes('Math.min(40,dragState.startOffX+percentX/2)'),
      newClamp: code.includes('Math.min(100,dragState.startOffX+percentX)')
    };
  });

  console.log('\n========== 验证结果 ==========');
  let allPass=true;
  for(const r of results){
    console.log((r.pass?'✅ PASS':'❌ FAIL')+'  '+r.name+'  '+(r.detail?('('+r.detail+')'):''));
    if(!r.pass)allPass=false;
  }
  console.log('--- 源码clamp ---', JSON.stringify(srcCheck));
  if(!srcCheck.oldClampGone||!srcCheck.newClamp)allPass=false;
  if(errors.length){console.log('--- 页面错误 ---');errors.slice(0,10).forEach(e=>console.log('  '+e));allPass=false;}
  console.log('\n总结: '+(allPass?'全部通过 ✅':'存在失败 ❌'));
  await browser.close();
  process.exit(allPass?0:1);
})().catch(e=>{console.error('VERIFY ERROR:',e);process.exit(2);});
