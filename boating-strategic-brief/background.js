// The Boating Strategic Brief - Background Service Worker
// Handles daily briefing generation via OpenAI API with web search

importScripts('config.js');

// System prompt for the AI analyst persona
const SYSTEM_PROMPT = `You are an industry-aware boating analyst providing daily strategic briefings. Your role is to analyze news from boatingindustry.com and filter it by strategic relevance.

STRATEGIC RELEVANCE FILTERING:
- Financial (HIGH priority): Acquisitions, earnings, IPOs, major investments, market trends
- Technology (MEDIUM priority): New propulsion systems, manufacturing innovations, sustainability tech
- Dealer/Retail (LOW priority): Store openings, local events, minor personnel changes

CONTENT RULES:
1. Skip minor press releases unless they form a pattern indicating a larger trend
2. Aggregate similar news into trend summaries when applicable
3. Highlight strategic implications for each significant item
4. Always include source URLs for referenced articles

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "summary": "2-3 sentence executive summary of today's key developments",
  "lastUpdated": "ISO timestamp",
  "items": [
    {
      "title": "Article title",
      "priority": "HIGH|MEDIUM|LOW",
      "category": "Financial|Technology|Dealer|Other",
      "insight": "Strategic implication of this news",
      "url": "Source URL from boatingindustry.com"
    }
  ]
}

Focus on the most strategically relevant news from the past 24-48 hours. Limit to 5-7 most important items.`;

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Boating Strategic Brief installed');
  await setupDailyAlarm();
  // Only fetch initial briefing if API key is configured
  const apiKey = await getApiKey();
  if (apiKey) {
    await generateBriefing();
  }
});

// Handle alarm triggers
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CONFIG.ALARM_NAME || alarm.name === 'test-briefing-alarm') {
    console.log(`Alarm triggered: ${alarm.name}`);
    const apiKey = await getApiKey();
    if (apiKey) {
      await generateBriefing();
    } else {
      console.log('Skipping briefing generation - no API key configured');
    }
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'refresh') {
    generateBriefing().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }
  if (message.action === 'getBriefing') {
    chrome.storage.local.get(['currentBriefing'], (result) => {
      sendResponse(result.currentBriefing || null);
    });
    return true;
  }
  if (message.action === 'testAlarm') {
    // Create a test alarm that fires in 1 minute to verify auto-refresh works
    const testAlarmName = 'test-briefing-alarm';
    chrome.alarms.create(testAlarmName, { delayInMinutes: 1 });
    console.log('Test alarm created - will fire in 1 minute');
    sendResponse({ success: true, message: 'Test alarm set for 1 minute from now' });
    return true;
  }
  if (message.action === 'getAlarmInfo') {
    chrome.alarms.get(CONFIG.ALARM_NAME, (alarm) => {
      sendResponse({ alarm: alarm || null });
    });
    return true;
  }
});

// Setup daily alarm for 7 AM
async function setupDailyAlarm() {
  // Clear any existing alarms
  await chrome.alarms.clear(CONFIG.ALARM_NAME);

  // Calculate next 7 AM
  const now = new Date();
  const next7AM = new Date();
  next7AM.setHours(CONFIG.ALARM_HOUR, CONFIG.ALARM_MINUTE, 0, 0);

  // If 7 AM has passed today, schedule for tomorrow
  if (now > next7AM) {
    next7AM.setDate(next7AM.getDate() + 1);
  }

  const delayInMinutes = (next7AM.getTime() - now.getTime()) / 60000;

  // Create alarm that repeats daily (1440 minutes = 24 hours)
  chrome.alarms.create(CONFIG.ALARM_NAME, {
    delayInMinutes: delayInMinutes,
    periodInMinutes: 1440
  });

  console.log(`Daily alarm set for ${next7AM.toLocaleString()}`);
}

// Get API key from storage
async function getApiKey() {
  const result = await chrome.storage.local.get(['openaiApiKey']);
  return result.openaiApiKey || null;
}

// Generate briefing using OpenAI API with web search
async function generateBriefing() {
  console.log('Generating briefing...');

  try {
    // Get API key from storage
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error('Please configure your OpenAI API key in Settings');
    }

    // Get seen articles for deduplication
    const seenArticles = await getSeenArticles();

    // Build the user message with dedup context
    const userMessage = `Search boatingindustry.com for the latest news from the past 24-48 hours.

Previously seen article URLs to exclude from this briefing (avoid duplicates):
${seenArticles.length > 0 ? seenArticles.join('\n') : 'None - this is a fresh briefing'}

Provide a strategic briefing with the most important industry news. Return ONLY valid JSON matching the specified format.`;

    // Build combined input with system context and user request
    const combinedInput = `${SYSTEM_PROMPT}\n\n---\n\nUSER REQUEST:\n${userMessage}`;

    // Call OpenAI API with web search
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: CONFIG.MODEL,
        tools: [{ type: 'web_search' }],
        input: combinedInput
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Extract the text content from responses API
    let briefingText = '';
    if (data.output) {
      // Handle array of output items
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text' || content.type === 'text') {
              briefingText = content.text;
              break;
            }
          }
          if (briefingText) break;
        }
      }
    } else if (data.output_text) {
      // Handle direct output_text field
      briefingText = data.output_text;
    } else if (data.text) {
      // Handle direct text field
      briefingText = data.text;
    }

    if (!briefingText) {
      console.log('API Response:', JSON.stringify(data, null, 2));
      throw new Error('No content in API response');
    }

    // Parse the JSON response
    let briefing;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = briefingText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       briefingText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : briefingText;
      briefing = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse briefing JSON:', parseError);
      // Create a fallback briefing structure
      briefing = {
        summary: briefingText.substring(0, 500),
        lastUpdated: new Date().toISOString(),
        items: []
      };
    }

    // Add timestamp if not present
    briefing.lastUpdated = briefing.lastUpdated || new Date().toISOString();

    // Update seen articles with new URLs
    const newUrls = briefing.items
      .map(item => item.url)
      .filter(url => url && !seenArticles.includes(url));

    await updateSeenArticles(newUrls);

    // Store the briefing
    await chrome.storage.local.set({ currentBriefing: briefing });

    // Update badge to show new content
    chrome.action.setBadgeText({ text: 'NEW' });
    chrome.action.setBadgeBackgroundColor({ color: '#48bb78' });

    console.log('Briefing generated successfully');
    return briefing;

  } catch (error) {
    console.error('Error generating briefing:', error);

    // Store error state
    await chrome.storage.local.set({
      currentBriefing: {
        error: error.message,
        lastUpdated: new Date().toISOString(),
        summary: 'Failed to generate briefing. Please check your API key and try again.',
        items: []
      }
    });

    throw error;
  }
}

// Get previously seen article URLs
async function getSeenArticles() {
  const result = await chrome.storage.local.get(['seenArticles']);
  const seenArticles = result.seenArticles || {};

  // Filter out articles older than DEDUP_DAYS
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CONFIG.DEDUP_DAYS);
  const cutoffTime = cutoffDate.getTime();

  const validUrls = [];
  const updatedSeen = {};

  for (const [url, timestamp] of Object.entries(seenArticles)) {
    if (timestamp > cutoffTime) {
      validUrls.push(url);
      updatedSeen[url] = timestamp;
    }
  }

  // Update storage with cleaned data
  await chrome.storage.local.set({ seenArticles: updatedSeen });

  return validUrls;
}

// Add new article URLs to seen list
async function updateSeenArticles(newUrls) {
  const result = await chrome.storage.local.get(['seenArticles']);
  const seenArticles = result.seenArticles || {};
  const now = Date.now();

  for (const url of newUrls) {
    seenArticles[url] = now;
  }

  await chrome.storage.local.set({ seenArticles });
}

// Clear badge when popup opens
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    chrome.action.setBadgeText({ text: '' });
  }
});
