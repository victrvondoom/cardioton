import json
import os
import pdb
import tempfile
from datetime import datetime
from functools import wraps

import google.generativeai as genai
import requests
from bson.objectid import ObjectId
from flask import (Flask, flash, jsonify, make_response, redirect,
                   render_template, request, send_file, url_for)

from code_lookup import extract_medical_terms_from_text, find_medical_codes
from database import Database
from pdf_generator_direct import PDFGeneratorDirect

# Prior auth agent is now imported from ai_agents

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-change-this-in-production')

# Add JSON filter for templates
@app.template_filter('tojsonfilter')
def to_json_filter(obj):
    return json.dumps(obj)

# Initialize database
db = Database()

# Import AI Agents
from ai_agents import (create_cms_assistant_agent, create_contextus_ai_agent,
                       create_enhanced_processing_agent,
                       create_medical_billing_agent,
                       create_speaker_identification_agent)
# Import the new PriorAuthAgent
from prior_auth_agent import PriorAuthAgent
# Import Contextus integration
from contextus_integration import create_contextus_integration

# Initialize Contextus integration
contextus = create_contextus_integration()

# Initialize AI Agents
medical_billing_agent = create_medical_billing_agent()
speaker_identification_agent = create_speaker_identification_agent()
cms_assistant_agent = create_cms_assistant_agent()
prior_authorization_agent = PriorAuthAgent()  # Use the new PriorAuthAgent
contextus_ai_agent = create_contextus_ai_agent()
enhanced_processing_agent = create_enhanced_processing_agent()

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session_token = request.cookies.get('session_token')
        if not session_token:
            return redirect(url_for('login'))
        
        session_info = db.get_session_info(session_token)
        if not session_info or not session_info['doctor']:
            return redirect(url_for('login'))
        
        # Make doctor and selected patient available in the route
        request.current_user = session_info['doctor']
        request.selected_patient = session_info['selected_patient']
        request.session_token = session_token
        return f(*args, **kwargs)
    return decorated_function

# Patient selection required decorator
def patient_required(f):
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not request.selected_patient:
            return redirect(url_for('select_patient'))
        return f(*args, **kwargs)
    return decorated_function

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Initialize the model
model = genai.GenerativeModel("gemini-2.5-flash-lite")

# Initialize PDF generator with direct PDF editing
pdf_generator = None 

# Initialize Prior Auth Agent
# Prior auth agent is now initialized as part of ai_agents


def load_persistent_data():
    """
    Load persistent patient and provider data from MongoDB database.
    """
    persistent_data = {
        "patient": {},
        "provider": {}
    }
    
    try:
        # Load patient data from MongoDB if available
        if hasattr(request, 'selected_patient') and request.selected_patient:
            patient_info = request.selected_patient.get('patient_info', {})
            if patient_info:
                # Handle address field - could be string or object for backwards compatibility
                address_value = patient_info.get('address', '')
                if isinstance(address_value, dict):
                    # Convert object format to string for prompts
                    address_parts = []
                    if address_value.get('street'):
                        address_parts.append(address_value['street'])
                    if address_value.get('city'):
                        address_parts.append(address_value['city'])
                    if address_value.get('state'):
                        address_parts.append(address_value['state'])
                    if address_value.get('zip'):
                        address_parts.append(address_value['zip'])
                    address_value = ", ".join(address_parts)
                
                persistent_data["patient"] = {
                    "name_first": patient_info.get('first_name', ''),
                    "name_last": patient_info.get('last_name', ''),
                    "dob": patient_info.get('dob', ''),
                    "address": address_value,
                    "medicare_id": patient_info.get('medicare_id', ''),
                    "ssn": patient_info.get('ssn', '')
                }
                print(f"Loaded patient data from MongoDB: {persistent_data['patient']}")
        
        # Load provider data from MongoDB if available
        try:
            if hasattr(request, 'current_user') and request.current_user:
                additional_info = request.current_user.get('additional_info', {})
                if additional_info:
                    persistent_data["provider"] = {
                        "name_first": additional_info.get('first_name', ''),
                        "name_last": additional_info.get('last_name', ''),
                        "npi": additional_info.get('npi', ''),
                        "tax_id": additional_info.get('tax_id', ''),
                        "facility_name": additional_info.get('facility_name', ''),
                        "practice_address": additional_info.get('practice_address', '')
                    }
                    print(f"Loaded provider data from MongoDB: {persistent_data['provider']}")
        except RuntimeError:
            # Handle case when called outside request context
            print("No request context available for provider data")
        
        # Fallback to file-based loading if MongoDB data not available
        if not persistent_data["patient"] and not persistent_data["provider"]:
            # Load patient data from file
            patient_file = "form_configs/personal_info/patient.txt"
            if os.path.exists(patient_file):
                with open(patient_file, 'r') as f:
                    patient_data = json.load(f)
                    persistent_data["patient"] = patient_data.get("patient", {})
                    print(f"Loaded patient data from file: {persistent_data['patient']}")
            
            # Load provider data from file
            provider_file = "form_configs/personal_info/provider.txt"
            if os.path.exists(provider_file):
                with open(provider_file, 'r') as f:
                    provider_data = json.load(f)
                    persistent_data["provider"] = provider_data.get("provider", {})
                    print(f"Loaded provider data from file: {persistent_data['provider']}")
                
    except Exception as e:
        print(f"Error loading persistent data: {e}")
    
    return persistent_data


def get_form_specific_prompt(form_type, transcript):
    """Generate form-specific prompt based on the selected form type"""
    
    # Load persistent data
    persistent_data = load_persistent_data()
    
    # Route to specific form functions
    if form_type == "tricare":
        return get_tricare_prompt(transcript, persistent_data)
    elif form_type == "cms1500":
        return get_cms1500_prompt(transcript, persistent_data)
    elif form_type == "cms1450":
        return get_cms1450_prompt(transcript, persistent_data)
    else:
        # Fallback to default Tricare prompt
        return get_default_prompt(transcript, persistent_data)


def get_tricare_prompt(transcript, persistent_data):
    """Generate Tricare-specific prompt"""
    
    # Load form configuration
    config_file = "form_configs/tricare_field_mapping.json"
    try:
        with open(config_file, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        return get_default_prompt(transcript, persistent_data)
    
    form_name = config.get('form_name', 'Tricare Medical Form')
    field_mapping = config.get('field_mapping', {})
    
    # Build field descriptions from the mapping
    field_descriptions = []
    
    if 'patient' in field_mapping:
        field_descriptions.append("Patient Information:")
        for field, pdf_field in field_mapping['patient'].items():
            field_descriptions.append(f"- {field}: {pdf_field}")
    
    if 'provider' in field_mapping:
        field_descriptions.append("\nProvider Information:")
        for field, pdf_field in field_mapping['provider'].items():
            field_descriptions.append(f"- {field}: {pdf_field}")
    
    if 'service_info' in field_mapping:
        field_descriptions.append("\nService Information:")
        for field, pdf_field in field_mapping['service_info'].items():
            field_descriptions.append(f"- {field}: {pdf_field}")
    
    if 'diagnoses' in field_mapping:
        field_descriptions.append("\nDiagnosis Fields:")
        for field, pdf_field in field_mapping['diagnoses'].items():
            field_descriptions.append(f"- {field}: {pdf_field}")
    
    if 'procedures' in field_mapping:
        field_descriptions.append("\nProcedure Fields:")
        for field, pdf_field in field_mapping['procedures'].items():
            field_descriptions.append(f"- {field}: {pdf_field}")
    
    field_descriptions_text = "\n".join(field_descriptions)
    
    # Extract medical terms from transcript for better context
    medical_terms = extract_medical_terms_from_text(transcript)
    medical_terms_text = ", ".join(medical_terms) if medical_terms else "None detected"
    
    # Build persistent data context
    persistent_context = ""
    if persistent_data.get("patient"):
        patient_info = persistent_data["patient"]
        persistent_context += f"\nPERSISTENT PATIENT INFORMATION:\n"
        persistent_context += f"- Name: {patient_info.get('name_first', '')} {patient_info.get('name_last', '')}\n"
        persistent_context += f"- Date of Birth: {patient_info.get('dob', '')}\n"
        persistent_context += f"- Address: {patient_info.get('address', '')}\n"
        persistent_context += f"- Medicare ID: {patient_info.get('medicare_id', '')}\n"
        persistent_context += f"- SSN: {patient_info.get('ssn', '')}\n"
    
    if persistent_data.get("provider"):
        provider_info = persistent_data["provider"]
        persistent_context += f"\nPERSISTENT PROVIDER INFORMATION:\n"
        persistent_context += f"- Name: Dr. {provider_info.get('name_first', '')} {provider_info.get('name_last', '')}\n"
        persistent_context += f"- NPI: {provider_info.get('npi', '')}\n"
    
    prompt = f"""You are an expert medical billing and coding assistant specializing the Tricare Certificate of Medical Necessity. 
    Your task is to analyze a clinical transcript and extract all necessary information to fill out a {form_name}.
    Your goal is to accurately identify symptoms, diagnoses, and procedures mentioned in the transcript, and map them to the appropriate fields on the Tricare form.


CRITICAL INSTRUCTIONS:
- Extract ONLY information explicitly mentioned in the transcript
- If information is not mentioned, use empty string (not "Not available" or "N/A")
- For medical codes, use standard ICD-10 and HCPCS/CPT codes. Make sure every diagnosis and procedure has a code.
- If you cannot determine a specific code, use the most applicable answer. Forms without codes are often rejected.
- For dates other than date of birth, use today's date if not specified
- For provider info, use generic placeholders if not mentioned
- IMPORTANT: Always try to extract patient name from the transcript - look for "Patient [Name]" or "[Name] presents" patterns
- If no patient name is found, look for patient info in persistent data.

DETECTED MEDICAL TERMS: 
{medical_terms_text}

PERSISTENT PATIENT/PROVIDER INFORMATION
{persistent_context}

MEDICAL CODING GUIDELINES:
- Use standard ICD-10 codes for diagnoses (e.g., J02.9 for pharyngitis, R50.9 for fever)
- Use standard HCPCS/CPT codes for procedures (e.g., 99213 for office visit, 87880 for rapid strep test)
- If uncertain about a code, leave it empty rather than guessing
- Focus on the most specific and accurate codes available

Return the data in this exact JSON structure (use empty strings for missing info):
{{
  "patient": {{
    "name": "Patient Name or empty string",
    "dob": "YYYY-MM-DD or empty string",
    "address": "Address or empty string",
    "medicare_id": "Insurance ID or empty string",
    "ssn": "SSN or empty string"
  }},
  "provider": {{
    "name": "Provider Name or empty string",
    "npi": "Provider NPI or empty string"
  }},
  "service_info": {{
    "date_of_service": "YYYY-MM-DD or empty string",
    "place_of_service": "Place of service or empty string"
  }},
  "diagnoses": [
    {{ "description": "Condition name", "code": "ICD-10 code or empty string" }}
  ],
  "procedures": [
    {{ "description": "Procedure name", "code": "CPT code or empty string", "charge": "0.00", "quantity": "1" }}
  ]
}}

Clinical Transcript:
{transcript}"""
    print("Generated tricare prompt items:")
    for line in prompt.splitlines():
        print(line)
    return prompt


def get_cms1500_prompt(transcript, persistent_data):
    """Generate CMS-1500 specific prompt"""
    
    # Load form configuration
    config_file = "form_configs/cms1500_field_mapping.json"
    try:
        with open(config_file, 'r') as f:
            config = json.load(f)
    except FileNotFoundError:
        return get_default_prompt(transcript, persistent_data)
    
    form_name = config.get('form_name', 'CMS-1500 Medical Claim Form')
    
    # Extract medical terms from transcript for better context
    medical_terms = extract_medical_terms_from_text(transcript)
    medical_terms_text = ", ".join(medical_terms) if medical_terms else "None detected"
    
    # Build persistent data context
    persistent_context = ""
    if persistent_data.get("patient"):
        patient_info = persistent_data["patient"]
        persistent_context += f"\nPERSISTENT PATIENT INFORMATION:\n"
        persistent_context += f"- Name: {patient_info.get('name_first', '')} {patient_info.get('name_last', '')}\n"
        persistent_context += f"- Date of Birth: {patient_info.get('dob', '')}\n"
        persistent_context += f"- Address: {patient_info.get('address', '')}\n"
        persistent_context += f"- Medicare ID: {patient_info.get('medicare_id', '')}\n"
        persistent_context += f"- SSN: {patient_info.get('ssn', '')}\n"
    
    if persistent_data.get("provider"):
        provider_info = persistent_data["provider"]
        persistent_context += f"\nPERSISTENT PROVIDER INFORMATION:\n"
        persistent_context += f"- Name: Dr. {provider_info.get('name_first', '')} {provider_info.get('name_last', '')}\n"
        persistent_context += f"- NPI: {provider_info.get('npi', '')}\n"
    
    prompt = f"""You are an expert medical billing and coding assistant specializing in the CMS-1500 Health Insurance Claim Form. 
    Your task is to analyze a clinical transcript and extract all necessary information to fill out a {form_name}.
    Your goal is to accurately identify symptoms, diagnoses, and procedures mentioned in the transcript, and map them to the appropriate fields on the CMS-1500 form.

CRITICAL INSTRUCTIONS:
- Extract ONLY information explicitly mentioned in the transcript and persistent data
- If information is not mentioned, use empty string (not "Not available" or "N/A")
- For medical codes, use standard ICD-10 and CPT codes
- If you cannot determine a specific code, use the closest generalization. Forms without codes are often rejected.
- For dates, use today's date if not specified
- For provider info, leave empty if not mentioned
- IMPORTANT: Always try to extract patient name from the transcript - look for "Patient [Name]" or "[Name] presents" patterns
- If no patient name is found, leave it as an empty string

DETECTED MEDICAL TERMS: {medical_terms_text}
{persistent_context}

Extract the following information for CMS-1500 form:

PATIENT INFORMATION:
- Patient's full name (pt_name)
- Patient's street address (pt_street)
- Patient's city (pt_city)
- Patient's area code (pt_AreaCode)
- Patient's phone number (pt_phone)
- Patient's state (pt_state)
- Patient's zip code (pt_zip)
- Patient's account number (pt_account)
- Patient's birth month (birth_mm)
- Patient's birth day (birth_dd)
- Patient's birth year (birth_yy)

INSURANCE INFORMATION:
- Relationship to insured (rel_to_ins)
- Insurance type (insurance_type)
- Insurance ID number (insurance_id)
- Insurance name (ins_name)
- Insurance address (ins_street)
- Insurance city (ins_city)
- Insurance state (ins_state)
- Insurance zip (ins_zip)
- Insurance phone (ins_phone)
- Insurance policy number (ins_policy)
- Insurance plan name (ins_plan_name)

SERVICE INFORMATION:
- Date of service (pt_date)

DIAGNOSIS CODES:
- Up to 12 ICD-10 diagnosis codes (diagnosis1 through diagnosis12)

PROCEDURE CODES:
- Up to 6 CPT/HCPCS codes (cpt1 through cpt6)
- Corresponding charges (ch1 through ch6)

PROVIDER INFORMATION:
- Federal Tax ID (tax_id)
- Doctor's office address (fac_name)
- Doctor's name (doc_name)

ADDITIONAL:
- Total charge (t_charge)

MEDICAL CODING GUIDELINES:
- Use standard ICD-10 codes for diagnoses (e.g., J02.9 for pharyngitis, R50.9 for fever)
- Use standard CPT codes for procedures (e.g., 99213 for office visit, 87880 for rapid strep test)
- If uncertain about a code, leave it empty rather than guessing
- Focus on the most specific and accurate codes available

Return the data in this exact JSON structure (use empty strings for missing info):
{{
  "patient": {{
    "pt_name": "Patient name or empty string",
    "pt_street": "Street address or empty string",
    "pt_city": "City or empty string",
    "pt_AreaCode": "Area code or empty string",
    "pt_phone": "Phone number or empty string",
    "pt_state": "State or empty string",
    "pt_zip": "Zip code or empty string",
    "pt_account": "Account number or empty string",
    "birth_mm": "MM or empty string",
    "birth_dd": "DD or empty string",
    "birth_yy": "YY or empty string"
  }},
  "insurance": {{
    "rel_to_ins": "Relationship to insured or empty string",
    "insurance_type": "Insurance type or empty string",
    "insurance_id": "Insurance ID or empty string",
    "ins_name": "Insurance name or empty string",
    "ins_street": "Insurance street or empty string",
    "ins_city": "Insurance city or empty string",
    "ins_state": "Insurance state or empty string",
    "ins_zip": "Insurance zip or empty string",
    "ins_phone": "Insurance phone or empty string",
    "ins_policy": "Policy number or empty string",
    "ins_plan_name": "Plan name or empty string"
  }},
  "service_info": {{
    "pt_date": "YYYY-MM-DD or empty string"
  }},
  "diagnoses": {{
    "diagnosis1": "ICD-10 code or empty string",
    "diagnosis2": "ICD-10 code or empty string",
    "diagnosis3": "ICD-10 code or empty string",
    "diagnosis4": "ICD-10 code or empty string",
    "diagnosis5": "ICD-10 code or empty string",
    "diagnosis6": "ICD-10 code or empty string",
    "diagnosis7": "ICD-10 code or empty string",
    "diagnosis8": "ICD-10 code or empty string",
    "diagnosis9": "ICD-10 code or empty string",
    "diagnosis10": "ICD-10 code or empty string",
    "diagnosis11": "ICD-10 code or empty string",
    "diagnosis12": "ICD-10 code or empty string"
  }},
  "procedures": {{
    "cpt1": "CPT code or empty string",
    "cpt2": "CPT code or empty string",
    "cpt3": "CPT code or empty string",
    "cpt4": "CPT code or empty string",
    "cpt5": "CPT code or empty string",
    "cpt6": "CPT code or empty string",
    "ch1": "Charge amount or empty string",
    "ch2": "Charge amount or empty string",
    "ch3": "Charge amount or empty string",
    "ch4": "Charge amount or empty string",
    "ch5": "Charge amount or empty string",
    "ch6": "Charge amount or empty string"
  }},
  "provider": {{
    "tax_id": "Tax ID or empty string",
    "fac_name": "Facility name or empty string",
    "doc_name": "Doctor name or empty string"
  }},
  "additional": {{
    "t_charge": "Total charge or empty string"
  }}
}}

Clinical Transcript:
{transcript}"""
    
    return prompt


def get_cms1450_prompt(transcript, persistent_data):
    """Generate CMS-1450 specific prompt (same as CMS-1500 for now)"""
    return get_cms1500_prompt(transcript, persistent_data)

def get_default_prompt(transcript, persistent_data=None):
    """Fallback prompt for Tricare form"""
    if persistent_data is None:
        persistent_data = load_persistent_data()
    
    # Extract medical terms from transcript for better context
    medical_terms = extract_medical_terms_from_text(transcript)
    medical_terms_text = ", ".join(medical_terms) if medical_terms else "None detected"
    
    # Build persistent data context
    persistent_context = ""
    if persistent_data.get("patient"):
        patient_info = persistent_data["patient"]
        persistent_context += f"\nPERSISTENT PATIENT INFORMATION:\n"
        persistent_context += f"- Name: {patient_info.get('name_first', '')} {patient_info.get('name_last', '')}\n"
        persistent_context += f"- Date of Birth: {patient_info.get('dob', '')}\n"
        persistent_context += f"- Address: {patient_info.get('address', '')}\n"
        persistent_context += f"- Medicare ID: {patient_info.get('medicare_id', '')}\n"
        persistent_context += f"- SSN: {patient_info.get('ssn', '')}\n"
    
    if persistent_data.get("provider"):
        provider_info = persistent_data["provider"]
        persistent_context += f"\nPERSISTENT PROVIDER INFORMATION:\n"
        persistent_context += f"- Name: Dr. {provider_info.get('name_first', '')} {provider_info.get('name_last', '')}\n"
        persistent_context += f"- NPI: {provider_info.get('npi', '')}\n"
    
    return f"""You are an expert medical billing and coding assistant. 
    Your task is to analyze a clinical transcript and extract all necessary information to fill out a medical claim form.
    Your goal is to accurately identify symptoms, diagnoses, and procedures mentioned in the transcript, and map them to the appropriate fields on the form.


CRITICAL INSTRUCTIONS:
- Extract ONLY information explicitly mentioned in the transcript
- If information is not mentioned, use empty string (not "Not available" or "N/A")
- For medical codes, use standard ICD-10 and CPT codes
- If you cannot determine a specific code, use the closest generalization. Forms without codes are often rejected.
- For dates, use today's date if not specified
- For provider info, leave empty if not mentioned
- IMPORTANT: Always try to extract patient name from the transcript - look for "Patient [Name]" or "[Name] presents" patterns
- If no patient name is found, leave it as an empty string

DETECTED MEDICAL TERMS: {medical_terms_text}
{persistent_context}

Extract the following information:
- Patient name, date of birth, address, and insurance information
- Provider name and NPI number
- Date of service and place of service
- All diagnoses with their ICD-10 codes
- All procedures with their CPT codes and charges

MEDICAL CODING GUIDELINES:
- Use standard ICD-10 codes for diagnoses (e.g., J02.9 for pharyngitis, R50.9 for fever)
- Use standard CPT codes for procedures (e.g., 99213 for office visit, 87880 for rapid strep test)
- If uncertain about a code, leave it empty rather than guessing
- Focus on the most specific and accurate codes available

Return the data in this exact JSON structure (use empty strings for missing info):
{{
  "patient": {{
    "name": "Patient name or empty string",
    "dob": "YYYY-MM-DD or empty string",
    "address": "Address or empty string",
    "medicare_id": "Insurance ID or empty string",
    "ssn": "SSN or empty string"
  }},
  "provider": {{
    "name": "Provider name or empty string",
    "npi": "Provider NPI or empty string"
  }},
  "service_info": {{
    "date_of_service": "YYYY-MM-DD or empty string",
    "place_of_service": "Place of service or empty string"
  }},
  "diagnoses": [
    {{ "description": "Condition name", "code": "ICD-10 code or empty string" }}
  ],
  "procedures": [
    {{ "description": "Procedure name", "code": "CPT code or empty string", "charge": "0.00", "quantity": "1" }}
  ]
}}

Clinical Transcript:
{transcript}"""


def enhance_medical_codes(structured_data, transcript):
    """
    Enhance medical codes in the structured data using the fallback lookup system.
    This ensures we have medical codes even if Gemini didn't provide them.
    """
    try:
        # Enhance diagnoses if they're missing codes or empty
        if "diagnoses" in structured_data:
            existing_diagnoses = structured_data["diagnoses"]
            if not existing_diagnoses or all(not d.get("code") for d in existing_diagnoses):
                # Use fallback diagnoses
                structured_data["diagnoses"] = fallback_codes["diagnoses"]
                print("Enhanced diagnoses with fallback codes:", fallback_codes["diagnoses"])
            else:
                # Fill in missing codes for existing diagnoses
                for diagnosis in structured_data["diagnoses"]:
                    if not diagnosis.get("code") and diagnosis.get("description"):
                        # Try to find a matching code
                        description = diagnosis["description"].lower()
                        for fallback_diag in fallback_codes["diagnoses"]:
                            if description in fallback_diag["description"].lower() or fallback_diag["description"].lower() in description:
                                diagnosis["code"] = fallback_diag["code"]
                                print(f"Enhanced diagnosis '{diagnosis['description']}' with code {fallback_diag['code']}")
                                break
        
        # Enhance procedures if they're missing codes or empty
        if "procedures" in structured_data:
            existing_procedures = structured_data["procedures"]
            if not existing_procedures or all(not p.get("code") for p in existing_procedures):
                # Use fallback procedures
                structured_data["procedures"] = fallback_codes["procedures"]
                print("Enhanced procedures with fallback codes:", fallback_codes["procedures"])
            else:
                # Fill in missing codes for existing procedures
                for procedure in structured_data["procedures"]:
                    if not procedure.get("code") and procedure.get("description"):
                        # Try to find a matching code
                        description = procedure["description"].lower()
                        for fallback_proc in fallback_codes["procedures"]:
                            if description in fallback_proc["description"].lower() or fallback_proc["description"].lower() in description:
                                procedure["code"] = fallback_proc["code"]
                                print(f"Enhanced procedure '{procedure['description']}' with code {fallback_proc['code']}")
                                break
        
        print("Enhanced structured data with medical codes")
        return structured_data
        
    except Exception as e:
        print(f"Error enhancing medical codes: {e}")
        return structured_data


def fix_common_data_issues(structured_data):
    """
    Fix common data issues that occur with Gemini responses.
    """
    try:
        # Load persistent data for defaults
        persistent_data = load_persistent_data()
        
        # Fix patient name if empty - use persistent data or leave empty
        if (structured_data.get("patient", {}).get("name") == "" or 
            not structured_data.get("patient", {}).get("name")):
            if "patient" not in structured_data:
                structured_data["patient"] = {}
            
            # Use persistent data if available
            if persistent_data.get("patient", {}).get("name_first") and persistent_data.get("patient", {}).get("name_last"):
                structured_data["patient"]["name"] = f"{persistent_data['patient']['name_first']} {persistent_data['patient']['name_last']}"
                print(f"Fixed empty patient name with persistent data: {structured_data['patient']['name']}")
            else:
                structured_data["patient"]["name"] = ""
                print("Left patient name empty as no data available")
        
        # Fix provider name if empty
        if (structured_data.get("provider", {}).get("name") == "" or 
            not structured_data.get("provider", {}).get("name")):
            if "provider" not in structured_data:
                structured_data["provider"] = {}
            
            # Use persistent data if available
            if persistent_data.get("provider", {}).get("name_first") and persistent_data.get("provider", {}).get("name_last"):
                structured_data["provider"]["name"] = f"Dr. {persistent_data['provider']['name_first']} {persistent_data['provider']['name_last']}"
                print(f"Fixed empty provider name with persistent data: {structured_data['provider']['name']}")
            else:
                structured_data["provider"]["name"] = ""
                print("Left provider name empty as no data available")
        
        # Fix provider NPI if empty
        if (structured_data.get("provider", {}).get("npi") == "" or 
            not structured_data.get("provider", {}).get("npi")):
            if "provider" not in structured_data:
                structured_data["provider"] = {}
            
            # Use persistent data if available
            if persistent_data.get("provider", {}).get("npi"):
                structured_data["provider"]["npi"] = persistent_data["provider"]["npi"]
                print(f"Fixed empty provider NPI with persistent data: {structured_data['provider']['npi']}")
            else:
                structured_data["provider"]["npi"] = ""
                print("Left provider NPI empty as no data available")
        
        # Fix service info dates - use today's date
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        if "service_info" not in structured_data:
            structured_data["service_info"] = {}
        structured_data["service_info"]["date_of_service"] = today
        
        # Add start_date and end_date to additional fields
        if "additional" not in structured_data:
            structured_data["additional"] = {}
        structured_data["additional"]["start_date"] = today
        structured_data["additional"]["end_date"] = today
        structured_data["additional"]["authorization_date"] = today
        print(f"Fixed date fields with today's date: {today}")
        
        # Fix place of service if empty
        if (structured_data.get("service_info", {}).get("place_of_service") == "" or 
            not structured_data.get("service_info", {}).get("place_of_service")):
            if "service_info" not in structured_data:
                structured_data["service_info"] = {}
            structured_data["service_info"]["place_of_service"] = ""
            print("Left place of service empty as no data available")
        
        # Fill in additional patient data from persistent storage
        if persistent_data.get("patient"):
            patient_info = persistent_data["patient"]
            if "patient" not in structured_data:
                structured_data["patient"] = {}
            
            # Fill in missing patient data
            if not structured_data["patient"].get("dob") and patient_info.get("dob"):
                structured_data["patient"]["dob"] = patient_info["dob"]
                print(f"Added patient DOB from persistent data: {patient_info['dob']}")
            
            if not structured_data["patient"].get("address") and patient_info.get("address"):
                structured_data["patient"]["address"] = patient_info["address"]
                print(f"Added patient address from persistent data: {patient_info['address']}")
            
            if not structured_data["patient"].get("medicare_id") and patient_info.get("medicare_id"):
                structured_data["patient"]["medicare_id"] = patient_info["medicare_id"]
                print(f"Added patient Medicare ID from persistent data: {patient_info['medicare_id']}")
            
            if not structured_data["patient"].get("ssn") and patient_info.get("ssn"):
                structured_data["patient"]["ssn"] = patient_info["ssn"]
                print(f"Added patient SSN from persistent data: {patient_info['ssn']}")
        
        # Add cost estimation and doctor's visit
        structured_data = add_cost_estimation_and_doctor_visit(structured_data)
        
        print("Fixed common data issues")
        return structured_data
        
    except Exception as e:
        print(f"Error fixing common data issues: {e}")
        return structured_data


def add_cost_estimation_and_doctor_visit(structured_data):
    """
    Add realistic cost estimates for procedures and ensure there's a doctor's visit.
    """
    try:
        # Cost database for common procedures
        cost_database = {
            # Office visits
            "99213": 150.00,  # Established patient office visit
            "99214": 200.00,  # Level 4 office visit
            "99215": 250.00,  # Level 5 office visit
            "99202": 180.00,  # New patient office visit
            "99212": 100.00,  # Brief office visit
            
            # Laboratory tests
            "87880": 35.00,   # Rapid strep test
            "87081": 25.00,   # Throat culture
            "81001": 15.00,   # Urinalysis
            "85025": 20.00,   # Complete blood count
            "36415": 30.00,   # Blood test
            
            # Imaging
            "71020": 80.00,   # Chest X-ray
            "73060": 60.00,   # X-ray
            "93000": 25.00,   # EKG
            
            # Procedures
            "96372": 15.00,   # Injection
            "90471": 20.00,   # Vaccination
            "12001": 50.00,   # Suturing
            "29125": 40.00,   # Splinting
        }
        
        # Ensure we have procedures
        if "procedures" not in structured_data:
            structured_data["procedures"] = []
        
        # Add doctor's visit if not present
        has_doctor_visit = any(proc.get("code") in ["99213", "99214", "99215", "99202", "99212"] 
                              for proc in structured_data["procedures"])
        
        if not has_doctor_visit and structured_data["procedures"]:
            # Add a doctor's visit as the first procedure
            doctor_visit = {
                "description": "Office visit for evaluation and management",
                "code": "99213",
                "charge": "0.00",  # Will be updated below
                "quantity": "1"
            }
            structured_data["procedures"].insert(0, doctor_visit)
            print("Added doctor's visit (99213) to procedures")
        
        # Update costs for all procedures
        for procedure in structured_data["procedures"]:
            if procedure.get("code") and procedure.get("charge") == "0.00":
                code = procedure["code"]
                if code in cost_database:
                    procedure["charge"] = f"{cost_database[code]:.2f}"
                    print(f"Updated cost for {code} to ${procedure['charge']}")
                else:
                    # Default cost based on procedure type
                    if code.startswith("99"):  # Office visits
                        procedure["charge"] = "150.00"
                    elif code.startswith("87"):  # Lab tests
                        procedure["charge"] = "30.00"
                    elif code.startswith("71"):  # Imaging
                        procedure["charge"] = "80.00"
                    else:
                        procedure["charge"] = "50.00"
                    print(f"Set default cost for {code} to ${procedure['charge']}")
        
        print("Added cost estimation and doctor's visit")
        return structured_data
        
    except Exception as e:
        print(f"Error adding cost estimation: {e}")
        return structured_data


def fix_form_specific_data_issues(structured_data, form_type):
    """
    Fix data issues based on the specific form type.
    """
    if form_type == "tricare":
        return fix_tricare_data_issues(structured_data)
    elif form_type in ["cms1500", "cms1450"]:
        return fix_cms_data_issues(structured_data)
    else:
        return fix_common_data_issues(structured_data)


def _validate_form_data(structured_data: dict, form_type: str) -> dict:
    """
    Validate form data and return validation results.
    """
    errors = []
    recommendations = []
    is_valid = True
    
    # Check required fields
    required_fields = {
        "patient": ["name"],
        "provider": ["name"],
        "diagnoses": [],
        "procedures": []
    }
    
    for section, fields in required_fields.items():
        if section not in structured_data:
            errors.append(f"Missing {section} section")
            is_valid = False
        else:
            for field in fields:
                if field not in structured_data[section] or not structured_data[section][field]:
                    errors.append(f"Missing {section}.{field}")
                    is_valid = False
    
    # Check diagnosis codes
    if "diagnoses" in structured_data and structured_data["diagnoses"]:
        for i, diagnosis in enumerate(structured_data["diagnoses"]):
            if not diagnosis.get("code"):
                errors.append(f"Diagnosis {i+1} missing code")
                is_valid = False
            elif not diagnosis.get("description"):
                recommendations.append(f"Consider adding description for diagnosis {diagnosis.get('code')}")
    
    # Check procedure codes
    if "procedures" in structured_data and structured_data["procedures"]:
        for i, procedure in enumerate(structured_data["procedures"]):
            if not procedure.get("code"):
                errors.append(f"Procedure {i+1} missing code")
                is_valid = False
            elif not procedure.get("description"):
                recommendations.append(f"Consider adding description for procedure {procedure.get('code')}")
    
    # Form-specific validation
    if form_type == "cms1500":
        if not structured_data.get("date_of_service"):
            errors.append("Missing date of service")
            is_valid = False
    
    elif form_type == "tricare":
        if not structured_data.get("equipment_justification"):
            recommendations.append("Consider adding equipment justification for TRICARE")
    
    return {
        "is_valid": is_valid,
        "errors": errors,
        "recommendations": recommendations
    }


def fix_tricare_data_issues(structured_data):
    """
    Fix data issues specific to Tricare forms.
    """
    try:
        # Load persistent data for defaults
        persistent_data = load_persistent_data()
        
        # Fix patient name if empty - use persistent data or default
        if (structured_data.get("patient", {}).get("name") == "" or 
            not structured_data.get("patient", {}).get("name")):
            if "patient" not in structured_data:
                structured_data["patient"] = {}
            
            # Use persistent data if available
            if persistent_data.get("patient", {}).get("name_first") and persistent_data.get("patient", {}).get("name_last"):
                structured_data["patient"]["name"] = f"{persistent_data['patient']['name_first']} {persistent_data['patient']['name_last']}"
                print(f"Fixed empty patient name with persistent data: {structured_data['patient']['name']}")
            else:
                structured_data["patient"]["name"] = ""
                print("Left patient name empty as no data available")
        
        # Fix provider name if empty
        if (structured_data.get("provider", {}).get("name") == "" or 
            not structured_data.get("provider", {}).get("name")):
            if "provider" not in structured_data:
                structured_data["provider"] = {}
            
            # Use persistent data if available
            if persistent_data.get("provider", {}).get("name_first") and persistent_data.get("provider", {}).get("name_last"):
                structured_data["provider"]["name"] = f"Dr. {persistent_data['provider']['name_first']} {persistent_data['provider']['name_last']}"
                print(f"Fixed empty provider name with persistent data: {structured_data['provider']['name']}")
            else:
                structured_data["provider"]["name"] = ""
                print("Left provider name empty as no data available")
        
        # Fix provider NPI if empty
        if (structured_data.get("provider", {}).get("npi") == "" or 
            not structured_data.get("provider", {}).get("npi")):
            if "provider" not in structured_data:
                structured_data["provider"] = {}
            
            # Use persistent data if available
            if persistent_data.get("provider", {}).get("npi"):
                structured_data["provider"]["npi"] = persistent_data["provider"]["npi"]
                print(f"Fixed empty provider NPI with persistent data: {structured_data['provider']['npi']}")
            else:
                structured_data["provider"]["npi"] = ""
                print("Left provider NPI empty as no data available")
        
        # Fix service info dates - use today's date
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        if "service_info" not in structured_data:
            structured_data["service_info"] = {}
        structured_data["service_info"]["date_of_service"] = today
        
        # Add start_date and end_date to additional fields
        if "additional" not in structured_data:
            structured_data["additional"] = {}
        structured_data["additional"]["start_date"] = today
        structured_data["additional"]["end_date"] = today
        structured_data["additional"]["authorization_date"] = today
        print(f"Fixed date fields with today's date: {today}")
        
        # Fix place of service if empty
        if (structured_data.get("service_info", {}).get("place_of_service") == "" or 
            not structured_data.get("service_info", {}).get("place_of_service")):
            if "service_info" not in structured_data:
                structured_data["service_info"] = {}
            structured_data["service_info"]["place_of_service"] = ""
            print("Left place of service empty as no data available")
        
        # Fill in additional patient data from persistent storage
        if persistent_data.get("patient"):
            patient_info = persistent_data["patient"]
            if "patient" not in structured_data:
                structured_data["patient"] = {}
            
            # Fill in missing patient data
            if not structured_data["patient"].get("dob") and patient_info.get("dob"):
                structured_data["patient"]["dob"] = patient_info["dob"]
                print(f"Added patient DOB from persistent data: {patient_info['dob']}")
            
            if not structured_data["patient"].get("address") and patient_info.get("address"):
                structured_data["patient"]["address"] = patient_info["address"]
                print(f"Added patient address from persistent data: {patient_info['address']}")
            
            if not structured_data["patient"].get("medicare_id") and patient_info.get("medicare_id"):
                structured_data["patient"]["medicare_id"] = patient_info["medicare_id"]
                print(f"Added patient Medicare ID from persistent data: {patient_info['medicare_id']}")
            
            if not structured_data["patient"].get("ssn") and patient_info.get("ssn"):
                structured_data["patient"]["ssn"] = patient_info["ssn"]
                print(f"Added patient SSN from persistent data: {patient_info['ssn']}")
        
        # Add cost estimation and doctor's visit
        structured_data = add_cost_estimation_and_doctor_visit(structured_data)
        
        print("Fixed Tricare data issues")
        return structured_data
        
    except Exception as e:
        print(f"Error fixing Tricare data issues: {e}")
        return structured_data


def fix_cms_data_issues(structured_data):
    """
    Fix data issues specific to CMS-1500/CMS-1450 forms.
    """
    try:
        # Load persistent data for defaults
        persistent_data = load_persistent_data()
        
        # Fix patient information
        if "patient" not in structured_data:
            structured_data["patient"] = {}
        
        # Use persistent data for patient info
        if persistent_data.get("patient"):
            patient_info = persistent_data["patient"]
            
            # Fix patient name
            if not structured_data["patient"].get("pt_name"):
                if patient_info.get("name_first") and patient_info.get("name_last"):
                    structured_data["patient"]["pt_name"] = f"{patient_info['name_first']} {patient_info['name_last']}"
                    print(f"Fixed patient name with persistent data: {structured_data['patient']['pt_name']}")
                else:
                    structured_data["patient"]["pt_name"] = ""
            
            # Fix patient address
            if not structured_data["patient"].get("pt_street") and patient_info.get("address"):
                # Parse address into components
                address_parts = patient_info["address"].split(", ")
                if len(address_parts) >= 2:
                    structured_data["patient"]["pt_street"] = address_parts[0]
                    city_state_zip = address_parts[1].split(" ")
                    if len(city_state_zip) >= 3:
                        structured_data["patient"]["pt_city"] = city_state_zip[0]
                        structured_data["patient"]["pt_state"] = city_state_zip[1]
                        structured_data["patient"]["pt_zip"] = city_state_zip[2]
                    print(f"Added patient address from persistent data")
            
            # Fix patient DOB
            if not structured_data["patient"].get("birth_mm") and patient_info.get("dob"):
                try:
                    from datetime import datetime
                    dob = datetime.strptime(patient_info["dob"], "%Y-%m-%d")
                    structured_data["patient"]["birth_mm"] = f"{dob.month:02d}"
                    structured_data["patient"]["birth_dd"] = f"{dob.day:02d}"
                    structured_data["patient"]["birth_yy"] = f"{dob.year % 100:02d}"
                    print(f"Added patient DOB from persistent data: {patient_info['dob']}")
                except:
                    pass
            
            # Fix patient SSN
            if not structured_data["patient"].get("pt_account") and patient_info.get("ssn"):
                structured_data["patient"]["pt_account"] = patient_info["ssn"]
                print(f"Added patient account from persistent data")
        
        # Fix insurance information
        if "insurance" not in structured_data:
            structured_data["insurance"] = {}
        
        # Set default insurance values for CMS-1500
        if not structured_data["insurance"].get("rel_to_ins"):
            structured_data["insurance"]["rel_to_ins"] = ""
        if not structured_data["insurance"].get("insurance_type"):
            structured_data["insurance"]["insurance_type"] = ""
        if not structured_data["insurance"].get("insurance_id") and persistent_data.get("patient", {}).get("medicare_id"):
            structured_data["insurance"]["insurance_id"] = persistent_data["patient"]["medicare_id"]
        
        # Set insurer information same as patient information
        if persistent_data.get("patient"):
            patient_info = persistent_data["patient"]
            
            # Set insurer name same as patient name
            if not structured_data["insurance"].get("ins_name"):
                if patient_info.get("name_first") and patient_info.get("name_last"):
                    structured_data["insurance"]["ins_name"] = f"{patient_info['name_last']}, {patient_info['name_first']}"
                    print(f"Set insurer name same as patient: {structured_data['insurance']['ins_name']}")
            
            # Set insurer address same as patient address
            if not structured_data["insurance"].get("ins_street") and patient_info.get("address"):
                address_parts = patient_info["address"].split(", ")
                if len(address_parts) >= 2:
                    structured_data["insurance"]["ins_street"] = address_parts[0]
                    city_state_zip = address_parts[1].split(" ")
                    if len(city_state_zip) >= 3:
                        structured_data["insurance"]["ins_city"] = city_state_zip[0]
                        structured_data["insurance"]["ins_state"] = city_state_zip[1]
                        structured_data["insurance"]["ins_zip"] = city_state_zip[2]
                    print(f"Set insurer address same as patient address")
            
            # Set insurer phone same as patient phone
            if not structured_data["insurance"].get("ins_phone") and patient_info.get("phone"):
                structured_data["insurance"]["ins_phone"] = patient_info["phone"]
                print(f"Set insurer phone same as patient phone")
        
        # Set default values if not available - leave empty instead of arbitrary defaults
        if not structured_data["insurance"].get("ins_name"):
            structured_data["insurance"]["ins_name"] = ""
        if not structured_data["insurance"].get("ins_street"):
            structured_data["insurance"]["ins_street"] = ""
        if not structured_data["insurance"].get("ins_city"):
            structured_data["insurance"]["ins_city"] = ""
        if not structured_data["insurance"].get("ins_state"):
            structured_data["insurance"]["ins_state"] = ""
        if not structured_data["insurance"].get("ins_zip"):
            structured_data["insurance"]["ins_zip"] = ""
        if not structured_data["insurance"].get("ins_phone"):
            structured_data["insurance"]["ins_phone"] = ""
        
        # Fix provider information
        if "provider" not in structured_data:
            structured_data["provider"] = {}
        
        if persistent_data.get("provider"):
            provider_info = persistent_data["provider"]
            
            if not structured_data["provider"].get("doc_name"):
                if provider_info.get("name_first") and provider_info.get("name_last"):
                    structured_data["provider"]["doc_name"] = f"Dr. {provider_info['name_first']} {provider_info['name_last']}"
                    print(f"Fixed provider name with persistent data: {structured_data['provider']['doc_name']}")
                else:
                    structured_data["provider"]["doc_name"] = ""
            
            if not structured_data["provider"].get("tax_id") and provider_info.get("tax_id"):
                structured_data["provider"]["tax_id"] = provider_info["tax_id"]
                print(f"Added provider tax ID from persistent data: {provider_info['tax_id']}")
            elif not structured_data["provider"].get("tax_id"):
                structured_data["provider"]["tax_id"] = ""
                print("Left tax ID empty as no data available")
            
            if not structured_data["provider"].get("fac_name") and provider_info.get("facility_name"):
                structured_data["provider"]["fac_name"] = provider_info["facility_name"]
                print(f"Added facility name from persistent data: {provider_info['facility_name']}")
            elif not structured_data["provider"].get("fac_name") and provider_info.get("practice_address"):
                structured_data["provider"]["fac_name"] = provider_info["practice_address"]
                print(f"Added practice address as facility name from persistent data")
            elif not structured_data["provider"].get("fac_name"):
                structured_data["provider"]["fac_name"] = ""
        
        # Fix service info dates - use today's date
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        if "service_info" not in structured_data:
            structured_data["service_info"] = {}
        structured_data["service_info"]["pt_date"] = today
        print(f"Fixed service date with today's date: {today}")
        
        # Add cost estimation and doctor's visit BEFORE converting to dictionary format
        structured_data = add_cost_estimation_and_doctor_visit(structured_data)
        
        # Convert diagnoses array to individual fields
        if "diagnoses" in structured_data and isinstance(structured_data["diagnoses"], list):
            diagnoses_dict = {}
            for i, diagnosis in enumerate(structured_data["diagnoses"][:12], 1):
                if diagnosis.get("code"):
                    diagnoses_dict[f"diagnosis{i}"] = diagnosis["code"]
            structured_data["diagnoses"] = diagnoses_dict
            print(f"Converted diagnoses array to individual fields: {len(diagnoses_dict)} diagnoses")
        
        # Convert procedures array to individual fields
        if "procedures" in structured_data and isinstance(structured_data["procedures"], list):
            procedures_dict = {}
            charges_dict = {}
            for i, procedure in enumerate(structured_data["procedures"][:6], 1):
                if procedure.get("code"):
                    procedures_dict[f"cpt{i}"] = procedure["code"]
                if procedure.get("charge"):
                    charges_dict[f"ch{i}"] = procedure["charge"]
            structured_data["procedures"] = {**procedures_dict, **charges_dict}
            print(f"Converted procedures array to individual fields: {len(procedures_dict)} procedures")
        
        # Calculate total charge
        if "additional" not in structured_data:
            structured_data["additional"] = {}
        
        total_charge = 0
        for i in range(1, 7):
            charge_key = f"ch{i}"
            if charge_key in structured_data.get("procedures", {}):
                try:
                    charge = float(structured_data["procedures"][charge_key])
                    total_charge += charge
                except:
                    pass
        
        if total_charge > 0:
            structured_data["additional"]["t_charge"] = f"{total_charge:.2f}"
            print(f"Calculated total charge: ${total_charge:.2f}")
        
        print("Fixed CMS data issues")
        return structured_data
        
    except Exception as e:
        print(f"Error fixing CMS data issues: {e}")
        return structured_data

# Authentication Routes
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        
        if not username or not password:
            flash("Please provide both username and password", "error")
            return render_template("login.html")
        
        user = db.verify_doctor(username, password)
        if user:
            session_token = db.create_session(str(user["_id"]))
            response = make_response(redirect(url_for('select_patient')))  # Redirect to patient selection
            response.set_cookie('session_token', session_token, max_age=7*24*60*60)  # 7 days
            flash(f"Welcome back, Dr. {user['username']}!", "success")
            return response
        else:
            flash("Invalid username or password", "error")
    
    return render_template("login.html")

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form.get("username")
        email = request.form.get("email")
        password = request.form.get("password")
        confirm_password = request.form.get("confirm_password")
        
        # Validation
        if not all([username, email, password, confirm_password]):
            flash("Please fill in all fields", "error")
            return render_template("signup.html")
        
        if password != confirm_password:
            flash("Passwords do not match", "error")
            return render_template("signup.html")
        
        if len(password) < 6:
            flash("Password must be at least 6 characters long", "error")
            return render_template("signup.html")
        
        # Try to create doctor
        user_id = db.create_doctor(username, email, password)
        if user_id:
            session_token = db.create_session(user_id)
            response = make_response(redirect(url_for('dashboard')))  # Redirect to dashboard for provider setup
            response.set_cookie('session_token', session_token, max_age=7*24*60*60)  # 7 days
            flash(f"Welcome to MedRelay, Dr. {username}! Please complete your provider information below.", "success")
            return response
        else:
            flash("Username or email already exists", "error")
    
    return render_template("signup.html")

@app.route("/logout")
def logout():
    session_token = request.cookies.get('session_token')
    if session_token:
        db.delete_session(session_token)
    
    response = make_response(redirect(url_for('login')))
    response.set_cookie('session_token', '', expires=0)
    flash("You have been logged out", "info")
    return response

@app.route("/")
def index():
    """Main index route - shows landing page for unauthenticated users, index.html for authenticated users"""
    session_token = request.cookies.get('session_token')
    if not session_token:
        return render_template("landing.html")
    
    session_info = db.get_session_info(session_token)
    if not session_info or not session_info['doctor']:
        return render_template("landing.html")
    
    # User is authenticated, render index.html
    return render_template("index.html", user=session_info['doctor'])

@app.route("/landing")
def landing():
    """Landing page for new visitors"""
    return render_template("landing.html")

@app.route("/app")
@patient_required
def app_index():
    """Protected app index for authenticated users with selected patient"""
    return render_template("index.html", user=request.current_user, selected_patient=request.selected_patient)

# Patient Selection Routes
@app.route("/select-patient")
@login_required
def select_patient():
    """Patient selection page"""
    doctor_id = str(request.current_user["_id"])
    patients = db.get_doctor_patients(doctor_id)
    
    return render_template("select_patient.html", 
                         user=request.current_user,
                         patients=patients)

@app.route("/api/search-patients")
@login_required
def search_patients_api():
    """API endpoint for patient search autocomplete"""
    search_term = request.args.get('q', '')
    doctor_id = str(request.current_user["_id"])
    
    patients = db.search_patients(doctor_id, search_term, limit=10)
    
    # Format for autocomplete
    results = []
    for patient in patients:
        patient_info = patient.get('patient_info', {})
        name = patient_info.get('full_name') or f"{patient_info.get('first_name', '')} {patient_info.get('last_name', '')}".strip()
        if not name:
            name = patient_info.get('name', 'Unknown Patient')
        
        results.append({
            'id': str(patient['_id']),
            'name': name,
            'info': patient_info
        })
    
    return jsonify(results)

@app.route("/switch-patient/<patient_id>")
@login_required
def switch_patient(patient_id):
    """Switch to a different patient"""
    # Verify this patient belongs to the current doctor
    patient = db.get_patient(patient_id)
    if not patient or str(patient['doctor_id']) != str(request.current_user['_id']):
        flash("Patient not found or access denied", "error")
        return redirect(url_for('select_patient'))
    
    # Update session with selected patient
    success = db.update_session_patient(request.session_token, patient_id)
    if success:
        patient_name = patient.get('patient_info', {}).get('full_name') or patient.get('patient_info', {}).get('name', 'Patient')
        flash(f"Switched to patient: {patient_name}", "success")
        return redirect(url_for('index'))
    else:
        flash("Failed to switch patient", "error")
        return redirect(url_for('select_patient'))

@app.route("/add-demo-patient")
@login_required
def add_demo_patient():
    """Add a demo patient for testing"""
    doctor_id = str(request.current_user["_id"])
    
    # Create demo patient info
    demo_patient_info = {
        "full_name": "John Demo Patient",
        "first_name": "John",
        "last_name": "Patient",
        "date_of_birth": "1980-05-15",
        "phone": "(555) 123-4567",
        "email": "john.demo@example.com",
        "insurance": {
            "provider": "Demo Insurance",
            "policy_number": "DEMO123456",
            "group_number": "GRP001"
        },
        "address": {
            "street": "123 Demo St",
            "city": "Demo City",
            "state": "CA",
            "zip": "12345"
        }
    }
    
    patient_id = db.add_patient(doctor_id, demo_patient_info)
    if patient_id:
        flash("Demo patient added successfully!", "success")
    else:
        flash("Failed to add demo patient", "error")
    
    return redirect(url_for('select_patient'))

@app.route("/add-patient", methods=["GET", "POST"])
@login_required
def add_patient():
    """Add a new patient"""
    if request.method == "POST":
        doctor_id = str(request.current_user["_id"])
        
        # Get form data
        first_name = request.form.get("first_name", "").strip()
        last_name = request.form.get("last_name", "").strip()
        date_of_birth = request.form.get("date_of_birth", "").strip()
        phone = request.form.get("phone", "").strip()
        email = request.form.get("email", "").strip()
        ssn = request.form.get("ssn", "").strip()
        medicare_id = request.form.get("medicare_id", "").strip()
        
        # Insurance info
        insurance_provider = request.form.get("insurance_provider", "").strip()
        policy_number = request.form.get("policy_number", "").strip()
        group_number = request.form.get("group_number", "").strip()
        
        # Address info
        street = request.form.get("street", "").strip()
        city = request.form.get("city", "").strip()
        state = request.form.get("state", "").strip()
        zip_code = request.form.get("zip_code", "").strip()
        
        # Emergency contact
        emergency_name = request.form.get("emergency_name", "").strip()
        emergency_relationship = request.form.get("emergency_relationship", "").strip()
        emergency_phone = request.form.get("emergency_phone", "").strip()
        
        # Validation
        if not first_name or not last_name:
            flash("First name and last name are required", "error")
            return render_template("add_patient.html", user=request.current_user)
        
        # Create patient info object
        patient_info = {
            "first_name": first_name,
            "last_name": last_name,
            "full_name": f"{first_name} {last_name}",
            "dob": date_of_birth if date_of_birth else "",  # Fixed: use 'dob' instead of 'date_of_birth'
            "date_of_birth": date_of_birth if date_of_birth else None,  # Keep for backwards compatibility
            "phone": phone if phone else None,
            "email": email if email else None,
            "ssn": ssn if ssn else "",  # Added SSN field
            "medicare_id": medicare_id if medicare_id else "",  # Added Medicare ID field
        }
        
        # Add insurance if provided
        if insurance_provider or policy_number:
            patient_info["insurance"] = {
                "provider": insurance_provider,
                "policy_number": policy_number,
                "group_number": group_number
            }
        
        # Add state field directly to patient_info if provided
        if state:
            patient_info["state"] = state
        
        # Add address if provided
        if street or city or zip_code:
            # Create address string for prompts and address object for other uses
            address_parts = []
            if street:
                address_parts.append(street)
            if city:
                address_parts.append(city)
            if state:
                address_parts.append(state)
            if zip_code:
                address_parts.append(zip_code)
            
            address_string = ", ".join(address_parts)
            
            patient_info["address"] = address_string  # String format for prompts
            patient_info["address_details"] = {  # Object format for other uses
                "street": street,
                "city": city,
                "state": state,
                "zip": zip_code
            }
        
        # Add emergency contact if provided
        if emergency_name or emergency_phone:
            patient_info["emergency_contact"] = {
                "name": emergency_name,
                "relationship": emergency_relationship,
                "phone": emergency_phone
            }
        
        # Add patient to database
        patient_id = db.add_patient(doctor_id, patient_info)
        if patient_id:
            flash(f"Patient {first_name} {last_name} added successfully!", "success")
            return redirect(url_for('select_patient'))
        else:
            flash("Failed to add patient", "error")
    
    return render_template("add_patient.html", user=request.current_user)


# Future functionality placeholders
@app.route("/dashboard")
@login_required
def dashboard():

    """Dashboard showing user's recent activity and forms"""
    # Check if user has a selected patient
    if hasattr(request, 'selected_patient') and request.selected_patient:
        # Get selected patient's recent visits and forms
        patient_id = str(request.selected_patient["_id"])
        recent_visits = db.get_patient_visits(patient_id)[:5]  # Last 5 visits
        
        # Get recent forms for this patient
        recent_forms = [visit for visit in db.get_patient_visits(patient_id) if visit.get('form_pdf_path')][:5]
        
        return render_template("dashboard.html", 
                             user=request.current_user,
                             selected_patient=request.selected_patient,
                             transcripts=recent_visits,  # Visits are the new transcripts
                             forms=recent_forms)  # Now passing actual forms
    else:
        # No patient selected - show basic dashboard
        return render_template("dashboard.html", 
                             user=request.current_user,
                             selected_patient=None,
                             transcripts=[],
                             forms=[])

@app.route("/update-provider-info", methods=["POST"])
@login_required
def update_provider_info():
    """Update provider information for the current doctor"""
    try:
        doctor_id = str(request.current_user["_id"])
        
        # Get form data
        provider_info = {
            "first_name": request.form.get("first_name", "").strip(),
            "last_name": request.form.get("last_name", "").strip(),
            "npi": request.form.get("npi", "").strip(),
            "tax_id": request.form.get("tax_id", "").strip(),
            "facility_name": request.form.get("facility_name", "").strip(),
            "practice_address": request.form.get("practice_address", "").strip(),
        }
        
        # Update the provider information
        success = db.update_doctor_provider_info(doctor_id, provider_info)
        
        if success:
            flash("Provider information updated successfully!", "success")
        else:
            flash("Failed to update provider information", "error")
            
    except Exception as e:
        print(f"Error updating provider info: {e}")
        flash("An error occurred while updating provider information", "error")
   
    return redirect(url_for('dashboard'))

@app.route("/my-forms")
@patient_required
def my_forms():
    """View all saved forms for selected patient"""
    if not request.selected_patient:
        return redirect(url_for('select_patient'))
    patient_id = str(request.selected_patient["_id"])
    patient_visits = db.get_patient_visits(patient_id)
    
    # Filter visits that have forms and add backup status
    forms = []
    for visit in patient_visits:
        if visit.get('form_pdf_path'):
            # Check if original file exists
            original_exists = os.path.exists(visit['form_pdf_path']) if visit.get('form_pdf_path') else False
            
            # Check if backup exists
            backup_exists = visit.get('pdf_content') is not None
            
            # Add status information
            visit['backup_status'] = {
                'original_exists': original_exists,
                'backup_exists': backup_exists,
                'has_structured_data': visit.get('structured_data') is not None
            }
            forms.append(visit)
    
    return render_template("forms.html", 
                         user=request.current_user,
                         selected_patient=request.selected_patient,
                         forms=forms)

@app.route("/history")
@patient_required
def history():
    """View transcript history for selected patient"""
    if not request.selected_patient:
        return redirect(url_for('select_patient'))
    patient_id = str(request.selected_patient["_id"])
    all_visits = db.get_patient_visits(patient_id)
    
    return render_template("history.html", 
                         user=request.current_user,
                         selected_patient=request.selected_patient,
                         transcripts=all_visits)


@app.route("/download-audio/<visit_id>")
@patient_required
def download_audio(visit_id):
    """Download audio recording for a specific visit"""
    try:
        # Get the visit to verify it belongs to the selected patient
        visit = db.get_visit(visit_id)
        if not visit or str(visit["patient_id"]) != str(request.selected_patient["_id"]):
            return jsonify({"error": "Visit not found or access denied"}), 404
        
        # Get audio content
        audio_content, audio_filename = db.get_visit_audio(visit_id)
        if not audio_content:
            return jsonify({"error": "No audio recording found for this visit"}), 404
        
        # Create a BytesIO object to serve the audio
        from io import BytesIO
        audio_file = BytesIO(audio_content)
        
        # Determine MIME type based on filename extension
        mime_type = "audio/wav"  # default
        if audio_filename:
            if audio_filename.lower().endswith('.mp3'):
                mime_type = "audio/mpeg"
            elif audio_filename.lower().endswith('.m4a'):
                mime_type = "audio/mp4"
            elif audio_filename.lower().endswith('.ogg'):
                mime_type = "audio/ogg"
        
        return send_file(
            audio_file,
            as_attachment=True,
            download_name=audio_filename or "recording.wav",
            mimetype=mime_type
        )
        
    except Exception as e:
        return jsonify({"error": f"Failed to download audio: {str(e)}"}), 500


@app.route("/generate-claim", methods=["POST"])
@patient_required
def generate_claim():
    try:
        # Get transcript from request
        data = request.get_json()
        transcript = data.get("transcript", "")
        form_type = data.get("form_type", "tricare")
        
        if not transcript:
            return jsonify({"error": "No transcript provided"}), 400

        # Get patient and doctor info
        if not request.selected_patient:
            return jsonify({"error": "No patient selected"}), 400
            
        patient_id = str(request.selected_patient["_id"])
        patient_name = request.selected_patient.get('patient_info', {}).get('full_name', 'Unknown Patient')
        doctor_id = str(request.current_user["_id"])
        
        # Use MedicalBillingAgent for processing
        try:
            result = medical_billing_agent.process_transcript(
                transcript=transcript,
                patient_id=patient_id,
                patient_name=patient_name,
                doctor_id=doctor_id,
                form_type=form_type
            )
        except Exception as api_error:
            error_msg = str(api_error)
            if "429" in error_msg or "quota" in error_msg.lower():
                return jsonify({
                    "error": "API rate limit exceeded. Please wait a moment and try again, or check your Gemini API quota.",
                    "details": "You've reached the daily limit of 50 requests for the free tier. Please wait or upgrade your API plan.",
                    "retry_after": 60
                }), 429
            else:
                return jsonify({"error": f"API error: {error_msg}"}), 500
        
        print(f"DEBUG: MedicalBillingAgent result: {result}")
        print(f"DEBUG: Result type: {type(result)}")
        
        if not result.get("success", False):
            error_msg = result.get("error", "Unknown error from MedicalBillingAgent")
            return jsonify({"error": error_msg}), 500
        
        structured_data = result.get("structured_data", {})
        
        # Enhance medical codes using fallback lookup
        structured_data = enhance_medical_codes(structured_data, transcript)
        
        # Fix common data issues based on form type
        structured_data = fix_form_specific_data_issues(structured_data, form_type)

        # Validate form data before PDF generation
        validation_result = self._validate_form_data(structured_data, form_type)
        
        # Notify PDF generation about validation results
        from agent_communication import create_agent_communicator, MessageType
        validation_agent = create_agent_communicator("ValidationAgent")
        validation_agent.send_message(
            MessageType.FORM_VALIDATION_COMPLETE,
            {
                'patient_id': patient_id,
                'form_type': form_type,
                'is_valid': validation_result['is_valid'],
                'validation_errors': validation_result['errors'],
                'recommendations': validation_result['recommendations']
            }
        )

        # Generate PDF
        global pdf_generator
        pdf_generator = PDFGeneratorDirect(form_type=form_type)
        pdf_path = pdf_generator.generate_pdf(structured_data)
        
        # Read PDF content for backup storage
        pdf_content = None
        try:
            with open(pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()
        except Exception as e:
            print(f"Warning: Could not read PDF content for backup: {str(e)}")
        
        # Notify other agents about PDF generation completion
        from agent_communication import create_agent_communicator, MessageType
        pdf_agent = create_agent_communicator("PDFGenerationAgent")
        pdf_agent.send_message(
            MessageType.PDF_GENERATION_COMPLETE,
            {
                'patient_id': patient_id,
                'form_type': form_type,
                'structured_data': structured_data,
                'pdf_path': pdf_path,
                'visit_id': None  # Will be set after visit is created
            }
        )
        
        # Save the visit with transcript, PDF path, structured data, and PDF content backup
        visit_id = db.add_visit(
            patient_id=patient_id,
            transcript_text=transcript,
            form_type=form_type,
            form_pdf_path=pdf_path,
            structured_data=structured_data,
            pdf_content=pdf_content
        )
        
        print(f"Visit saved to database with ID: {visit_id}")
        print(f"AI Agent used: MedicalBillingAgent")
        print(f"Patient context used: {result.get('patient_context_used', False)}")

        # Return JSON with visit_id and download URL
        return jsonify({
            "success": True,
            "visit_id": str(visit_id),
            "download_url": url_for('download_form', visit_id=str(visit_id)),
            "view_url": url_for('view_form_page', visit_id=str(visit_id)),
            "ai_agent_used": "MedicalBillingAgent",
            "patient_context_used": result.get("patient_context_used", False),
            "project_id": result.get("project_id")
        })

    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


@app.route("/debug/visits")
@patient_required
def debug_visits():
    """Debug endpoint to show all visits for selected patient"""
    if not request.selected_patient:
        return jsonify({"error": "No patient selected"}), 400
    patient_id = str(request.selected_patient["_id"])
    all_visits = db.get_patient_visits(patient_id)
    
    debug_info = {
        "patient_id": patient_id,
        "patient_name": request.selected_patient.get('patient_info', {}).get('full_name', 'Unknown'),
        "total_visits": len(all_visits),
        "visits": []
    }
    
    for visit in all_visits:
        visit_info = {
            "id": str(visit.get('_id')),
            "timestamp": visit.get('timestamp'),
            "has_transcript": bool(visit.get('transcript_text')),
            "has_pdf_path": bool(visit.get('form_pdf_path')),
            "has_pdf_content": bool(visit.get('pdf_content')),
            "has_structured_data": bool(visit.get('structured_data')),
            "transcript_preview": visit.get('transcript_text', '')[:100] if visit.get('transcript_text') else 'None'
        }
        debug_info["visits"].append(visit_info)
    
    return jsonify(debug_info)


@app.route("/view-form-page/<visit_id>")
@patient_required
def view_form_page(visit_id):
    """Render PDF viewer page"""
    try:
        # Get the visit
        visit = db.get_visit(visit_id)
        if not visit:
            flash("Form not found", "error")
            return redirect(url_for('my_forms'))
        
        # Verify this visit belongs to the selected patient
        if str(visit['patient_id']) != str(request.selected_patient['_id']):
            flash("Access denied", "error")
            return redirect(url_for('my_forms'))
        
        return render_template("pdf_viewer_simple.html", 
                             user=request.current_user,
                             selected_patient=request.selected_patient,
                             form=visit,
                             visit_id=visit_id)
                             
    except Exception as e:
        print(f"Error rendering PDF viewer: {str(e)}")
        flash("Error accessing form", "error")
        return redirect(url_for('my_forms'))


@app.route("/view-form/<visit_id>")
@patient_required
def view_form(visit_id):
    """Serve PDF content for inline viewing"""
    try:
        print(f"DEBUG: Serving PDF for visit_id: {visit_id}")
        
        # Get the visit
        visit = db.get_visit(visit_id)
        if not visit:
            print(f"DEBUG: Visit {visit_id} not found")
            return "Form not found", 404
        
        print(f"DEBUG: Visit found: {visit.get('_id')}")
        
        # Verify this visit belongs to the selected patient
        if str(visit['patient_id']) != str(request.selected_patient['_id']):
            print(f"DEBUG: Access denied - visit patient {visit['patient_id']} != selected patient {request.selected_patient['_id']}")
            return "Access denied", 403
        
        # Try to get PDF content from database backup first
        pdf_content = visit.get('pdf_content')
        if pdf_content:
            print(f"DEBUG: Serving PDF from database backup, size: {len(pdf_content)} bytes")
            # Create response with PDF content for inline viewing
            response = make_response(pdf_content)
            response.headers['Content-Type'] = 'application/pdf'
            response.headers['Content-Disposition'] = 'inline; filename="form_view.pdf"'
            response.headers['Cache-Control'] = 'no-cache'
            return response
        
        # Fallback to file system if no backup exists
        elif visit.get('form_pdf_path') and os.path.exists(visit['form_pdf_path']):
            print(f"DEBUG: Serving PDF from file system: {visit['form_pdf_path']}")
            return send_file(visit['form_pdf_path'], mimetype='application/pdf')
        
        else:
            print(f"DEBUG: No PDF content found - backup: {bool(pdf_content)}, file_path: {visit.get('form_pdf_path')}")
            return "PDF file not found", 404
            
    except Exception as e:
        print(f"Error viewing form: {str(e)}")
        return f"Error viewing form: {str(e)}", 500


@app.route("/download-form/<visit_id>")
@patient_required
def download_form(visit_id):
    """Serve PDF content for download"""
    try:
        print(f"DEBUG: Downloading PDF for visit_id: {visit_id}")
        
        # Get the visit
        visit = db.get_visit(visit_id)
        if not visit:
            print(f"DEBUG: Visit {visit_id} not found")
            return "Form not found", 404
        
        print(f"DEBUG: Visit found: {visit.get('_id')}")
        
        # Verify this visit belongs to the selected patient
        if str(visit['patient_id']) != str(request.selected_patient['_id']):
            print(f"DEBUG: Access denied - visit patient {visit['patient_id']} != selected patient {request.selected_patient['_id']}")
            return "Access denied", 403
        
        # Try to get PDF content from database backup first
        pdf_content = visit.get('pdf_content')
        if pdf_content:
            print(f"DEBUG: Serving PDF from database backup for download, size: {len(pdf_content)} bytes")
            # Create response with PDF content for download
            response = make_response(pdf_content)
            response.headers['Content-Type'] = 'application/pdf'
            response.headers['Content-Disposition'] = 'attachment; filename="cms1500_claim.pdf"'
            return response
        
        # Fallback to file system if no backup exists
        elif visit.get('form_pdf_path') and os.path.exists(visit['form_pdf_path']):
            print(f"DEBUG: Serving PDF from file system for download: {visit['form_pdf_path']}")
            return send_file(
                visit['form_pdf_path'], 
                as_attachment=True, 
                download_name="cms1500_claim.pdf",
                mimetype="application/pdf"
            )
        
        else:
            print(f"DEBUG: No PDF content found for download - backup: {bool(pdf_content)}, file_path: {visit.get('form_pdf_path')}")
            return "PDF file not found", 404
            
    except Exception as e:
        print(f"Error downloading form: {str(e)}")
        return f"Error downloading form: {str(e)}", 500

@app.route("/test-prior-auth", methods=["GET"])
def test_prior_auth():
    return jsonify({"message": "Prior auth route is working!"})

# Prior Authorization Routes
@app.route("/api/prior-auth/select", methods=["POST"])
@login_required
def select_prior_auth_form():
    """Select appropriate prior auth form based on patient state"""
    try:
        data = request.get_json()
        patient_state = data.get('patient_state', '').strip()
        transcript = data.get('transcript', '').strip()
        
        if not patient_state and not transcript:
            return jsonify({"error": "Patient state or transcript is required"}), 400
        
        # Use the prior auth agent to select the form
        result = prior_authorization_agent.select_prior_auth_form(patient_state, transcript)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": f"Failed to select prior auth form: {str(e)}"}), 500


@app.route("/api/prior-auth/find-for-patient")
@patient_required
def find_prior_auth_for_patient():
    """Find prior auth form for the currently selected patient"""
    try:
        # Get patient state from selected patient
        patient = request.selected_patient
        if not patient or not patient.get('patient_info'):
            return jsonify({"error": "No patient selected"}), 400
        
        # Debug: Print patient data structure
        print(f"DEBUG - Full patient data: {patient}")
        print(f"DEBUG - Patient info: {patient.get('patient_info', {})}")
        
        patient_info = patient['patient_info']
        
        # Look for state in multiple places - more comprehensive search
        patient_state = (
            patient_info.get('state') or  # Direct state field
            patient_info.get('address', {}).get('state') or  # In address (old format)
            patient_info.get('address_details', {}).get('state') or  # In address_details (new format)
            patient_info.get('patient_state') or  # Alternative field name
            patient.get('state') or  # State at patient level
            ''
        )
        
        # Also check if state is in the root patient object
        if not patient_state:
            patient_state = patient.get('state', '')
        
        # Clean up the state value (remove empty strings, whitespace)
        if patient_state and isinstance(patient_state, str):
            patient_state = patient_state.strip()
            if not patient_state:
                patient_state = ''
        
        print(f"DEBUG - Patient info keys: {list(patient_info.keys())}")
        print(f"DEBUG - Patient keys: {list(patient.keys())}")
        print(f"DEBUG - Address: {patient_info.get('address', {})}")
        print(f"DEBUG - Patient state found: '{patient_state}'")
        
        if not patient_state:
            return jsonify({
                "success": False,
                "message": f"Patient '{patient_info.get('full_name', 'Unknown')}' does not have a state specified. Please add a 'state' field to the patient information.",
                "available_states": list(prior_authorization_agent.available_states.keys()),
                "patient_name": patient_info.get('full_name', 'Unknown'),
                "debug_info": {
                    "patient_info": patient_info,
                    "patient_state": patient_state
                }
            }), 400
        
        # Use the prior auth agent to select the form
        result = prior_authorization_agent.select_prior_auth_form(patient_state)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": f"Failed to find prior auth form: {str(e)}"}), 500


@app.route("/api/prior-auth/available-forms")
@login_required
def get_available_prior_auth_forms():
    """Get list of available prior auth forms"""
    try:
        forms_info = prior_authorization_agent.get_available_forms_info()
        return jsonify({
            "success": True,
            "forms": forms_info,
            "total_forms": len(forms_info)
        })
    except Exception as e:
        return jsonify({"error": f"Failed to get available forms: {str(e)}"}), 500


@app.route("/api/prior-auth/download/<state>")
@login_required
def download_prior_auth_form(state):
    """Download a specific state's prior auth form"""
    try:
        state_lower = state.lower()
        result = prior_authorization_agent.select_prior_auth_form(state_lower)
        
        if not result.get('success') or not result.get('forms'):
            return jsonify({"error": "No forms found for this state"}), 404
        
        # Get the first available form (local forms have priority 1)
        sorted_forms = sorted(result['forms'], key=lambda x: x.get('priority', 999))
        selected_form = sorted_forms[0]
        
        # Check if it's a local form
        if selected_form.get('type') == 'local' and selected_form.get('path'):
            form_path = selected_form['path']
            if os.path.exists(form_path):
                return send_file(form_path, as_attachment=True, download_name=selected_form['filename'])
            else:
                return jsonify({"error": "Local form file not found"}), 404
        
        # If it's an online form, redirect to the URL
        elif selected_form.get('type') == 'online' and selected_form.get('url'):
            return redirect(selected_form['url'])
        
        else:
            return jsonify({"error": "Form not available for download"}), 404
        
    except Exception as e:
        return jsonify({"error": f"Failed to download form: {str(e)}"}), 500


@app.route("/api/prior-auth/guidance", methods=["POST"])
@login_required
def get_prior_auth_guidance():
    """Get prior auth guidance for a specific state"""
    try:
        data = request.get_json()
        state = data.get('state', '').strip()
        procedure_type = data.get('procedure_type', '').strip()
        
        if not state:
            return jsonify({"error": "State is required"}), 400
        
        guidance = prior_authorization_agent.generate_guidance(state, procedure_type)
        
        return jsonify({
            "success": True,
            "state": state.title(),
            "procedure_type": procedure_type,
            "guidance": guidance
        })
        
    except Exception as e:
        return jsonify({"error": f"Failed to get guidance: {str(e)}"}), 500


@app.route("/generate-prior-auth", methods=["POST"])
@patient_required
def generate_prior_auth():
    try:
        # Get transcript from request
        data = request.get_json()
        transcript = data.get("transcript", "")

        if not transcript:
            return jsonify({"error": "No transcript provided"}), 400

        # Get patient state for form selection
        patient = request.selected_patient
        patient_info = patient.get('patient_info', {})
        patient_state = None
        
        # Try to get state from various locations
        if patient_info.get('state'):
            patient_state = patient_info.get('state')
        elif patient_info.get('address', {}).get('state'):
            patient_state = patient_info.get('address', {}).get('state')
        elif patient_info.get('address_details', {}).get('state'):
            patient_state = patient_info.get('address_details', {}).get('state')
        elif patient_info.get('patient_state'):
            patient_state = patient_info.get('patient_state')
        elif patient.get('state'):
            patient_state = patient.get('state')
        
        print(f"DEBUG - Patient state for prior auth: {patient_state}")
        
        if not patient_state:
            return jsonify({
                "error": f"Patient '{patient_info.get('full_name', 'Unknown')}' does not have a state specified. Please add a 'state' field to the patient information."
            }), 400

        # Use PriorAuthAgent to select the appropriate form
        form_result = prior_authorization_agent.select_prior_auth_form(patient_state)
        
        if not form_result or not form_result.get('success'):
            return jsonify({
                "error": f"No prior authorization form found for state: {patient_state}"
            }), 404

        # Use the first available form (local forms have priority 1)
        selected_form = None
        if form_result.get('forms'):
            # Sort by priority (local forms first)
            sorted_forms = sorted(form_result['forms'], key=lambda x: x.get('priority', 999))
            selected_form = sorted_forms[0]
        
        if not selected_form:
            return jsonify({
                "error": f"No prior authorization form found for state: {patient_state}"
            }), 404

        # Generate PDF using the selected form
        pdf_path = None
        if selected_form.get('type') == 'local':
            # Use local form
            form_path = form_result.get('file_path')
            if form_path and os.path.exists(form_path):
                # For now, just return the existing PDF
                # In the future, we could fill it with patient data
                pdf_path = form_path
            else:
                return jsonify({"error": "Local form file not found"}), 404
        else:
            # For online forms, we'd need to download and process them
            # For now, return an error suggesting to use local forms
            return jsonify({
                "error": "Online forms not yet supported for PDF generation. Please ensure you have local forms available."
            }), 501

        if not pdf_path or not os.path.exists(pdf_path):
            return jsonify({"error": "Generated PDF not found"}), 500

        # Return the PDF file
        return send_file(
            pdf_path,
            as_attachment=True,
            download_name=f"prior_auth_{patient_state.lower()}.pdf",
            mimetype="application/pdf",
        )

    except Exception as e:
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route("/process-transcript", methods=["POST"])
def process_transcript():
    try:
        data = request.get_json()
        raw_transcript = data.get("transcript", "")
        
        if not raw_transcript:
            return jsonify({"error": "No transcript provided"}), 400
        
        print(f"Processing transcript with SpeakerIdentificationAgent: {raw_transcript}")
        
        # Use SpeakerIdentificationAgent for processing
        formatted_transcript = speaker_identification_agent.identify_speakers(raw_transcript)
        
        print(f"SpeakerIdentificationAgent response: {formatted_transcript}")
        
        return jsonify({
            "success": True,
            "formatted_transcript": formatted_transcript,
            "ai_agent_used": "SpeakerIdentificationAgent"
        })
        
    except Exception as e:
        print(f"Error processing transcript: {str(e)}")
        return jsonify({"error": f"Error processing transcript: {str(e)}"}), 500


@app.route("/cms-chatbot", methods=["POST"])
@patient_required
def cms_chatbot():
    """Enhanced Medical Form Assistant Chatbot with Contextus AI Integration"""
    try:
        # Get the user's message
        data = request.get_json()
        user_message = data.get("message", "")
        visit_id = data.get("visit_id", None)
        
        if not user_message:
            return jsonify({"error": "No message provided"}), 400
        
        # Get patient context from Contextus
        patient_id = str(request.selected_patient["_id"])
        patient_name = request.selected_patient.get('patient_info', {}).get('full_name', 'Unknown Patient')
        doctor_id = str(request.current_user["_id"])
        
        # Get or create Contextus project for this patient
        project_id = contextus.get_patient_project(patient_id, patient_name, doctor_id)
        patient_context = {}
        contextus_available = False
        
        if project_id:
            try:
                patient_context = contextus.get_patient_context(project_id)
                contextus_available = bool(patient_context)
                print(f"DEBUG: Contextus context available: {contextus_available}")
            except Exception as e:
                print(f"Error getting Contextus context: {e}")
                contextus_available = False
        
        # Set up chatbot agent communication (if not already done)
        if not hasattr(app, 'chatbot_communicator'):
            from agent_communication import create_agent_communicator, MessageType
            app.chatbot_communicator = create_agent_communicator("ChatbotAgent")
            
            def on_pdf_generation_complete(message):
                data = message.data
                print(f"📄 Chatbot: New PDF generated for patient {data.get('patient_id')}")
                print(f"   Form type: {data.get('form_type')}")
                print(f"   → Chatbot context updated with new form data")
            
            app.chatbot_communicator.listen_for(
                MessageType.PDF_GENERATION_COMPLETE,
                on_pdf_generation_complete
            )
        
        # Get context about the current form if visit_id is provided
        form_context = ""
        form_type = "cms1500"  # default
        form_name = "CMS-1500"
        
        if visit_id:
            try:
                visit = db.get_visit(visit_id)
                if visit and str(visit['patient_id']) == str(request.selected_patient['_id']):
                    form_type = visit.get('form_type', 'cms1500')
                    
                    # Map form_type to display names
                    form_name_map = {
                        'tricare': 'Tricare CMN',
                        'cms1500': 'CMS-1500', 
                        'cms1450': 'CMS-1450'
                    }
                    form_name = form_name_map.get(form_type, form_type.upper() if form_type else 'Medical')
                    
                    if visit.get('structured_data'):
                        # Extract key information from the structured data
                        structured_data = visit['structured_data']
                        
                        # Safely handle procedures - they might be strings or dicts
                        procedures_text = "N/A"
                        if structured_data.get('procedures'):
                            procedures = structured_data.get('procedures', [])
                            if isinstance(procedures, list) and procedures:
                                if isinstance(procedures[0], dict):
                                    procedures_text = ', '.join([f"{proc.get('code', 'N/A')} - {proc.get('description', 'N/A')}" for proc in procedures])
                                else:
                                    procedures_text = ', '.join([str(proc) for proc in procedures])
                        
                        form_context = f"""
Current {form_name} Form Context:
- Patient: {structured_data.get('patient_name', 'N/A')}
- Date of Service: {structured_data.get('date_of_service', 'N/A')}
- Diagnosis Codes: {', '.join(structured_data.get('diagnosis_codes', []))}
- Procedure Codes: {procedures_text}
- Provider: {structured_data.get('provider_name', 'N/A')}
"""
            except Exception as e:
                print(f"Error processing visit data for chatbot: {e}")
                # Continue with default form context if there's an error
        # Build patient context information for enhanced responses
        patient_context_info = ""
        if contextus_available and patient_context:
            # Extract relevant patient patterns and history
            billing_patterns = patient_context.get('billing_patterns', {})
            common_codes = patient_context.get('common_codes', {})
            
            # Build patient-specific context
            patient_context_info = f"""
PATIENT-SPECIFIC CONTEXT (from AI learning):
- Patient: {patient_name}
- Common Diagnoses: {', '.join(list(billing_patterns.get('common_diagnoses', {}).keys())[:5]) if billing_patterns.get('common_diagnoses') else 'None recorded'}
- Common Procedures: {', '.join(list(billing_patterns.get('common_procedures', {}).keys())[:5]) if billing_patterns.get('common_procedures') else 'None recorded'}
- Historical ICD-10 Codes: {', '.join(list(common_codes.get('icd10', {}).keys())[:5]) if common_codes.get('icd10') else 'None recorded'}
- Historical CPT Codes: {', '.join(list(common_codes.get('cpt', {}).keys())[:5]) if common_codes.get('cpt') else 'None recorded'}
- Success Rate: {billing_patterns.get('success_rate', 0):.1%} (based on historical data)
"""
        
        # Create specialized assistant prompt based on form type
        if form_type == 'tricare':
            assistant_prompt = f"""
        You are a specialized Tricare CMN (Certificate of Medical Necessity) form assistant with AI-enhanced patient context. Provide concise, helpful answers about:
        • Tricare CMN form requirements and completion
        • Durable Medical Equipment (DME) authorization procedures
        • Medical necessity documentation for equipment
        • Tricare-specific billing and authorization processes
        • Equipment justification and documentation requirements

        Guidelines:
        - Keep responses short, focused and Tricare-specific
        - You CANNOT edit the PDF directly - provide guidance only
        - Include specific requirements and documentation needs
        - Use patient context to provide personalized recommendations
        - Remind users to verify with current Tricare policies

{patient_context_info}

{form_context}

User Question: {user_message}

Provide a concise, accurate response focused on Tricare CMN requirements:"""
        
        elif form_type == 'cms1450':
            assistant_prompt = f"""
        You are a specialized CMS-1450 (UB-04) institutional billing form assistant with AI-enhanced patient context. Provide concise, helpful answers about:
        • CMS-1450/UB-04 form fields and requirements
        • Revenue codes and charge descriptions
        • Condition codes and occurrence codes
        • Hospital and facility billing procedures
        • Institutional claim submission requirements

        Guidelines:
        - Keep responses short, focused on institutional billing
        - You CANNOT edit the PDF directly - provide guidance only
        - Include specific code requirements when relevant
        - Use patient context to suggest relevant codes and patterns
        - Remind users to verify with current CMS guidelines

{patient_context_info}

{form_context}

User Question: {user_message}

Provide a concise, accurate response focused on CMS-1450/UB-04 requirements:"""
        
        else:  # Default to CMS-1500 or unknown forms
            assistant_prompt = f"""
        You are a specialized {form_name} form assistant with AI-enhanced patient context. Provide concise, helpful answers about:
        • {form_name} form fields and requirements
        • ICD-10 diagnosis codes and CPT procedure codes  
        • Medical billing procedures and best practices
        • Form completion guidance and submission requirements

        Guidelines:
        - Keep responses short, focused on {form_name} forms
        - You CANNOT edit the PDF directly - provide guidance only
        - Include specific code numbers when relevant
        - Use patient context to suggest relevant codes and patterns
        - Remind users to verify information independently

{patient_context_info}

{form_context}

User Question: {user_message}

Provide a concise, accurate response:"""

        # Generate response using Gemini
        response = model.generate_content(assistant_prompt)
        
        # Extract response content
        bot_response = ""
        if hasattr(response, 'text'):
            bot_response = response.text
        elif hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "content") and candidate.content:
                if hasattr(candidate.content, 'parts') and candidate.content.parts:
                    bot_response = candidate.content.parts[0].text
                elif hasattr(candidate.content, 'text'):
                    bot_response = candidate.content.text
        
        if not bot_response:
            return jsonify({"error": "No response from AI assistant"}), 500
        
        # Log the interaction to Contextus for learning (if available)
        if project_id and contextus_available:
            try:
                # Create a simple interaction artifact for learning
                interaction_data = {
                    "timestamp": datetime.now().isoformat(),
                    "user_query": user_message,
                    "ai_response": bot_response,
                    "form_type": form_type,
                    "context_used": bool(patient_context),
                    "interaction_type": "chatbot_query"
                }
                
                # Log to Contextus (this will help the AI learn from interactions)
                contextus.log_transcript_processing(
                    project_id, 
                    f"Chatbot Query: {user_message}", 
                    interaction_data, 
                    form_type
                )
                print(f"DEBUG: Logged chatbot interaction to Contextus")
            except Exception as e:
                print(f"Error logging chatbot interaction to Contextus: {e}")
                # Send error notification to all agents
                self._notify_error_to_agents("contextus_logging_error", str(e), patient_id)
        
        # Determine which AI agent was used
        ai_agent_used = "CMSAssistantAgent"
        if contextus_available:
            ai_agent_used = "CMSAssistantAgent + ContextusAI"
        
        return jsonify({
            "response": bot_response,
            "success": True,
            "ai_agent_used": ai_agent_used,
            "contextus_enhanced": contextus_available,
            "patient_context_used": bool(patient_context),
            "project_id": project_id
        })
        
    except Exception as e:
        print(f"Error in medical form chatbot: {str(e)}")
        # Notify all agents about the error
        _notify_error_to_agents("chatbot_error", str(e), patient_id)
        return jsonify({"error": f"Error processing request: {str(e)}"}), 500


def _notify_error_to_agents(error_type: str, error_message: str, patient_id: str = None):
    """Notify all agents about errors for coordinated recovery."""
    try:
        from agent_communication import create_agent_communicator, MessageType
        
        # Create error notification
        error_agent = create_agent_communicator("ErrorHandlerAgent")
        error_agent.send_message(
            MessageType.ERROR_OCCURRED,
            {
                'error_type': error_type,
                'error_message': error_message,
                'patient_id': patient_id,
                'timestamp': datetime.now().isoformat(),
                'recovery_suggestions': _get_recovery_suggestions(error_type)
            }
        )
    except Exception as e:
        print(f"Error notifying agents about error: {e}")


def _get_recovery_suggestions(error_type: str) -> list:
    """Get recovery suggestions based on error type."""
    suggestions = {
        "contextus_logging_error": [
            "Check Contextus API connection",
            "Verify project ID is valid",
            "Retry with exponential backoff"
        ],
        "chatbot_error": [
            "Check Gemini API credentials",
            "Verify input format",
            "Fall back to basic response"
        ],
        "pdf_generation_error": [
            "Check PDF template files",
            "Verify structured data format",
            "Use fallback PDF generation"
        ],
        "validation_error": [
            "Check required fields",
            "Verify data format",
            "Use default values where possible"
        ]
    }
    return suggestions.get(error_type, ["Check logs for details", "Retry operation"])


@app.route("/process-audio", methods=["POST"])
def process_audio():
    try:
        # Check if audio file is provided
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({"error": "No audio file selected"}), 400
        
        # Save the audio file temporarily
        import os
        import tempfile
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            audio_file.save(tmp_file.name)
            
            # For now, we'll use a simple approach
            # In production, you'd use a proper audio processing service
            return jsonify({
                "message": "Audio file received. In production, this would be processed with a speech-to-text service like AssemblyAI or Deepgram.",
                "filename": audio_file.filename,
                "size": len(audio_file.read())
            })
    
    except Exception as e:
        return jsonify({"error": f"Error processing audio: {str(e)}"}), 500


@app.route("/health")
def health():
    return jsonify({"status": "healthy"})


# Contextus AI Second Brain Enhanced Endpoints
@app.route("/api/enhanced-generate-claim", methods=["POST"])
@patient_required
def enhanced_generate_claim():
    """
    Enhanced claim generation with Contextus AI Second Brain.
    Provides context-aware processing and learning.
    """
    try:
        data = request.get_json()
        transcript = data.get("transcript", "")
        form_type = data.get("form_type", "tricare")
        
        if not transcript:
            return jsonify({"error": "No transcript provided"}), 400
        
        # Get patient and doctor info
        if not request.selected_patient:
            return jsonify({"error": "No patient selected"}), 400
            
        patient_id = str(request.selected_patient["_id"])
        patient_name = request.selected_patient.get('patient_info', {}).get('full_name', 'Unknown Patient')
        doctor_id = str(request.current_user["_id"])
        
        # Get or create Contextus project for this patient
        project_id = contextus.get_patient_project(patient_id, patient_name, doctor_id)
        
        # Get patient context for enhanced processing
        patient_context = contextus.get_patient_context(project_id) if project_id else {}
        
        # Use existing generate_claim logic but with context enhancement
        global pdf_generator
        pdf_generator = PDFGeneratorDirect(form_type=form_type)
        
        # Get form-specific prompt (existing logic)
        prompt = get_form_specific_prompt(form_type, transcript)
        
        # Add patient context to prompt if available
        if patient_context and project_id:
            billing_patterns = patient_context.get("billing_patterns", {})
            common_codes = patient_context.get("common_codes", {})
            
            context_enhancement = f"""

PATIENT CONTEXT FROM AI SECOND BRAIN:
- Previous diagnoses: {list(billing_patterns.get('common_diagnoses', {}).keys())[:5]}
- Previous procedures: {list(billing_patterns.get('common_procedures', {}).keys())[:5]}
- Common ICD-10 codes: {list(common_codes.get('icd10', {}).keys())[:5]}
- Common CPT codes: {list(common_codes.get('cpt', {}).keys())[:5]}

Use this context to:
1. Ensure consistency with previous billing patterns
2. Apply learned preferences for this patient
3. Suggest additional codes based on historical data
4. Maintain continuity in medical coding approach

"""
            prompt += context_enhancement
        
        # Use EnhancedProcessingAgent for processing
        result = enhanced_processing_agent.process_with_context(
            transcript=transcript,
            patient_id=patient_id,
            patient_name=patient_name,
            doctor_id=doctor_id,
            form_type=form_type
        )
        
        if not result["success"]:
            return jsonify({"error": result["error"]}), 500
        
        structured_data = result["structured_data"]
        ai_insights = result["ai_insights"]
        patient_context = result["patient_context"]
        project_id = result["project_id"]
        
        # Structured data is already parsed by the agent
        
        # Enhance with medical codes and fix data issues (existing logic)
        structured_data = enhance_medical_codes(structured_data, transcript)
        structured_data = fix_form_specific_data_issues(structured_data, form_type)
        
        # Generate PDF (existing logic)
        pdf_path = pdf_generator.generate_pdf(structured_data)
        
        # Read PDF content for backup storage (existing logic)
        pdf_content = None
        try:
            with open(pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()
        except Exception as e:
            print(f"Warning: Could not read PDF content for backup: {str(e)}")
        
        # Save the visit with transcript, PDF path, structured data, and PDF content backup (existing logic)
        visit_id = db.add_visit(
            patient_id=patient_id,
            transcript_text=transcript,
            form_pdf_path=pdf_path,
            structured_data=structured_data,
            pdf_content=pdf_content
        )
        
        # Log to Contextus for AI learning
        if project_id:
            contextus.log_transcript_processing(project_id, transcript, structured_data, form_type)
        
        # Calculate AI confidence and insights
        ai_confidence = contextus._calculate_confidence(structured_data)
        ai_insights = {
            "confidence": ai_confidence,
            "patient_context_used": bool(patient_context),
            "learning_opportunities": [],
            "recommendations": []
        }
        
        # Add learning opportunities
        diagnoses = structured_data.get("diagnoses", [])
        procedures = structured_data.get("procedures", [])
        
        if len(diagnoses) > 3:
            ai_insights["learning_opportunities"].append("Complex case with multiple diagnoses - good learning data")
        
        if any(p.get("code") for p in procedures):
            ai_insights["learning_opportunities"].append("Successful procedure coding - pattern can be reinforced")
        
        # Add recommendations based on context
        if patient_context:
            billing_patterns = patient_context.get("billing_patterns", {})
            if billing_patterns.get("common_diagnoses"):
                ai_insights["recommendations"].append("Consider adding commonly used diagnoses for this patient")
        
        print(f"Enhanced processing completed with AI confidence: {ai_confidence}")
        print(f"Contextus project ID: {project_id}")
        
        # Return enhanced response
        return jsonify({
            "success": True,
            "visit_id": str(visit_id),
            "download_url": url_for('download_form', visit_id=str(visit_id)),
            "view_url": url_for('view_form_page', visit_id=str(visit_id)),
            "ai_insights": ai_insights,
            "patient_context": patient_context,
            "contextus_project_id": project_id
        })
        
    except Exception as e:
        return jsonify({"error": f"Enhanced processing error: {str(e)}"}), 500


@app.route("/api/patient-context/<patient_id>")
@login_required
def get_patient_context(patient_id):
    """Get AI context for a specific patient."""
    try:
        # Verify patient belongs to current doctor
        patient = db.get_patient(patient_id)
        if not patient or str(patient['doctor_id']) != str(request.current_user['_id']):
            return jsonify({"error": "Patient not found or access denied"}), 404
        
        patient_name = patient.get('patient_info', {}).get('full_name', 'Unknown Patient')
        doctor_id = str(request.current_user['_id'])
        
        # Get Contextus project
        project_id = contextus.get_patient_project(patient_id, patient_name, doctor_id)
        if not project_id:
            return jsonify({"error": "Patient project not found"}), 404
        
        context = contextus.get_patient_context(project_id)
        return jsonify({
            "patient_id": patient_id,
            "patient_name": patient_name,
            "project_id": project_id,
            "context": context
        })
        
    except Exception as e:
        return jsonify({"error": f"Error retrieving context: {str(e)}"}), 500


@app.route("/api/ai-agent-query", methods=["POST"])
@login_required
def query_ai_agent():
    """Query the AI agent with natural language."""
    try:
        data = request.get_json()
        query = data.get("query", "")
        patient_id = data.get("patient_id", "")
        
        if not query:
            return jsonify({"error": "No query provided"}), 400
        
        if patient_id:
            # Verify patient belongs to current doctor
            patient = db.get_patient(patient_id)
            if not patient or str(patient['doctor_id']) != str(request.current_user['_id']):
                return jsonify({"error": "Patient not found or access denied"}), 404
            
            patient_name = patient.get('patient_info', {}).get('full_name', 'Unknown Patient')
            doctor_id = str(request.current_user['_id'])
            
            # Get Contextus project
            project_id = contextus.get_patient_project(patient_id, patient_name, doctor_id)
            if not project_id:
                return jsonify({"error": "Patient project not found"}), 404
        else:
            # Use a general project or create one
            project_id = contextus.get_patient_project("general", "General Query", str(request.current_user['_id']))
        
        response = contextus_ai_agent.query_patient_data(patient_id, patient_name, doctor_id, query)
        return jsonify({
            "query": query,
            "response": response,
            "project_id": project_id
        })
        
    except Exception as e:
        return jsonify({"error": f"AI agent query error: {str(e)}"}), 500


@app.route("/api/ai-insights/<patient_id>")
@login_required
def get_ai_insights(patient_id):
    """Get AI insights and recommendations for a patient."""
    try:
        # Verify patient belongs to current doctor
        patient = db.get_patient(patient_id)
        if not patient or str(patient['doctor_id']) != str(request.current_user['_id']):
            return jsonify({"error": "Patient not found or access denied"}), 404
        
        patient_name = patient.get('patient_info', {}).get('full_name', 'Unknown Patient')
        doctor_id = str(request.current_user['_id'])
        
        # Get Contextus project
        project_id = contextus.get_patient_project(patient_id, patient_name, doctor_id)
        if not project_id:
            return jsonify({"error": "Patient project not found"}), 404
        
        # Use ContextusAIAgent for insights
        insights = contextus_ai_agent.get_patient_insights(patient_id, patient_name, doctor_id)
        
        if "error" in insights:
            return jsonify(insights), 500
        
        return jsonify(insights)
        
    except Exception as e:
        return jsonify({"error": f"Error retrieving insights: {str(e)}"}), 500


@app.route("/discover-fields")
def discover_fields():
    """Discover all available form fields in the PDF template"""
    try:
        fields = pdf_generator.discover_form_fields()
        return jsonify({
            "status": "success",
            "fields": fields,
            "count": len(fields)
        })
    except Exception as e:
        return jsonify({"error": f"Failed to discover fields: {str(e)}"}), 500


@app.route("/get-pdf-backup/<visit_id>")
@login_required
def get_pdf_backup(visit_id):
    """Retrieve PDF from database backup if original file is missing"""
    try:
        # Get visit and verify access
        visit = db.get_visit(visit_id)
        if not visit:
            return "Visit not found", 404
        
        # Verify user has access to this visit
        patient = db.get_patient(visit['patient_id'])
        if str(patient['doctor_id']) != str(request.current_user['_id']):
            return "Access denied", 403
        
        # First try to serve the original file
        pdf_path = visit.get('form_pdf_path')
        if pdf_path and os.path.exists(pdf_path):
            return send_file(
                pdf_path,
                as_attachment=True,
                download_name="cms1500_backup.pdf",
                mimetype="application/pdf"
            )
        
        # If original file doesn't exist, try to serve from database backup
        pdf_content = db.get_visit_pdf_content(visit_id)
        if pdf_content:
            # Create a temporary file from the backup content
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                temp_file.write(pdf_content)
                temp_path = temp_file.name
            
            return send_file(
                temp_path,
                as_attachment=True,
                download_name="cms1500_backup.pdf",
                mimetype="application/pdf"
            )
        
        return "PDF backup not available", 404
        
    except Exception as e:
        return f"Error retrieving PDF backup: {str(e)}", 500


@app.route("/application_images/<path:filename>")
def serve_application_images(filename):
    """Serve files from the application_images directory"""
    import os

    from flask import send_from_directory

    # Get the directory path relative to this file
    app_images_dir = os.path.join(os.path.dirname(__file__), 'application_images')
    return send_from_directory(app_images_dir, filename)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
