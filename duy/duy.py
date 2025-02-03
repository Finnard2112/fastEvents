
#import nltk
#nltk.download('punkt_tab')
#nltk.download('averaged_perceptron_tagger_eng')

# macOS Tesseract path (Homebrew default)
#pytesseract.pytesseract.tesseract_cmd = '/opt/homebrew/bin/tesseract'

import google.generativeai as genai
from datetime import datetime, timedelta

import re
import json

from PIL import Image
import pytesseract

# Idea
#Returns empty array if nothing is found (yet to be tested)
    #Add Default times for events, like 9am for morning & normal, 12 for noon, 3 afternoon, 8 night. Make adjustable setting on extension for user response = model.generate_content("Extract any event details from the provided text string that is extracted via OCR from an image of text messages and return them in the following JSON format: '[{ 'Event': 'Description of the event', 'Time': 'HH:MM AM/PM or HH:MM', 'Date': 'MM/DD/YYYY' }]`. Identify events as any activity or occasion tied to a specific time and/or date, make sure the date is correct (for example, 'tomorrow' should give the date of tomorrow). Today's date is "+ str(today)+ ". Extract clear event descriptions —e.g., 'Meeting with Alex')— standardize time formats to either 12-hour or 24-hour, and date formats to 'MM/DD/YYYY.' If time or date is missing, leave the field blank. Ignore unrelated or irrelevant text, and ensure multiple events are output as separate entries in the JSON array. If no events are found, return an empty array (`[]`). Maintain consistent formatting and provide complete details whenever possible. Here is the text: " + text)
    # IDEA for seperating and filtering each. Ask it to include a key in between each important piece of data: "Go to x~~4am~~1/31/2025"
    

def extract_text(image_path):
    img = Image.open(image_path)
    text = pytesseract.image_to_string(img)
    return text.strip()

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


if __name__ == "__main__":
    image_path = "/Users/dzui_/fastEvents/duy/images/Screenshot 0007-01-25 at 14.39.09.png" # Replace with current image path
    text = extract_text(image_path)
    print(f"Extracted Text: {text}")
    events = generate(text)

    if events:
        for i, event in enumerate(events):
            print(f"\nEvent {i+1}:")
            for key, value in event.items():
                print(f"  {key}: {value}")
    else:
        print("No events found or JSON parsing error.")

"""
from dateutil import parser

def extract_dates(text):
    #Extract dates using regex and custom logic for relative phrases.
    today = datetime.now()
    
    # Regex patterns to capture date phrases
    date_patterns = [
        # Relative dates (e.g., "this Friday", "next week")
        r'\b(next|this|last)\s+(week|month|year|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b',
        r'\b(in|after)\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(days|weeks|months|years)\b',
        r'\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(days|weeks|months|years)\s+(ago|from now)\b',
        
        # Absolute dates (e.g., "2025-03-15")
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b',
        r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s+\d{4})?\b',
        r'\b\d{4}-\d{2}-\d{2}\b',
        
        # Standalone terms (e.g., "tomorrow", "today")
        r'\b(tomorrow|today|tonight)\b',
        
        # Time-aware patterns (e.g., "at 3 PM")
        r'\b(at\s+)?\d{1,2}(?::\d{2})?\s*(?:AM|PM)?\b',
    ]
    
    matches = []
    for pattern in date_patterns:
        matches += re.findall(pattern, text, flags=re.IGNORECASE)
    
    # Clean matches to handle regex groups and typos
    cleaned_matches = []
    for match in matches:
        if isinstance(match, tuple):
            # Join groups and filter out non-date words (e.g., "for" in "tomorrow for")
            cleaned = ' '.join([g.strip() for g in match if g.strip() and g.strip().lower() not in ['for', 'or', 'at']])
        else:
            cleaned = match.strip()
        
        # Remove trailing non-date words (e.g., "fridayf" → "friday")
        cleaned = re.sub(r'\W+$', '', cleaned)  # Remove trailing punctuation
        cleaned = re.sub(r'\b(?:for|or|at)\b.*', '', cleaned, flags=re.IGNORECASE)  # Remove phrases like "for lunch"
        if cleaned:
            cleaned_matches.append(cleaned.strip())
    
    # Remove duplicates
    unique_matches = []
    seen = set()
    for m in cleaned_matches:
        if m.lower() not in seen:
            seen.add(m.lower())
            unique_matches.append(m)
    
    # Parse dates with custom logic for relative phrases
    parsed_dates = []
    for match in unique_matches:
        try:
            # Handle standalone terms like "tomorrow", "today", "tonight"
            if match.lower() in ['tomorrow', 'today', 'tonight']:
                if match.lower() == 'tomorrow':
                    date = today + timedelta(days=1)
                elif match.lower() == 'today':
                    date = today
                elif match.lower() == 'tonight':
                    date = today.replace(hour=20, minute=0, second=0, microsecond=0)  # 8 PM
                parsed_dates.append(date)
            # Handle relative phrases like "two days from now"
            elif re.match(r'\b(\d+|a|an|one|two|three|...)\s+(days|weeks|months|years)\s+(ago|from now)\b', match, flags=re.IGNORECASE):
                # Extract number and unit (e.g., "two days")
                parts = match.split()
                num = parts[0]
                unit = parts[1]
                
                # Convert word numbers to digits (e.g., "two" → 2)
                word_to_num = {
                    'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3,
                    'four': 4, 'five': 5, 'six': 6, 'seven': 7,
                    'eight': 8, 'nine': 9, 'ten': 10
                }
                
                # Safely convert num to an integer
                if num.lower() in word_to_num:
                    num = word_to_num[num.lower()]
                else:
                    try:
                        num = int(num)  # Convert numeric strings to integers
                    except ValueError:
                        continue  # Skip if num can't be converted
                
                # Calculate the date
                if unit.startswith('day'):
                    delta = timedelta(days=num)
                elif unit.startswith('week'):
                    delta = timedelta(weeks=num)
                elif unit.startswith('month'):
                    delta = timedelta(days=num * 30)  # Approximate
                elif unit.startswith('year'):
                    delta = timedelta(days=num * 365)  # Approximate
                
                # Adjust for "ago" or "from now"
                if 'ago' in match.lower():
                    date = today - delta
                else:
                    date = today + delta
                
                parsed_dates.append(date)
            else:
                # Use dateutil.parser for absolute or semi-absolute dates
                date = parser.parse(match, fuzzy=True, default=today)
                parsed_dates.append(date)
        except ValueError:
            continue  # Skip phrases that can't be parsed
    
    print(unique_matches, parsed_dates)
    return unique_matches, parsed_dates

from nltk import pos_tag, word_tokenize

def extract_event(text, date_phrases):
    # Remove detected date phrases from the text
    for phrase in date_phrases:
        text = text.replace(phrase, '')
    
    # Tokenize and tag parts of speech
    tokens = word_tokenize(text)
    tagged = pos_tag(tokens)
    
    # Identify verbs/nouns as event keywords (e.g., "meet", "party")
    event_keywords = [
        word for word, tag in tagged
        if tag.startswith('VB') or tag.startswith('NN')  # Verbs or nouns
    ]
    return ' '.join(event_keywords).strip()
"""
#^^^Parsing

#Gen AI Trial

"""def generate(extracted_text):
    today = datetime.now()

    #Duy's API Key
    genai.configure(api_key="")
    model = genai.GenerativeModel("gemini-1.5-flash")
    text = extracted_text

    #Returns empty array if nothing is found (yet to be tested)
    #Add Default times for events, like 9am for morning & normal, 12 for noon, 3 afternoon, 8 night. Make adjustable setting on extension for user
    response = model.generate_content("Extract any event details from the provided text string that is extracted via OCR from an image of text messages and return them in the following JSON format: '[{ 'Event': 'Description of the event', 'Time': 'HH:MM AM/PM or HH:MM', 'Date': 'MM/DD/YYYY' }]`. Identify events as any activity or occasion tied to a specific time and/or date, make sure the date is correct (for example, 'tomorrow' should give the date of tomorrow). Today's date is "+ str(today)+ ". Extract clear event descriptions —e.g., 'Meeting with Alex')— standardize time formats to either 12-hour or 24-hour, and date formats to 'MM/DD/YYYY.' If time or date is missing, leave the field blank. Ignore unrelated or irrelevant text, and ensure multiple events are output as separate entries in the JSON array. If no events are found, return an empty array (`[]`). Maintain consistent formatting and provide complete details whenever possible. Here is the text: " + text)
    # IDEA for seperating and filtering each. Ask it to include a key in between each important piece of data: "Go to x~~4am~~1/31/2025"
    print("Printing", response.text)


    
    
    if __name__ == "__main__":
    image_path = "/Users/dzui_/fastEvents/duy/images/Test multi.png"
    
    #Extract text from image
    text = extract_text(image_path)
    print(f"Extracted Text: {text}")
    generate(text)
    #-------
    
    # Step 2: Detect dates
    date_phrases, parsed_dates = extract_dates(text)
    date = parsed_dates[0] if parsed_dates else None
    
    # Step 3: Extract event
    event = extract_event(text, date_phrases)
    
    print(f"\nEvent: {event}")
    print(f"Date: {date}")
    """