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

let lastSuccessfulFetchTime = null;

async function fetchFeed() {
  try {
    const text = await ipcRenderer.invoke('fetch-feed');
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    const entries = xml.getElementsByTagName('entry');
    const feedContainer = document.getElementById('feed-container');
    const statusContainer = document.getElementById('status-container');

    feedContainer.innerHTML = ''; // Clear previous content

    Array.from(entries).forEach(entry => {
      const title = entry.getElementsByTagName('title')[0].textContent;
      const updated = entry.getElementsByTagName('updated')[0].textContent;
      const summary = entry.getElementsByTagName('summary')[0].innerHTML;
      const author = entry.getElementsByTagName('author')[0].getElementsByTagName('name')[0].textContent;
      const repoBranchMatch = title.match(/at (.+) \/ (.+)/);
      const repo = repoBranchMatch ? repoBranchMatch[1] : 'Unknown Repo';
      const branch = repoBranchMatch ? repoBranchMatch[2] : 'Unknown Branch';

      const updatedDate = new Date(updated);
      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const isNew = updatedDate > fifteenMinutesAgo;

      // Parse the summary to extract the blockquote text and commit ID
      const summaryDoc = parser.parseFromString(summary, 'text/html');
      const blockquote = summaryDoc.querySelector('.blockquote p');
      const commitLink = summaryDoc.querySelector('a');
      const cleanSummary = blockquote ? blockquote.textContent.trim() : '';
      const commitId = commitLink ? commitLink.textContent.trim() : '';

      const item = document.createElement('div');
      item.className = 'feed-item new';
      const formattedDate = updatedDate.toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      });
      const formattedTime = updatedDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
      item.innerHTML = `
        <h4>${author} pushed to ${repo}/${branch}</h4>
        <p>${formattedDate} ${formattedTime}</p>
        <p>${cleanSummary} ${commitId}</p>
      `;

      if (isNew) {
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

      // Remove the 'new' class after the animation ends
      setTimeout(() => {
        item.classList.remove('new');
      }, 1000);
    });

    // Update the last successful fetch time
    lastSuccessfulFetchTime = new Date();
    statusContainer.innerHTML = ''; // Clear any previous status messages
  } catch (error) {
    console.error('Error fetching feed:', error);
    const statusContainer = document.getElementById('status-container');
    const errorMessage = `The feed has been unavailable since ${lastSuccessfulFetchTime ? lastSuccessfulFetchTime.toLocaleString() : 'now'}.`;
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
