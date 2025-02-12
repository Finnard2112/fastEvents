// confirmation.js

document.addEventListener('DOMContentLoaded', () => {
  const screenshotImg = document.getElementById('screenshot');
  const confirmBtn = document.getElementById('confirm-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  let events = null;
  
  // Retrieve both screenshot and gemEvents from storage.
  chrome.storage.local.get(['screenshot', 'gemEvents'], (data) => {
    if (data.screenshot) {
      screenshotImg.src = data.screenshot;
    } else {
      document.getElementById('info').textContent = 'No screenshot available.';
      confirmBtn.disabled = true;
      cancelBtn.textContent = 'Close';
    }
    
    if (data.gemEvents) {
      events = data.gemEvents;
      console.log("GemEvents retrieved:", events);
      renderEvents(events);
    } else {
      console.log("No gemEvents found");
    }
  });
  
  // Renders the events editing boxes inside the events-container element.
  function renderEvents(eventsArray) {
    const container = document.getElementById('events-container');
    container.innerHTML = ''; // Clear previous content
    eventsArray.forEach((eventObj, index) => {
      // Create the wrapper for this event
      const entry = document.createElement('div');
      entry.className = 'event-entry';
      entry.dataset.index = index; // store index for reference

      // Create the Event name field (text)
      const eventInput = document.createElement('input');
      eventInput.type = 'text';
      eventInput.value = eventObj.Event || '';
      eventInput.placeholder = 'Event name';

      // Create the Date field (text with pattern for MM/DD/YYYY)
      const dateInput = document.createElement('input');
      dateInput.type = 'text';
      dateInput.value = eventObj.Date || '';
      dateInput.placeholder = 'MM/DD/YYYY';
      dateInput.pattern = '(0[1-9]|1[0-2])\\/(0[1-9]|[12]\\d|3[01])\\/\\d{4}';

      // Create the Time field (using input type="time" for 24-hour HH:MM format)
      const timeInput = document.createElement('input');
      timeInput.type = 'time';
      timeInput.value = eventObj.Time || '';
      timeInput.placeholder = 'HH:MM';

      // Container for the Confirm and Remove buttons
      const btnContainer = document.createElement('div');
      btnContainer.className = 'buttons';

      // Confirm button to commit changes for this event.
      const confirmEventBtn = document.createElement('button');
      confirmEventBtn.textContent = 'Confirm';
      confirmEventBtn.addEventListener('click', () => {
        const updatedEvent = {
          Event: eventInput.value,
          Date: dateInput.value,
          Time: timeInput.value
        };

        // Validate the Date field with a regex (MM/DD/YYYY)
        const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
        if (!dateRegex.test(updatedEvent.Date)) {
          alert('Please enter a valid date in MM/DD/YYYY format.');
          return;
        }
        // The time field is an input type "time", so its value should already be valid in HH:MM format.

        // Update the event in the array and save to storage.
        events[index] = updatedEvent;
        chrome.storage.local.set({ gemEvents: events }, () => {
          console.log(`Event at index ${index} updated:`, updatedEvent);
          confirmEventBtn.textContent = 'Saved';
          setTimeout(() => {
            confirmEventBtn.textContent = 'Confirm';
          }, 2000);
        });
      });

      // Remove button to delete this event.
      const removeEventBtn = document.createElement('button');
      removeEventBtn.textContent = 'Remove';
      removeEventBtn.addEventListener('click', () => {
        // Remove the event from the array
        events.splice(index, 1);
        chrome.storage.local.set({ gemEvents: events }, () => {
          console.log(`Event at index ${index} removed.`);
          // Re-render the events list with updated array.
          renderEvents(events);
        });
      });

      // Append the buttons to the button container.
      btnContainer.appendChild(confirmEventBtn);
      btnContainer.appendChild(removeEventBtn);

      // Append the inputs and button container to the event entry.
      entry.appendChild(eventInput);
      entry.appendChild(dateInput);
      entry.appendChild(timeInput);
      entry.appendChild(btnContainer);

      // Append the event entry to the container.
      container.appendChild(entry);
    });
  }

  // Confirm Screenshot button (keeps the events as they are and processes screenshot).
  confirmBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'processScreenshot' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
      } else {
        console.log('Response from background:', response);
      }
      // Optionally, you can close the window here.
      // window.close();
    });
  });

  // Cancel button to abort the screenshot creation.
  cancelBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'cancelScreenshot' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
      } else {
        console.log('Cancel response:', response);
      }
      window.close();
    });
  });

  // Optionally, listen for additional messages.
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'eventsConfirmation' && request.events) {
      console.log(request.events);
    }
  });
});
