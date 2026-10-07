// Local offline artifact verification using the repository's existing isolated CDP browser helper.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { launchChrome, waitFor } from '../../../portal-fe/public/games/twin-banner-defense/tools/cdp.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const url = new URL('./exploration-prototype.html', import.meta.url).href;
const report = { checks: [], runtimeErrors: [], screenshots: [], browser: 'isolated headless Chrome / existing native CDP helper' };
let browser;
async function check(name, fn) { await fn(); report.checks.push({ name, status: 'pass' }); console.log(`PASS ${name}`); }
async function choose(page, selector, value) { await page.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`); }
async function key(page, key, code, keyCode) { await page.call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode }); await page.call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode }); }
async function screenshot(page, name) { const { data } = await page.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(path.join(here, 'evidence', name), Buffer.from(data, 'base64')); report.screenshots.push(`evidence/${name}`); }
try {
  browser = await launchChrome();
  browser.listeners.add(event => { if (event.method === 'Runtime.exceptionThrown') report.runtimeErrors.push(event.params.exceptionDetails.text); });
  await mkdir(path.join(here, 'evidence'), { recursive: true });
  const page = await browser.page(url, { width: 1440, height: 1100 });
  await waitFor(() => page.evaluate('document.querySelectorAll("[data-card]").length===6'), { label: 'prototype initial results' });
  await check('1440 desktop: six matching cards/pins, 46/54 split, no horizontal overflow', async () => {
    const value = await page.evaluate(`(()=>{const grid=document.querySelector('.result-grid'),list=document.querySelector('.list-panel'),map=document.querySelector('.map-panel');return {cards:document.querySelectorAll('[data-card]').length,pins:document.querySelectorAll('.map-pin').length,list:list.offsetWidth,map:map.offsetWidth,grid:grid.offsetWidth,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
    assert.equal(value.cards, 6); assert.equal(value.pins, 6); assert.equal(value.overflow, false); assert.ok(Math.abs(value.list/(value.list+value.map)-.46)<.01);
    const ordinalPhoto = await page.evaluate(`(()=>{const cards=[...document.querySelectorAll('[data-card]')];return cards.map((card,i)=>{const photo=card.querySelector('.card-photo'),r=photo.getBoundingClientRect();return {ordinal:card.querySelector('.card-ordinal').textContent,number:String(i+1),photoRatio:r.width/r.height,pin:document.querySelector('.map-pin[data-id='+card.dataset.card+']').textContent}})})()`);
    ordinalPhoto.forEach(v=>{assert.equal(v.ordinal,v.number);assert.equal(v.ordinal,v.pin);assert.ok(Math.abs(v.photoRatio-4/3)<.01)});
  });
  await screenshot(page, 'prototype-desktop-search.png');
  await check('search suggestions: keyboard selection and Korean composition Enter guard', async () => {
    await page.fill('#search-input', '경복'); await key(page, 'ArrowDown', 'ArrowDown', 40); await key(page, 'Enter', 'Enter', 13);
    assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'), 1);
    await page.click('#reset-prototype');
    await page.evaluate(`(()=>{const el=document.querySelector('#search-input');el.focus();el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.value='궁';el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}));el.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));})()`);
    assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'), 6);
    await page.evaluate(`document.querySelector('#search-input').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}))`);
    await page.fill('#search-input', '궁궐'); await page.click('#search-form .primary');
    assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'), 2);
    await page.click('#reset-prototype');
  });
  await check('filter draft: Escape cancels and restores focus; apply/reset change results only on apply', async () => {
    await page.click('#open-filters'); await page.click('#filter-body input[value="free"]');
    assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'), 6);
    await key(page, 'Escape', 'Escape', 27);
    assert.equal(await page.evaluate('document.querySelector("#filter-dialog").open'), false);
    assert.equal(await page.evaluate('document.activeElement.id'), 'open-filters');
    await page.click('#open-filters'); assert.equal(await page.evaluate('document.querySelector("#filter-body input[value=free]").checked'), false);
    await page.click('#filter-body input[value="free"]'); await page.click('#filter-apply');
    assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'), 3);
    await page.click('#open-filters'); await page.click('#filter-reset');
    assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'), 3);
    await page.click('#filter-apply'); assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'), 6);
  });
  await check('category OR + facility AND: history/culture yields 4, wheelchair narrows to 3', async () => {
    await page.click('#open-filters');
    await page.click('#filter-body input[value="history"]'); await page.click('#filter-body input[value="culture"]'); await page.click('#filter-apply');
    assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'),4);
    await page.click('#open-filters'); await page.click('#filter-body input[value="wheelchair"]'); await page.click('#filter-apply');
    assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'),3);
    await page.click('#reset-prototype');
  });
  await check('pin/card synchronization and detail/back restore query, filters, selection and scroll', async () => {
    await page.click('.map-pin[data-id="museum"]'); assert.equal(await page.evaluate('document.querySelector("[data-card=museum]").classList.contains("is-selected")'), true);
    await page.click('[data-card=forest] [data-action=select]'); assert.equal(await page.evaluate('document.querySelector(".map-pin[data-id=forest]").getAttribute("aria-pressed")'), 'true');
    await page.evaluate('window.scrollTo(0,400)');
    // Capture before click because the CDP helper intentionally scrolls its target into view.
    await page.evaluate(`document.querySelector('[data-card=forest] [data-action=detail]').click()`);
    assert.equal(await page.evaluate('document.querySelector(".detail-title h1").textContent'), '서울숲');
    await page.click('#detail-back'); assert.equal(await page.evaluate('document.querySelector("[data-card=forest]").classList.contains("is-selected")'), true);
    await waitFor(() => page.evaluate('Math.abs(scrollY-400)<3'), { label: 'restored result scroll' });
  });
  await check('save/count/saved view, order change, session note, share preview and removal', async () => {
    await page.click('[data-card=forest] [data-action=save]'); await page.click('[data-card=palace] [data-action=save]');
    assert.equal(await page.evaluate('document.querySelector("#save-count").textContent'), '2');
    await choose(page, '#screen-control', 'saved');
    assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'), 2);
    await page.click('[data-card=palace] [data-action=move-up]'); assert.equal(await page.evaluate('document.querySelector("[data-card]").dataset.card'), 'palace');
    await page.fill('#collection-title', '서울 주말 후보'); await page.fill('#note-palace', '휴무 먼저 확인');
    await page.click('[data-action=share-list]'); assert.equal(await page.evaluate('document.querySelector("#share-dialog").open'), true);
    assert.equal(await page.evaluate('document.querySelector(".share-title").textContent'), '서울 주말 후보'); assert.ok((await page.evaluate('document.querySelector("#share-body").textContent')).includes('휴무 먼저 확인'));
    await key(page, 'Escape', 'Escape', 27); await page.click('[data-card=palace] .save-button'); assert.equal(await page.evaluate('document.querySelector("#save-count").textContent'), '1');
    await page.click('[data-card=forest] .save-button'); assert.ok((await page.evaluate('document.querySelector("#app").textContent')).includes('아직 저장한 곳이 없습니다'));
  });
  await check('loading, zero results, search error/retry, map error/list fallback', async () => {
    await choose(page, '#state-control', 'loading'); assert.equal(await page.evaluate('document.querySelectorAll(".loading-card").length'), 3);
    await choose(page, '#state-control', 'empty'); assert.ok((await page.evaluate('document.querySelector("#app").textContent')).includes('조건에 맞는 후보가 없습니다'));
    await choose(page, '#state-control', 'error'); await page.click('[data-action=retry]'); assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'), 6);
    await choose(page, '#state-control', 'map-error'); assert.equal(await page.evaluate('document.querySelectorAll("[data-card]").length'), 6); assert.ok((await page.evaluate('document.querySelector(".map-panel").textContent')).includes('지도를 불러오지 못했습니다'));
    await page.click('[data-action=retry]');
  });
  await check('desktop phone frame uses genuine single-column cards; dialog is outside frame', async () => {
    await choose(page, '#device-control', 'phone');
    assert.ok(await page.evaluate(`(()=>{const f=document.querySelector('#frame'),map=document.querySelector('.map-panel');return f.offsetWidth<=390&&getComputedStyle(map).display==='none'})()`));
    await page.click('#open-filters'); assert.equal(await page.evaluate('document.querySelector("#frame").contains(document.querySelector("#filter-dialog"))'), false); await key(page,'Escape','Escape',27);
    await choose(page, '#device-control', 'desktop');
  });
  for (const width of [390,320]) {
    const mobile = await browser.page(url,{width,height:1000});
    await waitFor(()=>mobile.evaluate('document.querySelectorAll("[data-card]").length===6'),{label:`${width} mobile ready`});
    await check(`${width}px: results/map/detail/saved/discovery have no document overflow; mobile dialog and list/map work`,async()=>{
      assert.equal(await mobile.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
      assert.equal(await mobile.evaluate('getComputedStyle(document.querySelector(".map-panel")).display'),'none');
      if(width===390)await screenshot(mobile,'prototype-mobile-search.png');
      await mobile.click('[data-action=mode][data-mode=map]'); assert.equal(await mobile.evaluate('getComputedStyle(document.querySelector(".list-panel")).display'),'none');
      assert.equal(await mobile.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
      await mobile.click('.map-selection [data-action=detail]'); assert.equal(await mobile.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
      assert.ok(await mobile.evaluate('getComputedStyle(document.querySelector(".detail-mobile-actions")).display!=="none"'));
      await mobile.click('#detail-back');
      await mobile.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      await mobile.click('[data-action=mode][data-mode=list]');
      await mobile.click('#open-filters'); assert.equal(await mobile.evaluate('document.querySelector("#filter-dialog").open'),true); assert.equal(await mobile.evaluate('document.querySelector("#filter-dialog").getBoundingClientRect().right<=innerWidth'),true); await key(mobile,'Escape','Escape',27);
      for(const screen of ['discovery','saved','detail','results']){await choose(mobile,'#screen-control',screen);assert.equal(await mobile.evaluate('document.documentElement.scrollWidth>innerWidth'),false,`${width} ${screen}`)}
      const bad=await mobile.evaluate(`(()=>{const nested=[...document.querySelectorAll('button,a')].filter(e=>e.querySelector('button,a,input,select'));const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return {nested:nested.length,duplicate:ids.length-new Set(ids).size}})()`);assert.deepEqual(bad,{nested:0,duplicate:0});
    });
    await mobile.close();
  }
  assert.deepEqual(report.runtimeErrors,[]);
  console.log(`PASS runtime: 0 browser exceptions; ${report.checks.length} behavior/responsive checks.`);
  report.status='pass';
} catch(error) { report.status='fail';report.error=error.stack;throw error; }
finally { if(browser)await browser.close();await writeFile(path.join(here,'evidence','prototype-verification.json'),JSON.stringify(report,null,2)+'\n'); }
