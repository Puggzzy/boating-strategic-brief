// Configuration for The Boating Strategic Brief
// API key is now stored in chrome.storage.local via the settings UI

const CONFIG = {
  // Model to use with web search
  MODEL: 'gpt-5.2',

  // Daily alarm settings
  ALARM_NAME: 'daily-briefing',
  ALARM_HOUR: 8, // 8 AM local time
  ALARM_MINUTE: 0,

  // Deduplication settings
  DEDUP_DAYS: 30, // Keep article history for 30 days

  // Target website for news
  TARGET_SITE: 'boatingindustry.com'
};
