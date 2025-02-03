// background.js

import Tesseract from './lib/tesseract.esm.min.js';

// Listener for extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['lib/html2canvas.min.js','content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Failed to inject scripts: ${chrome.runtime.lastError.message}`);
      return;
    }
    console.log('Scripts injected successfully.');

    // Send a message to content.js to start selection
    chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
  });
});

// Listener for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'screenshotCaptured' && request.dataURL) {
    // Store the screenshot data
    chrome.storage.local.set({ screenshot: request.dataURL }, () => {
      console.log('Screenshot data stored.');
    });

    // Open the confirmation popup window with the screenshot data
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/confirmation.html'),
      type: 'popup',
      width: 400,
      height: 600
    }, (window) => {
      console.log('Confirmation popup opened.');
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processScreenshot') {
    // Retrieve the screenshot from chrome.storage.local
    chrome.storage.local.get('screenshot', (data) => {
      const screenshotData = data.screenshot;
      if (!screenshotData) {
        sendResponse({ status: 'error', message: 'No screenshot found' });
        return;
      }

      // Send the prompt (with the image data) to ChatGPT and return its response
      sendToChatGPT(screenshotData)
        .then((chatGPTResponse) => {
          console.log('ChatGPT response:', chatGPTResponse);
          sendResponse({ status: 'success', data: chatGPTResponse });
        })
        .catch((error) => {
          console.error('Error processing screenshot:', error);
          sendResponse({ status: 'error', message: error.message });
        });
    });
    // Return true to indicate that we will send a response asynchronously.
    return true;
  } else if (request.action === 'cancelScreenshot') {
    // Clear the stored screenshot and return a cancellation status
    chrome.storage.local.remove('screenshot', () => {
      sendResponse({ status: 'cancelled' });
    });
    return true;
  }
});

async function sendToChatGPT(screenshotData) {
  const apiKey = ''; // Replace with your actual API key
  const url = 'https://api.openai.com/v1/chat/completions';
  const today = new Date().toLocaleDateString('en-US'); 
  const promptContent = `Extract any event details from the provided text string that is extracted via OCR from an image of text messages; order them from soonest to latest in terms of date and time, then return them in the following JSON format: '[{{ "Event": "Description of the event", "Time": "HH:MM AM/PM or HH:MM", "Date": "MM/DD/YYYY" }}]'. Identify events as any activity or occasion tied to a specific time and/or date, make sure the date is correct (for example, 'tomorrow' should give the date of tomorrow). Today's date is ${today}. Extract clear event descriptions —e.g., 'Meeting with Alex'— standardize time formats to either 12-hour or 24-hour, and date formats to 'MM/DD/YYYY.' If time or date is missing, leave the field blank. Ignore unrelated or irrelevant text, and ensure multiple events are output as separate entries in the JSON array. If no events are found, return an empty array (\`[]\`). Maintain consistent formatting and provide complete details whenever possible.`;

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: promptContent
          },
          {
            type: 'image_url',
            image_url: {
              url: screenshotData
            }
          }
        ]
      }
    ],
    max_tokens: 300
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    // Log the raw response status and headers
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    // Read the raw text of the response for debugging
    const rawResponseText = await response.text();
    console.log('Raw response text:', rawResponseText);

    // Try to parse JSON from the response text
    let data;
    try {
      data = JSON.parse(rawResponseText);
    } catch (jsonError) {
      console.error('Error parsing JSON:', jsonError);
      throw new Error('Failed to parse JSON from response');
    }

    console.log('Parsed ChatGPT response:', data);
    return data;
  } catch (error) {
    console.error('Error fetching chat completions:', error);
    throw error;
  }
}