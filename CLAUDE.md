# The Boating Strategic Brief - Product Requirements Document

## Overview
A Chrome Extension widget that delivers a daily strategic briefing from boatingindustry.com, powered by OpenAI's Chat Completions API with web search capabilities.

## Goal
Provide daily strategic briefings curated from boatingindustry.com, filtering news by strategic relevance to help boating industry professionals stay informed on the most important developments.

## Technology Stack
- **Platform**: Chrome Extension (Manifest V3)
- **AI Integration**: OpenAI Chat Completions API (gpt-4o) with web search tool
- **Storage**: chrome.storage.local for caching and deduplication
- **Architecture**: Service Worker (background.js) + Popup UI

## AI Persona & Behavior
The AI assistant acts as an **industry-aware boating analyst** with the following characteristics:
- Deep understanding of the boating/marine industry landscape
- Focus on strategic implications rather than surface-level news
- Professional, concise communication style

### Strategic Relevance Filtering
News items are filtered by strategic importance:

| Category | Priority | Examples |
|----------|----------|----------|
| Financial | **HIGH** | Acquisitions, earnings, IPOs, major investments, market trends |
| Technology | **MEDIUM** | New propulsion systems, manufacturing innovations, sustainability tech |
| Dealer/Retail | **LOW** | Store openings, local events, minor personnel changes |

### Content Rules
1. **Skip minor PRs** unless they form a pattern indicating a larger trend
2. **Aggregate similar news** into trend summaries when applicable
3. **Highlight strategic implications** for each significant item
4. **Include source links** for all referenced articles

## Core Logic

### Deduplication System
- Store article identifiers (URLs, titles) in `chrome.storage.local`
- Check new articles against stored identifiers before including
- Maintain a rolling 30-day history to prevent stale data accumulation
- Key format: `seen_articles` with object mapping URL hashes to dates

### Daily Alarm System
- Use `chrome.alarms` API to trigger daily briefing generation
- Default trigger time: 7:00 AM local time
- Allow manual refresh via popup interaction
- Handle service worker wake-up gracefully

### API Integration Flow
1. Trigger alarm fires or user requests refresh
2. Call OpenAI Chat Completions API with web_search tool enabled
3. System prompt instructs model to search boatingindustry.com for recent news
4. Process and filter results by strategic relevance
5. Deduplicate against previously seen articles
6. Store briefing in chrome.storage.local
7. Update badge/notification if new content available

## User Interface

### Theme: Nautical
- **Primary Color**: Dark Navy Blue (#1a365d)
- **Secondary Color**: Ocean Blue (#2c5282)
- **Accent Color**: Seafoam (#48bb78)
- **Background**: White (#ffffff)
- **Text**: Dark Gray (#2d3748)

### Popup Layout
```
+----------------------------------+
|  [Anchor Icon] BOATING BRIEF     |
|  Strategic Intelligence Daily    |
+----------------------------------+
|                                  |
|  TODAY'S BRIEFING               |
|  ─────────────────────────────  |
|                                  |
|  [Summary Section]               |
|  Concise overview of key news    |
|                                  |
|  [Detailed Items]                |
|  * Item 1 with link             |
|  * Item 2 with link             |
|  * Item 3 with link             |
|                                  |
+----------------------------------+
|  Last updated: 7:00 AM          |
|  [Refresh Button]               |
+----------------------------------+
```

### UI Components
1. **Header**: Extension title with nautical icon
2. **Summary Section**: Executive summary (2-3 sentences)
3. **News Items**: Expandable list with strategic tags
4. **Source Links**: Clickable links to original articles
5. **Status Bar**: Last update time + manual refresh button

## File Structure
```
boating-strategic-brief/
├── manifest.json
├── config.js
├── background.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Configuration
Users must provide in config.js:
- **OpenAI API Key** - Required for API access

No Assistant ID needed - the extension uses Chat Completions API directly with system prompts.

## Success Criteria
1. Extension loads without errors in Chrome
2. Daily alarm triggers briefing generation reliably
3. Briefings contain relevant, deduplicated content
4. UI displays briefings in readable, nautical-themed format
5. Manual refresh works on demand
6. No duplicate articles appear across days
