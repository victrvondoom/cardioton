import os
import json
import requests
from typing import Dict, List, Optional
import google.generativeai as genai
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin, urlparse

class PriorAuthAgent:
    """AI agent for selecting and managing prior authorization forms based on patient state"""
    
    def __init__(self):
        # Get the directory where this script is located
        script_dir = os.path.dirname(os.path.abspath(__file__))
        self.forms_directory = os.path.join(script_dir, "prior_auth_forms")
        self.available_states = self._get_available_states()
        
        # State abbreviation mapping
        self.state_abbreviations = {
            'AL': 'alabama',
            'AK': 'alaska', 
            'MD': 'maryland',
            'TX': 'texas',
            'CA': 'california',
            'NY': 'new york',
            'FL': 'florida',
            'IL': 'illinois',
            'PA': 'pennsylvania',
            'OH': 'ohio',
            'GA': 'georgia',
            'NC': 'north carolina',
            'MI': 'michigan',
            'NJ': 'new jersey',
            'VA': 'virginia',
            'WA': 'washington',
            'AZ': 'arizona',
            'MA': 'massachusetts',
            'TN': 'tennessee',
            'IN': 'indiana',
            'MO': 'missouri',
            'CO': 'colorado',
            'SC': 'south carolina',
            'LA': 'louisiana',
            'KY': 'kentucky',
            'OR': 'oregon',
            'OK': 'oklahoma',
            'CT': 'connecticut',
            'UT': 'utah',
            'IA': 'iowa',
            'NV': 'nevada',
            'AR': 'arkansas',
            'MS': 'mississippi',
            'KS': 'kansas',
            'NM': 'new mexico',
            'NE': 'nebraska',
            'WV': 'west virginia',
            'ID': 'idaho',
            'HI': 'hawaii',
            'NH': 'new hampshire',
            'ME': 'maine',
            'RI': 'rhode island',
            'MT': 'montana',
            'DE': 'delaware',
            'SD': 'south dakota',
            'ND': 'north dakota',
            'AK': 'alaska',
            'VT': 'vermont',
            'WY': 'wyoming'
        }
        
    def _get_available_states(self) -> Dict[str, str]:
        """Get available state forms from the forms directory"""
        states = {}
        if os.path.exists(self.forms_directory):
            for filename in os.listdir(self.forms_directory):
                if filename.endswith('.pdf'):
                    state_name = filename.replace('.pdf', '').title()
                    states[state_name.lower()] = {
                        'filename': filename,
                        'display_name': state_name,
                        'path': os.path.join(self.forms_directory, filename)
                    }
        return states
    
    def _normalize_state(self, state: str) -> str:
        """Convert state abbreviation or name to normalized lowercase form"""
        if not state:
            return "unknown"
        
        state_upper = state.upper().strip()
        state_lower = state.lower().strip()
        
        # Check if it's an abbreviation
        if state_upper in self.state_abbreviations:
            return self.state_abbreviations[state_upper]
        
        # Check if it's already a full state name
        if state_lower in self.available_states:
            return state_lower
        
        # Try to find partial matches
        for abbrev, full_name in self.state_abbreviations.items():
            if state_lower in full_name or full_name in state_lower:
                return full_name
        
        return state_lower
    
    def get_patient_state_from_transcript(self, transcript: str) -> Optional[str]:
        """Use AI to extract patient state from clinical transcript"""
        try:
            prompt = f"""
            Analyze the following clinical transcript and extract the patient's state of residence.
            Look for mentions of states, cities, or locations that indicate where the patient lives.
            
            Return ONLY the state name in lowercase (e.g., "alabama", "texas", "maryland", "alaska").
            If no state is mentioned or unclear, return "unknown".
            
            Transcript:
            {transcript}
            
            State:"""
            
            model = genai.GenerativeModel("gemini-2.0-flash-exp")
            response = model.generate_content(prompt)
            
            state = response.text.strip().lower()
            
            # Validate that the state is one of our available states
            if state in self.available_states:
                return state
            else:
                return "unknown"
                
        except Exception as e:
            print(f"Error extracting state from transcript: {e}")
            return "unknown"
    
    def select_prior_auth_form(self, patient_state: str, transcript: str = "") -> Dict:
        """Select the appropriate prior auth form based on patient state"""
        
        # Normalize the state (handles abbreviations like MD -> maryland)
        state_lower = self._normalize_state(patient_state)
        
        # If state is still unknown, try to extract from transcript
        if state_lower == "unknown" and transcript:
            extracted_state = self.get_patient_state_from_transcript(transcript)
            if extracted_state != "unknown":
                state_lower = self._normalize_state(extracted_state)
        
        # Always return both local and online forms, with local forms first
        result = {
            "success": True,
            "state": state_lower.title(),
            "forms": [],
            "local_forms": [],
            "online_forms": [],
            "message": f"Prior authorization forms for {state_lower.title()}"
        }
        
        # PRIORITY 1: Check if we have the form locally (ALWAYS SHOW FIRST)
        if state_lower in self.available_states:
            form_info = self.available_states[state_lower]
            local_form = {
                "name": f"{form_info['display_name']} Prior Authorization Form",
                "filename": form_info['filename'],
                "path": form_info['path'],
                "source": "Local Database",
                "description": f"Pre-loaded prior authorization form for {form_info['display_name']}",
                "available_locally": True,
                "priority": 1,
                "type": "local"
            }
            result["local_forms"].append(local_form)
            result["forms"].append(local_form)
        
        # PRIORITY 2: Always search online for additional forms
        try:
            online_forms = self._web_scrape_prior_auth_forms(state_lower)
            if online_forms:
                for i, form in enumerate(online_forms):
                    form["priority"] = 2 + i  # Lower priority than local
                    form["type"] = "online"
                    form["available_locally"] = False
                result["online_forms"] = online_forms
                result["forms"].extend(online_forms)
        except Exception as e:
            print(f"Online search failed: {e}")
            result["online_forms"] = []
        
        # If no forms found at all
        if not result["forms"]:
            result["success"] = False
            result["message"] = f"No prior authorization forms found for {state_lower.title()}"
            result["available_states"] = list(self.available_states.keys())
        
        return result
    
    def get_available_forms_info(self) -> List[Dict]:
        """Get information about all available prior auth forms"""
        forms_info = []
        for state, info in self.available_states.items():
            forms_info.append({
                "state": info['display_name'],
                "filename": info['filename'],
                "path": info['path']
            })
        return forms_info
    
    def _web_scrape_prior_auth_forms(self, state: str) -> List[Dict]:
        """Web scrape for prior authorization forms online for a specific state"""
        forms = []
        
        try:
            # Create a more robust headers configuration
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
            
            # Try to find forms using a more generic approach
            # First, try to find common state health department URLs
            state_health_urls = [
                f"https://health.{state.lower()}.gov",
                f"https://www.{state.lower()}.gov/health",
                f"https://dhs.{state.lower()}.gov",
                f"https://www.{state.lower()}.gov/dhs",
                f"https://medicaid.{state.lower()}.gov",
                f"https://www.{state.lower()}.gov/medicaid"
            ]
            
            for site_url in state_health_urls:
                try:
                    print(f"Trying to access: {site_url}")
                    response = requests.get(site_url, headers=headers, timeout=15)
                    if response.status_code == 200:
                        soup = BeautifulSoup(response.content, 'html.parser')
                        
                        # Look for PDF links containing prior auth keywords
                        pdf_links = soup.find_all('a', href=re.compile(r'\.pdf', re.I))
                        
                        for link in pdf_links:
                            href = link.get('href', '')
                            title = link.get_text().strip()
                            
                            if any(keyword in href.lower() or keyword in title.lower() 
                                   for keyword in ['prior', 'authorization', 'auth', 'medicaid', 'preauth']):
                                full_url = urljoin(site_url, href)
                                forms.append({
                                    "name": title or f"{state.title()} Prior Auth Form",
                                    "url": full_url,
                                    "source": f"{state.title()} Government Site",
                                    "description": f"Official form from {state.title()} government",
                                    "filename": f"{state.lower()}_gov_prior_auth_{len(forms)+1}.pdf"
                                })
                                print(f"Found form: {title}")
                
                except Exception as e:
                    print(f"Error checking {site_url}: {e}")
                    continue
            
            # If no forms found through direct access, create some generic suggestions
            if not forms:
                # Create some generic form suggestions based on common patterns
                generic_forms = [
                    {
                        "name": f"{state.title()} Medicaid Prior Authorization Form",
                        "url": f"https://www.{state.lower()}.gov/medicaid/forms",
                        "source": f"{state.title()} Medicaid",
                        "description": f"Medicaid prior authorization form for {state.title()}",
                        "filename": f"{state.lower()}_medicaid_prior_auth.pdf"
                    },
                    {
                        "name": f"{state.title()} State Health Department Prior Auth",
                        "url": f"https://health.{state.lower()}.gov/forms",
                        "source": f"{state.title()} Health Department",
                        "description": f"Health department prior authorization form for {state.title()}",
                        "filename": f"{state.lower()}_health_dept_prior_auth.pdf"
                    }
                ]
                forms.extend(generic_forms)
            
            # Remove duplicates based on URL
            seen_urls = set()
            unique_forms = []
            for form in forms:
                if form['url'] not in seen_urls:
                    seen_urls.add(form['url'])
                    unique_forms.append(form)
            
            return unique_forms[:3]  # Return top 3 unique forms
            
        except Exception as e:
            print(f"Error in web scraping: {e}")
            # Return generic suggestions even if scraping fails
            return [
                {
                    "name": f"{state.title()} Prior Authorization Form",
                    "url": f"https://www.{state.lower()}.gov/health/forms",
                    "source": f"{state.title()} State Resources",
                    "description": f"Check {state.title()} state health department for prior authorization forms",
                    "filename": f"{state.lower()}_prior_auth.pdf"
                }
            ]

    def generate_prior_auth_guidance(self, state: str, procedure_type: str = "") -> str:
        """Generate guidance for prior authorization requirements for a specific state"""
        try:
            prompt = f"""
            Provide guidance on prior authorization requirements for {state.title()} state.
            {f"Focus on {procedure_type} procedures." if procedure_type else ""}
            
            Include:
            1. Common requirements
            2. Typical processing times
            3. Key documentation needed
            4. State-specific considerations
            
            Keep the response concise and practical for healthcare providers.
            """
            
            model = genai.GenerativeModel("gemini-2.0-flash-exp")
            response = model.generate_content(prompt)
            return response.text
            
        except Exception as e:
            return f"Unable to generate guidance for {state.title()}. Please check state-specific requirements."
