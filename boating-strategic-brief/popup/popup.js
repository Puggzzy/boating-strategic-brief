// The Boating Strategic Brief - Popup Script
// Handles UI rendering and user interactions

document.addEventListener('DOMContentLoaded', async () => {
  // Connect to background to clear badge
  const port = chrome.runtime.connect({ name: 'popup' });

  // Get DOM elements - Main content
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const briefingEl = document.getElementById('briefing');
  const noBriefingEl = document.getElementById('no-briefing');
  const summaryEl = document.getElementById('summary');
  const itemsListEl = document.getElementById('items-list');
  const lastUpdatedEl = document.getElementById('last-updated');
  const refreshBtn = document.getElementById('refresh-btn');
  const mainContentEl = document.getElementById('main-content');
  const setupRequiredEl = document.getElementById('setup-required');

  // Get DOM elements - Settings
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsCloseBtn = document.getElementById('settings-close');
  const apiKeyInput = document.getElementById('api-key-input');
  const toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility');
  const saveSettingsBtn = document.getElementById('save-settings');
  const settingsStatusEl = document.getElementById('settings-status');
  const openSettingsBtn = document.getElementById('open-settings');
  const footerEl = document.querySelector('.footer');
  const testAlarmBtn = document.getElementById('test-alarm-btn');
  const alarmInfoEl = document.getElementById('alarm-info');

  // Check if API key is configured
  const hasApiKey = await checkApiKey();

  if (hasApiKey) {
    // Load and display briefing
    await loadBriefing();
  } else {
    showSetupRequired();
  }

  // Refresh button handler
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.classList.add('loading');

    showLoading();

    try {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'refresh' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve();
          } else {
            reject(new Error(response?.error || 'Failed to refresh'));
          }
        });
      });

      await loadBriefing();
    } catch (error) {
      showError(error.message);
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('loading');
    }
  });

  // Settings button handler
  settingsBtn.addEventListener('click', () => {
    openSettings();
  });

  // Open settings button (from setup required view)
  openSettingsBtn.addEventListener('click', () => {
    openSettings();
  });

  // Close settings handler
  settingsCloseBtn.addEventListener('click', async () => {
    closeSettings();
    const hasKey = await checkApiKey();
    if (hasKey) {
      await loadBriefing();
    } else {
      showSetupRequired();
    }
  });

  // Toggle API key visibility
  toggleKeyVisibilityBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
  });

  // Save settings handler
  saveSettingsBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showSettingsStatus('Please enter an API key', 'error');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      showSettingsStatus('Invalid API key format', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({ openaiApiKey: apiKey });
      showSettingsStatus('Settings saved successfully!', 'success');

      // Close settings after a short delay and load briefing
      setTimeout(async () => {
        closeSettings();
        await loadBriefing();
      }, 1000);
    } catch (error) {
      showSettingsStatus('Failed to save settings', 'error');
    }
  });

  // Test alarm button handler
  testAlarmBtn.addEventListener('click', async () => {
    testAlarmBtn.disabled = true;
    alarmInfoEl.textContent = 'Setting test alarm...';

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'testAlarm' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      if (response.success) {
        alarmInfoEl.textContent = 'Test alarm set! Will auto-refresh in 1 minute. Check console for logs.';
        alarmInfoEl.style.color = '#48bb78';
      } else {
        alarmInfoEl.textContent = 'Failed to set test alarm';
        alarmInfoEl.style.color = '#e53e3e';
      }
    } catch (error) {
      alarmInfoEl.textContent = `Error: ${error.message}`;
      alarmInfoEl.style.color = '#e53e3e';
    }

    // Re-enable after 60 seconds
    setTimeout(() => {
      testAlarmBtn.disabled = false;
      alarmInfoEl.textContent = '';
    }, 60000);
  });

  // Check if API key is configured
  async function checkApiKey() {
    const result = await chrome.storage.local.get(['openaiApiKey']);
    return !!(result.openaiApiKey && result.openaiApiKey.trim());
  }

  // Open settings panel
  async function openSettings() {
    settingsPanel.classList.remove('hidden');
    mainContentEl.classList.add('hidden');
    footerEl.classList.add('hidden');
    settingsStatusEl.textContent = '';
    settingsStatusEl.className = 'settings-status';

    // Load current API key (masked)
    const result = await chrome.storage.local.get(['openaiApiKey']);
    if (result.openaiApiKey) {
      apiKeyInput.value = result.openaiApiKey;
    }
  }

  // Close settings panel
  function closeSettings() {
    settingsPanel.classList.add('hidden');
    mainContentEl.classList.remove('hidden');
    footerEl.classList.remove('hidden');
    apiKeyInput.type = 'password';
  }

  // Show settings status message
  function showSettingsStatus(message, type) {
    settingsStatusEl.textContent = message;
    settingsStatusEl.className = `settings-status ${type}`;
  }

  // Show setup required view
  function showSetupRequired() {
    loadingEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    briefingEl.classList.add('hidden');
    noBriefingEl.classList.add('hidden');
    setupRequiredEl.classList.remove('hidden');
  }

  // Load briefing from storage
  async function loadBriefing() {
    showLoading();

    try {
      const result = await chrome.storage.local.get(['currentBriefing']);
      const briefing = result.currentBriefing;

      if (!briefing) {
        showNoBriefing();
        return;
      }

      if (briefing.error) {
        showError(briefing.error);
        return;
      }

      displayBriefing(briefing);
    } catch (error) {
      showError(error.message);
    }
  }

  // Display briefing content
  function displayBriefing(briefing) {
    // Hide other states
    loadingEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    noBriefingEl.classList.add('hidden');
    setupRequiredEl.classList.add('hidden');
    briefingEl.classList.remove('hidden');

    // Set summary
    summaryEl.textContent = briefing.summary || 'No summary available.';

    // Clear and populate items
    itemsListEl.innerHTML = '';

    if (briefing.items && briefing.items.length > 0) {
      briefing.items.forEach(item => {
        const li = createItemElement(item);
        itemsListEl.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.className = 'item';
      li.innerHTML = '<p class="item-insight">No strategic items identified today.</p>';
      itemsListEl.appendChild(li);
    }

    // Set last updated time
    if (briefing.lastUpdated) {
      const date = new Date(briefing.lastUpdated);
      lastUpdatedEl.textContent = `Updated: ${formatTime(date)}`;
    } else {
      lastUpdatedEl.textContent = '';
    }
  }

  // Create a news item element
  function createItemElement(item) {
    const li = document.createElement('li');
    const priority = (item.priority || 'medium').toLowerCase();
    li.className = `item priority-${priority}`;

    const badgeClass = `badge-${priority}`;
    const priorityLabel = priority.toUpperCase();

    li.innerHTML = `
      <div class="item-header">
        <h3 class="item-title">
          ${item.url
            ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.title || 'Untitled')}</a>`
            : escapeHtml(item.title || 'Untitled')
          }
        </h3>
        <span class="item-badge ${badgeClass}">${priorityLabel}</span>
      </div>
      ${item.insight ? `<p class="item-insight">${escapeHtml(item.insight)}</p>` : ''}
      ${item.category ? `<p class="item-category">${escapeHtml(item.category)}</p>` : ''}
    `;

    return li;
  }

  // Show loading state
  function showLoading() {
    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    briefingEl.classList.add('hidden');
    noBriefingEl.classList.add('hidden');
    setupRequiredEl.classList.add('hidden');
  }

  // Show error state
  function showError(message) {
    loadingEl.classList.add('hidden');
    briefingEl.classList.add('hidden');
    noBriefingEl.classList.add('hidden');
    setupRequiredEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    errorEl.querySelector('.error-message').textContent = message;
  }

  // Show no briefing state
  function showNoBriefing() {
    loadingEl.classList.add('hidden');
    errorEl.classList.add('hidden');
    briefingEl.classList.add('hidden');
    setupRequiredEl.classList.add('hidden');
    noBriefingEl.classList.remove('hidden');
  }

  // Format time for display
  function formatTime(date) {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    return `${dateStr} at ${timeStr}`;
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
