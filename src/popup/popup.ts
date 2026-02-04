// src/popup/popup.ts

async function init(): Promise<void> {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

  const sessionCountEl = document.getElementById('session-count');
  const activeSessionEl = document.getElementById('active-session');

  if (sessionCountEl) {
    sessionCountEl.textContent = state.sessions?.length?.toString() || '0';
  }
  if (activeSessionEl) {
    activeSessionEl.textContent = state.activeSessionId || '无';
  }

  document.getElementById('btn-open-panel')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
