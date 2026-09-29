// TripMaster 共用 UI 行為:彈窗(Esc 關閉、焦點移入/還原、Tab 不跑出去)、
// 圖示按鈕補 aria-label、可點的標題列支援鍵盤、toast 朗讀、頁籤狀態。
// 不改任何頁面邏輯:關閉彈窗一律模擬點遮罩/✕,走各頁原本的關閉函式。
(function () {
  'use strict';

  const ICON_LABELS = {
    '✕': '關閉', '×': '關閉', '🗑': '刪除', '✎': '編輯', '▴': '收合', '🧭': '導航',
    '📸': '照片', '📖': '景點詳情', '🔍': '搜尋', '↗': '開新頁', '⇄': '移到其他天',
    '🔗': '分享', '💱': '幣別設定', '←': '返回',
  };
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const hasWords = s => /[\p{L}\p{N}]/u.test(s.replace(/[\u{1F000}-\u{1FFFF}☀-➿️]/gu, ''));

  // ── 彈窗 ──────────────────────────────────────────────
  const isShown = el => !!el && getComputedStyle(el).display !== 'none';
  const dialogs = () => [
    ...document.querySelectorAll('.modal-mask, .modal-overlay, #lightbox'),
  ];
  const openDialogs = () => dialogs().filter(isShown);
  const topDialog = () => {
    const open = openDialogs();
    if (!open.length) return null;
    return open.sort((a, b) => (+getComputedStyle(b).zIndex || 0) - (+getComputedStyle(a).zIndex || 0))[0];
  };
  const panelOf = d => d.querySelector('.photo-modal, .modal') || d;

  function closeDialog(d) {
    if (d.id === 'lightbox') { d.classList.remove('open'); return; }
    const x = d.querySelector('.pm-close');
    if (x) { x.click(); return; }
    const cancel = d.querySelector('.btn-cancel');
    if (cancel) { cancel.click(); return; }
    d.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 遮罩 onclick 只認 target===this
  }

  const openers = new WeakMap();
  function onDialogChange(d) {
    const shown = isShown(d);
    if (shown && !d.dataset.uiOpen) {
      d.dataset.uiOpen = '1';
      openers.set(d, document.activeElement);
      const panel = panelOf(d);
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      const title = panel.querySelector('.pm-title, h2');
      if (title) {
        if (!title.id) title.id = 'dlg-title-' + Math.random().toString(36).slice(2, 8);
        panel.setAttribute('aria-labelledby', title.id);
      }
      if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
      // 手機上直接聚焦輸入框會跳鍵盤,所以聚焦面板本身
      setTimeout(() => { if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true }); }, 0);
    } else if (!shown && d.dataset.uiOpen) {
      delete d.dataset.uiOpen;
      const back = openers.get(d);
      if (back && document.contains(back) && typeof back.focus === 'function') back.focus({ preventScroll: true });
    }
  }
  function watchDialogs() {
    const mo = new MutationObserver(ms => ms.forEach(m => onDialogChange(m.target)));
    dialogs().forEach(d => {
      if (d.dataset.uiWatched) return;
      d.dataset.uiWatched = '1';
      mo.observe(d, { attributes: true, attributeFilter: ['class', 'style'] });
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const d = topDialog();
      if (d) { e.preventDefault(); closeDialog(d); return; }
      const card = document.getElementById('poi-card');
      if (card && getComputedStyle(card).display !== 'none') {
        const x = card.querySelector('.pc-close');
        if (x) { e.preventDefault(); x.click(); }
      }
      return;
    }
    if (e.key === 'Tab') {
      const d = topDialog();
      if (!d) return;
      const panel = panelOf(d);
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ── 可點的標題列:鍵盤 Enter/Space 可展開收合 ──────────
  const CLICKABLE = '.day-hd, .pool-hd, .day-summary';
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target;
    if (!el.matches || !el.matches(CLICKABLE)) return;
    e.preventDefault();
    const card = el.closest('[data-day]');
    const key = card ? card.dataset.day : null;
    const cls = el.matches('.pool-hd') ? '.pool-hd' : '.day-hd';
    el.click();
    // 各頁點擊後會整片重畫,把焦點放回同一天的標題列
    setTimeout(() => {
      const again = key
        ? document.querySelector(`[data-day="${CSS.escape(key)}"] ${cls}`)
        : document.querySelector(cls);
      if (!again) return;
      if (!again.hasAttribute('tabindex')) again.setAttribute('tabindex', '0');
      again.focus({ preventScroll: true });
    }, 0);
  });

  // ── 掃描頁面補語意(重畫後再跑一次) ────────────────────
  function enhance(root) {
    root.querySelectorAll('button, a.ps-btn, a.ws-btn, a.nav-back').forEach(b => {
      if (b.hasAttribute('aria-label')) return;
      const text = (b.textContent || '').trim();
      if (hasWords(text)) return;
      const label = b.getAttribute('title') || ICON_LABELS[text] || '';
      if (label) b.setAttribute('aria-label', label);
    });
    root.querySelectorAll('.nav-back').forEach(a => {
      if (!a.hasAttribute('aria-label') && !hasWords(a.textContent || '')) a.setAttribute('aria-label', '返回');
    });

    root.querySelectorAll(CLICKABLE).forEach(el => {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      const card = el.closest('.day-card, .pool-card');
      if (card && el.matches('.day-hd')) el.setAttribute('aria-expanded', String(!card.classList.contains('collapsed')));
    });

    root.querySelectorAll('.tabs, .pm-tabs').forEach(t => t.setAttribute('role', 'tablist'));
    root.querySelectorAll('.tab-btn, .pm-tab').forEach(b => {
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(b.classList.contains('active')));
    });

    // <label> 沒有 for 也沒包住欄位 → 綁到同一組的第一個欄位
    root.querySelectorAll('.form-group > label, .field > label').forEach(l => {
      if (l.htmlFor || l.querySelector('input, select, textarea')) return;
      const ctl = l.parentElement.querySelector('input:not([type=hidden]), select, textarea');
      if (ctl && ctl.id) l.htmlFor = ctl.id;
    });

    root.querySelectorAll('img:not([alt])').forEach(img => {
      const cap = img.closest('.pm-cell, .ph-cell')?.querySelector('.pm-cap')?.textContent;
      img.setAttribute('alt', cap || '照片');
    });
  }

  function syncActive() {
    document.querySelectorAll('.tab-btn, .pm-tab').forEach(b => b.setAttribute('aria-selected', String(b.classList.contains('active'))));
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; enhance(document); syncActive(); }, 30);
  }

  function init() {
    document.querySelectorAll('.toast').forEach(t => { t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); });
    const lb = document.getElementById('lightbox');
    if (lb) lb.querySelector('img')?.setAttribute('alt', '照片放大檢視');
    watchDialogs();
    enhance(document);
    new MutationObserver(ms => {
      // Google 地圖內部一直在改 DOM,忽略
      if (ms.every(m => m.target.closest && m.target.closest('#map, #mini-map, .gm-style'))) return;
      schedule();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
