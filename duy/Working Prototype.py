# Idea
#Returns empty array if nothing is found (yet to be tested)
    #Add Default times for events, like 9am for morning & normal, 12 for noon, 3 afternoon, 8 night. Make adjustable setting on extension for user response = model.generate_content("Extract any event details from the provided text string that is extracted via OCR from an image of text messages and return them in the following JSON format: '[{ 'Event': 'Description of the event', 'Time': 'HH:MM AM/PM or HH:MM', 'Date': 'MM/DD/YYYY' }]`. Identify events as any activity or occasion tied to a specific time and/or date, make sure the date is correct (for example, 'tomorrow' should give the date of tomorrow). Today's date is "+ str(today)+ ". Extract clear event descriptions —e.g., 'Meeting with Alex')— standardize time formats to either 12-hour or 24-hour, and date formats to 'MM/DD/YYYY.' If time or date is missing, leave the field blank. Ignore unrelated or irrelevant text, and ensure multiple events are output as separate entries in the JSON array. If no events are found, return an empty array (`[]`). Maintain consistent formatting and provide complete details whenever possible. Here is the text: " + text)
    # IDEA for seperating and filtering each. Ask it to include a key in between each important piece of data: "Go to x~~4am~~1/31/2025"
#Let user set which calendar they want into, find x way to deal with errors



from datetime import datetime, timedelta
import datetime as dt
import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import google.generativeai as genai
import re
import json
from PIL import Image
import pytesseract
import nltk

import pytz

#nltk.download('punkt_tab')
#nltk.download('averaged_perceptron_tagger_eng')

# Set Tesseract path
pytesseract.pytesseract.tesseract_cmd = '/opt/homebrew/bin/tesseract'  # Or your Tesseract path

# Google Calendar API credentials and scopes
SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar'  # For calendar sharing
]
CREDENTIALS_FILE = '/Users/dzui_/fastEvents/docs/credentials.json'  # Path to your credentials file (downloaded from Google Cloud Console)
TOKEN_FILE = '/Users/dzui_/fastEvents/docs/token.json' # Path to store the token

def extract_text_from_image(image_path):
    genai.configure(api_key="")
    model = genai.GenerativeModel("gemini-1.5-flash")

    try:
        with open(image_path, "rb") as image_file:
            image_bytes = image_file.read()

        response = model.generate_content(
            [
                {
                    "parts": [
                        {"inline_data": {"mime_type": "image/jpeg", "data": image_bytes}}, # Or image/png, etc.
                        {"text": "Extract the text from this image using OCR."}
                    ]
                }
            ]
        )

        extracted_text = response.text.strip()
        return extracted_text

    except Exception as e:
        print(f"Error during Gemini OCR: {e}")
        return None



def generate(extracted_text):
    today = datetime.now()

    genai.configure(api_key="")
    model = genai.GenerativeModel("gemini-1.5-flash")
    text = extracted_text

    response = model.generate_content(f"""Extract any event details from the provided text string that is extracted via OCR from an image of text messages; order them from soonest to latest in terms of date and time, then return them in the following JSON format: '[{{ "Event": "Description of the event", "Time": "HH:MM AM/PM or HH:MM", "Date": "MM/DD/YYYY" }}]`. Identify events as any activity or occasion tied to a specific time and/or date, make sure the date is correct (for example, 'tomorrow' should give the date of tomorrow). Today's date is {today}. Extract clear event descriptions —e.g., 'Meeting with Alex')— standardize time formats to either 12-hour or 24-hour, and date formats to 'MM/DD/YYYY.' If time or date is missing, leave the field blank. Ignore unrelated or irrelevant text, and ensure multiple events are output as separate entries in the JSON array. If no events are found, return an empty array (`[]`). Maintain consistent formatting and provide complete details whenever possible. Here is the text: {text}""")

    print("Gemini Response:", response.text)

    # Extract text from the response
    try:
        json_string = response.text.replace("```json", "").replace("```", "").strip()

        match = re.match(r"^(\[.*\])", json_string, re.DOTALL)
        if match:
            json_string = match.group(1)
        else:
            print("Warning: Could not find valid JSON in response.")
            print("Raw response text:", response.text)
            return []

        events = json.loads(json_string)

        event_list = []
        for event in events:
            event_list.append(event)

        return event_list

    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        print("Raw response text:", response.text)
        return []  # Return empty list in case of error
    except Exception as e: # Catching any other potential exceptions
        print(f"An unexpected error occurred: {e}")
        print("Raw response text:", response.text)
        return []


import pytz  # Add this import at the top

def add_event_to_calendar(event_data):
    creds = None

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())

    try:
        service = build("calendar", "v3", credentials=creds)
        timezone = pytz.timezone("America/New_York")  # Your timezone

        for event in event_data:
            event_name = event.get("Event")
            start_date_str = event.get("Date")
            start_time_str = event.get("Time")

            # Default to tomorrow if no date is provided
            if not start_date_str:
                start_date_obj = dt.datetime.now(timezone) + dt.timedelta(days=1)
            else:
                try:
                    # Parse date from Gemini's format (MM/DD/YYYY)
                    start_date_obj = dt.datetime.strptime(start_date_str, "%m/%d/%Y")
                    start_date_obj = timezone.localize(start_date_obj)  # Localize
                except ValueError:
                    print(f"Skipping invalid date format: {start_date_str}")
                    continue

            # Default to 09:00:00 if no time is provided
            if not start_time_str:
                start_time_obj = dt.time(9, 0, 0)  # 9 AM
            else:
                try:
                    # Parse time from Gemini's format (HH:MM AM/PM or HH:MM)
                    if "AM" in start_time_str.upper() or "PM" in start_time_str.upper():
                        start_time_obj = dt.datetime.strptime(start_time_str, "%I:%M %p").time()
                    else:
                        start_time_obj = dt.datetime.strptime(start_time_str, "%H:%M").time()
                except ValueError:
                    print(f"Skipping invalid time format: {start_time_str}")
                    continue

            # Combine date and time into a timezone-aware datetime object
            start_datetime_obj = timezone.localize(
                dt.datetime.combine(start_date_obj.date(), start_time_obj)
            )

            # Convert to ISO 8601 format with timezone
            start_datetime_iso = start_datetime_obj.isoformat()

            # Default end time: 1 hour after start
            end_datetime_obj = start_datetime_obj + dt.timedelta(hours=1)
            end_datetime_iso = end_datetime_obj.isoformat()

            # Build the event body
            event_body = {
                "summary": event_name,
                "start": {
                    "dateTime": start_datetime_iso,
                    "timeZone": "America/New_York",
                },
                "end": {
                    "dateTime": end_datetime_iso,
                    "timeZone": "America/New_York",
                },
                "visibility": "public",
                #"attendees": [{"email": "finnard2112@gmail.com"}],  # Add your friend's email
            }

            try:
                created_event = service.events().insert(
                    calendarId="primary", 
                    body=event_body
                ).execute()
                print(f'Event created: {created_event.get("htmlLink")}')
            except HttpError as error:
                print(f"Google API error: {error}")
                continue

    except Exception as e:
        print(f"An error occurred while adding to calendar: {e}")


if __name__ == "__main__":
    image_path = "/Users/dzui_/fastEvents/duy/images/Screenshot 0007-01-25 at 14.51.22.png"  # Replace with your image path

    extracted_text = extract_text_from_image(image_path)
    if extracted_text:
        print(f"Extracted Text (Gemini): {extracted_text}")
        events = generate(extracted_text)

        if events:
            for i, event in enumerate(events):
                print(f"\nEvent {i + 1}:")
                for key, value in event.items():
                    print(f"  {key}: {value}")

            add_event_to_calendar(events) # Add events to Google Calendar
        else:
            print("No events found or JSON parsing error.")
    else:
        print("Failed to extract text from image.")