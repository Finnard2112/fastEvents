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
      console.log("Events retrieved:", events);
      renderEvents(events);
    } else {
      console.log("No Events found");
    }
  });
  
  function renderEvents(eventsArray) {
    const container = document.getElementById('events-container');
    container.innerHTML = ''; // Clear previous content

    console.log(eventsArray)
  
    // Create a wrapper for the events list
    const eventsWrapper = document.createElement('div');
    eventsWrapper.className = 'events-wrapper';
  
    eventsArray.forEach((eventObj, index) => {
      // Create a horizontal box container for this event
      const eventEntry = document.createElement('div');
      eventEntry.className = 'event-entry';
      eventEntry.dataset.index = index;
  
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

  
      // Create the Time input (text)
      const timeInput = document.createElement('input');
      timeInput.type = 'text';
      timeInput.value = eventObj.Time || '';
      timeInput.placeholder = 'HH:MM';
  
      // Create an additional button on the right for this event
      const extraBtn = document.createElement('button');
      extraBtn.textContent = '+';
      extraBtn.addEventListener('click', () => {
        console.log(`Extra button clicked for event at index ${index}`);
        // Add any extra action you need here
      });
  
      // Append the inputs and extra button to the event entry.
      eventEntry.appendChild(eventInput);
      eventEntry.appendChild(dateInput);
      eventEntry.appendChild(timeInput);
      eventEntry.appendChild(extraBtn);
  
      // Append the event entry to the events wrapper.
      eventsWrapper.appendChild(eventEntry);
    });
  
    // Append the events wrapper to the container.
    container.appendChild(eventsWrapper);
  
    // Create a container for the overall Confirm and Exit buttons.
    const actionContainer = document.createElement('div');
    actionContainer.className = 'action-container';
  
    // One Confirm button for all events.
    const confirmAllBtn = document.createElement('button');
    confirmAllBtn.textContent = 'Confirm All';
    confirmAllBtn.addEventListener('click', () => {
      // Regexes for date (MM/DD/YYYY) and time (24-hour HH:MM)
      const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
      const timeRegex = /^((0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)|([01]\d|2[0-3]):([0-5]\d))$/i;
      let valid = true;
      const updatedEvents = [];
  
      // Validate every event entry.
      const entries = document.querySelectorAll('.event-entry');
      entries.forEach((entry) => {
        const [eventInput, dateInput, timeInput] = entry.children;
        if (!dateRegex.test(dateInput.value)) {
          alert('One or more events have an invalid date format. Please use MM/DD/YYYY.');
          valid = false;
          return;
        }
        if (!timeRegex.test(timeInput.value)) {
          alert('One or more events have an invalid time format. Please use HH:MM in 24-hour format.');
          valid = false;
          return;
        }
        updatedEvents.push({
          Event: eventInput.value,
          Date: dateInput.value,
          Time: timeInput.value,
        });
      });
  
      if (valid) {
        // Update storage with the updated events array.
        chrome.storage.local.set({ gemEvents: updatedEvents }, () => {
          console.log('All events updated:', updatedEvents);
          alert('Events saved successfully!');
        });

        chrome.runtime.sendMessage({ action: 'eventsConfirmed'});
        // window.close()
      }
    });
  
    // Exit button to close or exit the popup.
    const exitBtn = document.createElement('button');
    exitBtn.textContent = 'Exit';
    exitBtn.addEventListener('click', () => {
      window.close();
    });
  
    // Append the buttons to the action container.
    actionContainer.appendChild(confirmAllBtn);
    actionContainer.appendChild(exitBtn);
  
    // Append the action container to the main container.
    container.appendChild(actionContainer);
  }  

});
