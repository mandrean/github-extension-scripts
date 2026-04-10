// ==UserScript==
// @name         GitHub PR Hide Viewed Files
// @namespace    https://github.com/mandrean
// @version      1.1
// @description  Adds a "Hide viewed files" toggle to the diff settings dropdown on PR review pages
// @match        https://github.com/*/pull/*/files
// @match        https://github.com/*/pull/*/changes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'ghvf-hide-viewed';
  const MENU_ITEM_ID = 'ghvf-menu-item';

  const CHECK_SVG = `<svg aria-hidden="true" focusable="false" class="octicon octicon-check prc-ActionList-SingleSelectCheckmark-zMd8d" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align: text-bottom;"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`;

  // --- State ---

  function isActive() {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  }

  function setActive(val) {
    sessionStorage.setItem(STORAGE_KEY, val ? '1' : '0');
  }

  // --- Styles ---
  // CSS-only approach: hide viewed diff rows and sidebar tree items.
  // The virtualizer uses absolute positioning so we cannot safely reposition
  // rows. Instead we collapse viewed rows to 0-height so they become invisible
  // while the virtualizer keeps managing layout normally.

  function injectStyles() {
    if (document.getElementById('ghvf-styles')) return;
    const style = document.createElement('style');
    style.id = 'ghvf-styles';
    style.textContent = `
      body.ghvf-active [data-ghvf-viewed="true"][class*="virtualizedDiffRow"] {
        visibility: hidden !important;
        height: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }
      body.ghvf-active [role="treeitem"][data-ghvf-viewed="true"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // --- React fiber helpers ---

  function unwrap(value) {
    try {
      return value && value.wrappedJSObject ? value.wrappedJSObject : value;
    } catch (_) {
      return value;
    }
  }

  function getFiberKey(el) {
    const rawEl = unwrap(el);
    if (!rawEl) return null;
    try {
      return Reflect.ownKeys(rawEl).find(k =>
        typeof k === 'string' &&
        (k.startsWith('__reactFiber') || k.startsWith('__reactProps'))
      ) || null;
    } catch (_) {
      return null;
    }
  }

  function findFileProp(fiber, depth) {
    const rawFiber = unwrap(fiber);
    if (!rawFiber || depth > 30) return null;
    const props = unwrap(rawFiber.memoizedProps) || unwrap(rawFiber.pendingProps) || {};
    const file = unwrap(props.file);
    if (file && typeof file === 'object' && file.filePath) {
      return file;
    }
    return findFileProp(rawFiber.return, depth + 1);
  }

  // --- Tagging ---

  function tagViewedRows() {
    for (const btn of document.querySelectorAll('button[class*="MarkAsViewedButton"]')) {
      const row = btn.closest('[class*="virtualizedDiffRow"]');
      if (row) {
        row.setAttribute('data-ghvf-viewed',
          btn.getAttribute('aria-pressed') === 'true' ? 'true' : 'false');
      }
    }
  }

  function tagViewedTreeItems() {
    const items = document.querySelectorAll('[role="treeitem"]:not([aria-expanded])');
    if (!items.length) return;
    const fk = getFiberKey(items[0]);
    if (!fk) return;
    for (const item of items) {
      const rawItem = unwrap(item);
      const fiber = rawItem?.[fk];
      if (!fiber) continue;
      const f = findFileProp(fiber, 0);
      if (!f) continue;
      item.setAttribute('data-ghvf-viewed', f.diff?.markedAsViewed ? 'true' : 'false');
    }
  }

  // --- Apply state ---

  function applyState() {
    document.body.classList.toggle('ghvf-active', isActive());
    tagViewedRows();
    tagViewedTreeItems();

    const menuItem = document.getElementById(MENU_ITEM_ID);
    if (menuItem) {
      menuItem.setAttribute('aria-checked', isActive() ? 'true' : 'false');
    }
  }

  // --- Menu item ---

  function createMenuItem() {
    const li = document.createElement('li');
    li.tabIndex = -1;
    li.setAttribute('aria-checked', isActive() ? 'true' : 'false');
    li.setAttribute('role', 'menuitemcheckbox');
    li.id = MENU_ITEM_ID;
    li.className = 'prc-ActionList-ActionListItem-So4vC';

    const content = document.createElement('div');
    content.className = 'prc-ActionList-ActionListContent-KBb8-';

    const spacer = document.createElement('span');
    spacer.className = 'prc-ActionList-Spacer-4tR2m';

    const leading = document.createElement('span');
    leading.className = 'prc-ActionList-LeadingAction-hbWbh prc-ActionList-VisualWrap-bdCsS';
    leading.setAttribute('data-component', 'ActionList.Selection');
    leading.innerHTML = CHECK_SVG;

    const subContent = document.createElement('span');
    subContent.className = 'prc-ActionList-ActionListSubContent-gKsFp';
    subContent.setAttribute('data-component', 'ActionList.Item--DividerContainer');

    const label = document.createElement('span');
    label.className = 'prc-ActionList-ItemLabel-81ohH';
    label.id = MENU_ITEM_ID + '--label';
    label.textContent = 'Hide viewed files';

    subContent.appendChild(label);
    content.appendChild(spacer);
    content.appendChild(leading);
    content.appendChild(subContent);
    li.appendChild(content);

    li.setAttribute('aria-labelledby', label.id);

    li.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setActive(!isActive());
      applyState();
    });

    return li;
  }

  // --- Menu injection ---

  function injectMenuItem() {
    const menuRoot = document.querySelector('ul[role="menu"]');
    if (!menuRoot) return;
    if (menuRoot.querySelector('#' + MENU_ITEM_ID)) return;

    const allCbs = menuRoot.querySelectorAll('[role="menuitemcheckbox"]');
    let target = null;
    for (const cb of allCbs) {
      if (cb.textContent.trim().startsWith('Minimize comments')) {
        target = cb;
        break;
      }
    }
    if (!target) return;

    target.after(createMenuItem());
  }

  // --- Lifecycle ---

  function init() {
    injectStyles();
    applyState();
  }

  const observer = new MutationObserver(() => {
    if (isActive()) {
      tagViewedRows();
      tagViewedTreeItems();
    }
    injectMenuItem();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  init();
  document.addEventListener('turbo:render', init);
})();
