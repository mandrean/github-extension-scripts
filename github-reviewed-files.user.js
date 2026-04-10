// ==UserScript==
// @name         GitHub PR Reviewed Files Copier
// @namespace    https://github.com/mandrean
// @version      1.0
// @description  Adds a dropdown next to the "X / Y viewed" counter to copy lists of viewed/unviewed files
// @match        https://github.com/*/pull/*/files
// @match        https://github.com/*/pull/*/changes
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const COPY_SVG = `<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
  </svg>`;

  const CHECK_SVG = `<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="color: #2da44e;">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
  </svg>`;

  const X_SVG = `<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="color: #cf222e;">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
  </svg>`;

  const CHEVRON_SVG = `<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/>
  </svg>`;

  // --- React fiber helpers ---

  function getFiberKey(el) {
    return Object.keys(el).find(k => k.startsWith('__reactFiber'));
  }

  function findFileProp(fiber, depth) {
    if (!fiber || depth > 30) return null;
    const props = fiber.memoizedProps || fiber.pendingProps || {};
    if (props.file && typeof props.file === 'object' && props.file.filePath) {
      return props.file;
    }
    return findFileProp(fiber.return, depth + 1);
  }

  function extractFiles(viewedOnly) {
    const treeItems = document.querySelectorAll('[role="treeitem"]');
    const results = [];
    const seen = new Set();

    for (const item of treeItems) {
      const fiberKey = getFiberKey(item);
      if (!fiberKey) continue;
      const fileObj = findFileProp(item[fiberKey], 0);
      if (!fileObj || !fileObj.filePath) continue;
      if (seen.has(fileObj.filePath)) continue;
      seen.add(fileObj.filePath);

      const isViewed = !!fileObj.diff?.markedAsViewed;
      if (viewedOnly === isViewed) {
        results.push(fileObj.filePath);
      }
    }

    results.sort();
    return results;
  }

  // --- Inject CSS for hover states (no JS events needed) ---

  function injectStyles() {
    if (document.getElementById('ghrc-styles')) return;
    const style = document.createElement('style');
    style.id = 'ghrc-styles';
    style.textContent = `
      .ghrc-menu-btn {
        display: flex; align-items: center; gap: 8px; width: 100%;
        padding: 6px 8px; background: transparent; border: none;
        border-radius: 6px; cursor: pointer; font-size: 12px;
        font-family: inherit; color: var(--fgColor-default, #e6edf3);
        white-space: nowrap; text-align: left;
      }
      .ghrc-menu-btn:hover {
        background: var(--control-transparent-bgColor-hover, rgba(101,108,118,0.2));
      }
      .ghrc-caret {
        display: inline-flex; align-items: center; justify-content: center;
        padding: 2px 4px; background: none;
        border: 1px solid var(--borderColor-default, #30363d);
        border-radius: 6px; cursor: pointer;
        color: var(--fgColor-muted, #8b949e); line-height: 1;
      }
      .ghrc-caret:hover {
        border-color: var(--borderColor-emphasis, #6e7681);
        color: var(--fgColor-default, #e6edf3);
      }
    `;
    document.head.appendChild(style);
  }

  // --- UI helpers ---

  function animateIcon(iconEl, success) {
    iconEl.innerHTML = success ? CHECK_SVG : X_SVG;
    setTimeout(() => { iconEl.innerHTML = COPY_SVG; }, 2000);
  }

  // Fallback copy using execCommand for contexts where the async clipboard
  // API is unavailable or rejects (e.g. missing user gesture, missing focus).
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn('[ghrc] clipboard.writeText failed, using fallback:', err);
    }
    return fallbackCopy(text);
  }

  function createMenuItem(label, viewedOnly) {
    const item = document.createElement('div');
    item.style.cssText = 'padding: 0 4px;';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghrc-menu-btn';

    const iconEl = document.createElement('span');
    iconEl.innerHTML = COPY_SVG;
    iconEl.style.cssText = 'display: flex; align-items: center; flex-shrink: 0; pointer-events: none;';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.cssText = 'pointer-events: none;';

    btn.appendChild(iconEl);
    btn.appendChild(labelEl);
    item.appendChild(btn);

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const files = extractFiles(viewedOnly);
      const ok = await copyToClipboard(files.join('\n'));
      animateIcon(iconEl, ok);
      if (!ok) console.warn('[ghrc] copy failed — clipboard and execCommand both unavailable');
    });

    return item;
  }

  function createDropdown() {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-ghrc-dropdown', '1');
    wrapper.style.cssText = 'position: relative; display: inline-flex; align-items: center; margin-left: 4px;';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = CHEVRON_SVG;
    btn.className = 'ghrc-caret';
    btn.setAttribute('aria-label', 'Copy viewed or unviewed file list');

    // Dropdown menu — matches GitHub's ActionMenu overlay style
    const menu = document.createElement('div');
    menu.style.cssText = [
      'display: none',
      'position: absolute',
      'top: calc(100% + 4px)',
      'right: 0',
      'z-index: 9999',
      'background: rgb(1,4,9)',
      'border-radius: 12px',
      'box-shadow: rgb(61,68,77) 0px 0px 0px 1px, rgba(1,4,9,0.4) 0px 6px 12px -3px, rgba(1,4,9,0.4) 0px 6px 18px 0px',
      'min-width: 180px',
      'padding: 8px 0',
    ].join(';');

    menu.appendChild(createMenuItem('Copy viewed files', true));
    menu.appendChild(createMenuItem('Copy unviewed files', false));

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', () => {
      menu.style.display = 'none';
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(menu);
    return wrapper;
  }

  // --- Injection ---

  function inject() {
    injectStyles();
    const progressContainers = document.querySelectorAll('[class*="ProgressContainer"]');
    for (const pc of progressContainers) {
      const parent = pc.parentElement;
      if (!parent) continue;
      if (parent.querySelector('[data-ghrc-dropdown]')) continue; // already injected
      parent.appendChild(createDropdown());
    }
  }

  // Watch for React re-renders and turbo/pjax navigations
  const observer = new MutationObserver(() => inject());
  observer.observe(document.body, { childList: true, subtree: true });

  inject();
})();
