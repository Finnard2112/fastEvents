from PIL import Image
import pytesseract
import nltk


# macOS Tesseract path (Homebrew default)
pytesseract.pytesseract.tesseract_cmd = '/opt/homebrew/bin/tesseract'

from datetime import datetime, timedelta
import re
from dateutil import parser

def extract_dates(text):
    """Extract dates using regex and custom logic for relative phrases."""
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



text = "Submit the report in two days from now."
matches, parsed_dates = extract_dates(text)
print("Matches:", matches)
print("Parsed Dates:", parsed_dates)