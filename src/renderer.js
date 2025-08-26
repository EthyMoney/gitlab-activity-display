/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 */

import './index.css';
const { ipcRenderer } = require('electron');

let lastSuccessfulFetchTime = new Date();
let displayedEntries = new Set(); // Track which entries have been displayed

async function fetchFeed() {
  try {
    const text = await ipcRenderer.invoke('fetch-feed');
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    const entries = xml.getElementsByTagName('entry');
    const feedContainer = document.getElementById('feed-container');
    const statusContainer = document.getElementById('status-container');

    // Store current entries to detect new ones
    const currentEntries = Array.from(entries).map(entry => {
      const id = entry.getElementsByTagName('id')[0].textContent;
      const updated = entry.getElementsByTagName('updated')[0].textContent;
      return { id, updated, element: entry };
    });

    // Check if any entries are new before clearing content
    const hasNewEntries = currentEntries.some(({ id }) => !displayedEntries.has(id));

    // Clear previous content
    feedContainer.innerHTML = '';

    currentEntries.forEach(({ id, updated, element: entry }) => {
      const title = entry.getElementsByTagName('title')[0]?.textContent || '';
      const summary = entry.getElementsByTagName('summary')[0]?.innerHTML || '';
      const authorElement = entry.getElementsByTagName('author')[0]?.getElementsByTagName('name')[0];
      const author = authorElement?.textContent || 'Unknown User';

      const updatedDate = new Date(updated);
      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      // Check if this is a genuinely new entry (not seen before)
      const isNewEntry = !displayedEntries.has(id);

      // Check if this entry is from the last 15 minutes
      const isRecentEntry = updatedDate > fifteenMinutesAgo;

      // Add to displayed entries set
      displayedEntries.add(id);

      // Parse different activity types from the title
      let activityText = '';
      let projectInfo = '';
      let detailText = '';

      // Extract project path (everything after "at " or "in ") - add null check
      const projectMatch = title ? (title.match(/at (.+)$/) || title.match(/in (.+)$/)) : null;
      projectInfo = projectMatch ? projectMatch[1] : 'Unknown Project';

      // Determine activity type and format accordingly
      if (title && title.includes('pushed to')) {
        const pushMatch = title.match(/(.+) pushed to (.+) at/);
        if (pushMatch) {
          const branch = pushMatch[2];
          activityText = `pushed to ${branch}`;

          // Parse the summary to extract commit info for pushes
          const summaryDoc = parser.parseFromString(summary, 'text/html');
          const blockquote = summaryDoc.querySelector('.blockquote p');
          const commitLink = summaryDoc.querySelector('a');
          const cleanSummary = blockquote ? blockquote.textContent.trim() : '';
          const commitId = commitLink ? commitLink.textContent.trim() : '';
          detailText = `${cleanSummary} ${commitId}`;
        }
      } else if (title && title.includes('opened issue')) {
        const issueMatch = title.match(/opened issue #(\d+): (.+) at/);
        if (issueMatch) {
          const issueNumber = issueMatch[1];
          const issueTitle = issueMatch[2];
          activityText = `opened issue #${issueNumber}`;
          detailText = issueTitle;
        }
      } else if (title && title.includes('closed issue')) {
        const issueMatch = title.match(/closed issue #(\d+): (.+) at/);
        if (issueMatch) {
          const issueNumber = issueMatch[1];
          const issueTitle = issueMatch[2];
          activityText = `closed issue #${issueNumber}`;
          detailText = issueTitle;
        }
      } else if (title && title.includes('opened merge request')) {
        const mrMatch = title.match(/opened merge request !(\d+): (.+) at/);
        if (mrMatch) {
          const mrNumber = mrMatch[1];
          const mrTitle = mrMatch[2];
          activityText = `opened merge request !${mrNumber}`;
          detailText = mrTitle;
        }
      } else if (title && title.includes('accepted merge request')) {
        const mrMatch = title.match(/accepted merge request !(\d+): (.+) at/);
        if (mrMatch) {
          const mrNumber = mrMatch[1];
          const mrTitle = mrMatch[2];
          activityText = `accepted merge request !${mrNumber}`;
          detailText = mrTitle;
        }
      } else if (title && title.includes('commented on')) {
        const commentMatch = title.match(/commented on (.+) at/);
        if (commentMatch) {
          const commentTarget = commentMatch[1];
          // Check if it's specifically an issue comment (with or without title)
          const issueCommentMatch = commentTarget.match(/issue #(\d+)(?:: (.+))?/);
          if (issueCommentMatch) {
            const issueNumber = issueCommentMatch[1];
            activityText = `commented on issue #${issueNumber}`;
          } else {
            activityText = `commented on ${commentTarget}`;
          }

          // Extract comment content from summary for all comment types
          if (summary) {
            const summaryDoc = parser.parseFromString(summary, 'text/html');

            // Try multiple ways to extract the comment text
            let commentText = '';

            // First try to get text from p elements with data-sourcepos (GitLab specific)
            const pElements = summaryDoc.querySelectorAll('p[data-sourcepos]');
            if (pElements.length > 0) {
              commentText = Array.from(pElements).map(p => p.textContent?.trim()).filter(text => text).join(' ');
            }

            // Fallback to all p elements
            if (!commentText) {
              const allPElements = summaryDoc.querySelectorAll('p');
              if (allPElements.length > 0) {
                commentText = Array.from(allPElements).map(p => p.textContent?.trim()).filter(text => text).join(' ');
              }
            }

            // Final fallback to all text content
            if (!commentText) {
              commentText = summaryDoc.textContent?.trim() || '';
            }

            // Clean up the comment text and truncate if needed
            commentText = commentText.replace(/\s+/g, ' ').trim();
            detailText = commentText.length > 150 ? commentText.substring(0, 150) + '...' : commentText;
          } else {
            detailText = 'No comment content available';
          }
        }
      } else if (title && title.includes('created wiki page')) {
        const wikiMatch = title.match(/created wiki page (.+) in/);
        if (wikiMatch) {
          const wikiPageName = wikiMatch[1];
          activityText = `created wiki page`;
          detailText = wikiPageName;
        }
      } else if (title && title.includes('updated wiki page')) {
        const wikiMatch = title.match(/updated wiki page (.+) in/);
        if (wikiMatch) {
          const wikiPageName = wikiMatch[1];
          activityText = `updated wiki page`;
          detailText = wikiPageName;
        }
      } else if (title && title.includes('pushed new project branch')) {
        const branchMatch = title.match(/pushed new project branch (.+) at/);
        if (branchMatch) {
          const branchName = branchMatch[1];
          activityText = `pushed new branch ${branchName}`;

          // Parse the summary to extract commit info if available
          const summaryDoc = parser.parseFromString(summary, 'text/html');
          const blockquote = summaryDoc.querySelector('.blockquote p');
          const commitLink = summaryDoc.querySelector('a');
          const cleanSummary = blockquote ? blockquote.textContent.trim() : '';
          const commitId = commitLink ? commitLink.textContent.trim() : '';

          // Check for additional commits
          const moreCommitsText = summaryDoc.textContent || '';
          const moreCommitsMatch = moreCommitsText.match(/(\d+) more commits/);
          const additionalCommits = moreCommitsMatch ? ` (and ${moreCommitsMatch[1]} more commits)` : '';

          detailText = cleanSummary ? `${cleanSummary} ${commitId}${additionalCommits}` : '';
        }
      } else {
        // Generic fallback for unknown activity types
        const genericMatch = title ? title.match(/(.+) at/) : null;
        activityText = genericMatch ? genericMatch[1] : (title || 'Unknown Activity');
      }

      const item = document.createElement('div');
      item.className = isNewEntry ? 'feed-item new' : 'feed-item';
      const formattedDate = updatedDate.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit'
      });
      const formattedTime = updatedDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      item.innerHTML = `
        <h4>${author} ${activityText}</h4>
        <p>${formattedDate} ${formattedTime} • ${projectInfo}</p>
        ${detailText ? `<p>${detailText}</p>` : ''}
      `;

      if (isRecentEntry) {
        const newDot = document.createElement('span');
        newDot.className = 'new-dot';
        const newText = document.createElement('span');
        newText.className = 'new-text';
        newText.innerHTML = 'NEW!';
        const pElement = item.querySelector('p');
        pElement.appendChild(newDot);
        pElement.appendChild(newText);
      }

      feedContainer.appendChild(item);

      // Remove the 'new' class after the animation ends, but only if it was actually new
      if (isNewEntry) {
        setTimeout(() => {
          item.classList.remove('new');
        }, 1000);
      }
    });

    // Update the last successful fetch time
    lastSuccessfulFetchTime = new Date();
    statusContainer.innerHTML = ''; // Clear any previous status messages

    // Scroll to top if there were new entries
    if (hasNewEntries) {
      feedContainer.scrollTop = 0;
    }

    // Clean up old entries from our tracking set to prevent memory leaks
    // Keep only the current entries
    const currentIds = new Set(currentEntries.map(entry => entry.id));
    displayedEntries = new Set([...displayedEntries].filter(id => currentIds.has(id)));
  } catch (error) {
    console.error('Error fetching feed:', error);
    const statusContainer = document.getElementById('status-container');
    const formattedDateTime = lastSuccessfulFetchTime.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }) + ' ' + lastSuccessfulFetchTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const errorMessage = `The feed has been unavailable since ${formattedDateTime} - Error: ${error.message}`;
    statusContainer.innerHTML = `<p style="color: red;">${errorMessage}</p>`;
  }
}

// Initial fetch
fetchFeed();

// Set interval to auto-update every minute (60,000 milliseconds)
setInterval(fetchFeed, 60000);

// Hide the mouse cursor
document.body.style.cursor = 'none';

// Add event listeners to keep the cursor hidden
document.addEventListener('mousemove', hideCursor);
document.addEventListener('touchmove', hideCursor);

function hideCursor() {
  document.body.style.cursor = 'none';
}

// Add touch/drag scrolling functionality
let isScrolling = false;
let startY = 0;
let startScrollTop = 0;

const feedContainer = document.getElementById('feed-container');

// Mouse events for drag scrolling
feedContainer.addEventListener('mousedown', (e) => {
  isScrolling = true;
  startY = e.clientY;
  startScrollTop = feedContainer.scrollTop;
  feedContainer.style.cursor = 'grabbing';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isScrolling) return;
  e.preventDefault();

  const deltaY = startY - e.clientY;
  feedContainer.scrollTop = startScrollTop + deltaY;
});

document.addEventListener('mouseup', () => {
  if (isScrolling) {
    isScrolling = false;
    feedContainer.style.cursor = 'none';
  }
});

// Touch events for mobile scrolling
feedContainer.addEventListener('touchstart', (e) => {
  isScrolling = true;
  startY = e.touches[0].clientY;
  startScrollTop = feedContainer.scrollTop;
});

feedContainer.addEventListener('touchmove', (e) => {
  if (!isScrolling) return;

  const deltaY = startY - e.touches[0].clientY;
  feedContainer.scrollTop = startScrollTop + deltaY;
  e.preventDefault();
});

feedContainer.addEventListener('touchend', () => {
  isScrolling = false;
});
