#!/usr/bin/env python3
"""
Comprehensive AI Agents for ScribeMD
Converts all Gemini API calls into specialized AI agents with Contextus integration
"""

import os
import json
import google.generativeai as genai
from contextus_integration import create_contextus_integration
from agent_communication import create_agent_communicator, MessageType
from typing import Dict, List, Optional, Any


class MedicalBillingAgent:
    """AI agent for medical billing form generation with Contextus learning."""
    
    def __init__(self):
        self.gemini_model = genai.GenerativeModel("gemini-2.0-flash-exp")
        self.contextus = create_contextus_integration()
        self.communicator = create_agent_communicator("MedicalBillingAgent")
        self._setup_listeners()
    
    def _setup_listeners(self):
        """Set up message listeners for inter-agent communication"""
        self.communicator.listen_for(
            MessageType.SPEAKER_IDENTIFICATION_COMPLETE,
            self._on_speaker_identification_complete
        )
    
    def _on_speaker_identification_complete(self, message):
        """Handle speaker identification completion"""
        data = message.data
        patient_id = data.get('patient_id')
        formatted_transcript = data.get('formatted_transcript')
        
        print(f"📋 MedicalBillingAgent: Speaker identification complete for patient {patient_id}")
        print(f"   Ready to process formatted transcript")
        
        # Send notification that we're ready to process
        self.communicator.send_message(
            MessageType.TRANSCRIPT_PROCESSING_COMPLETE,
            {
                'patient_id': patient_id,
                'formatted_transcript': formatted_transcript,
                'status': 'ready_for_processing'
            }
        )
    
    def process_transcript(self, transcript: str, patient_id: str, patient_name: str, 
                          doctor_id: str, form_type: str) -> Dict:
        """Process transcript with Contextus-enhanced learning."""
        try:
            # Get patient's Contextus project
            project_id = self.contextus.get_patient_project(patient_id, patient_name, doctor_id)
            
            # Get patient context for enhanced processing
            patient_context = self.contextus.get_patient_context(project_id) if project_id else {}
            
            # Create context-aware prompt
            enhanced_prompt = self._create_context_aware_prompt(transcript, form_type, patient_context)
            
            # Process with Gemini
            response = self.gemini_model.generate_content(enhanced_prompt)
            
            # Parse structured data
            structured_data = self._parse_structured_data(response.text)
            
            # Log to Contextus for learning
            if project_id:
                self.contextus.log_transcript_processing(project_id, transcript, structured_data, form_type)
            
            return {
                "success": True,
                "structured_data": structured_data,
                "patient_context_used": bool(patient_context),
                "project_id": project_id,
                "raw_response": response.text
            }
            
        except Exception as e:
            import traceback
            error_details = f"Error in MedicalBillingAgent.process_transcript: {str(e)}\nTraceback:\n{traceback.format_exc()}"
            print(f"DEBUG: {error_details}")
            return {"success": False, "error": error_details}
    
    def _create_context_aware_prompt(self, transcript: str, form_type: str, patient_context: Dict) -> str:
        """Create prompt enhanced with patient context from Contextus."""
        try:
            # Load form-specific prompt (simplified version)
            base_prompt = f"""
            Extract medical billing information from this transcript for {form_type} form.
            
            Transcript: {transcript}
            
            Return structured JSON with:
            - patient: {{name, dob, insurance_info}}
            - provider: {{name, npi, address}}
            - diagnoses: [{{code, description}}]
            - procedures: [{{code, description, date}}]
            - date_of_service: "YYYY-MM-DD"
            """
            
            # Add Contextus learning if available
            if patient_context:
                print(f"DEBUG: patient_context type: {type(patient_context)}")
                print(f"DEBUG: patient_context: {patient_context}")
                
                try:
                    billing_patterns = patient_context.get("billing_patterns", {})
                    common_codes = patient_context.get("common_codes", {})
                    print(f"DEBUG: billing_patterns type: {type(billing_patterns)}")
                    print(f"DEBUG: common_codes type: {type(common_codes)}")
                    
                    # Ensure billing_patterns and common_codes are dictionaries
                    if not isinstance(billing_patterns, dict):
                        print(f"WARNING: billing_patterns is not a dict, it's {type(billing_patterns)}")
                        billing_patterns = {}
                    if not isinstance(common_codes, dict):
                        print(f"WARNING: common_codes is not a dict, it's {type(common_codes)}")
                        common_codes = {}
                    
                    context_enhancement = f"""
                    
                    PATIENT LEARNING CONTEXT:
                    - Previous common diagnoses: {list(billing_patterns.get('common_diagnoses', {}).keys())[:5]}
                    - Previous common procedures: {list(billing_patterns.get('common_procedures', {}).keys())[:5]}
                    - Common ICD-10 codes: {list(common_codes.get('icd10', {}).keys())[:5]}
                    - Common CPT codes: {list(common_codes.get('cpt', {}).keys())[:5]}
                    
                    Use this context to ensure consistency with previous billing patterns.
                    """
                    base_prompt += context_enhancement
                except Exception as context_error:
                    print(f"ERROR in context processing: {context_error}")
                    import traceback
                    print(f"Context error traceback: {traceback.format_exc()}")
                    # Continue without context if there's an error
            
            return base_prompt
            
        except Exception as e:
            print(f"ERROR in _create_context_aware_prompt: {e}")
            import traceback
            print(f"Prompt creation error traceback: {traceback.format_exc()}")
            # Return basic prompt if context processing fails
            return f"""
            Extract medical billing information from this transcript for {form_type} form.
            
            Transcript: {transcript}
            
            Return structured JSON with:
            - patient: {{name, dob, insurance_info}}
            - provider: {{name, npi, address}}
            - diagnoses: [{{code, description}}]
            - procedures: [{{code, description, date}}]
            - date_of_service: "YYYY-MM-DD"
            """
    
    def _parse_structured_data(self, response_text: str) -> Dict:
        """Parse structured data from Gemini response."""
        try:
            # Try to extract JSON from response
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                json_text = response_text[json_start:json_end].strip()
            elif "{" in response_text and "}" in response_text:
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                json_text = response_text[json_start:json_end]
            else:
                # Fallback: create basic structure
                return {
                    "patient": {"name": "Unknown", "dob": "", "insurance_info": {}},
                    "provider": {"name": "Unknown", "npi": "", "address": {}},
                    "diagnoses": [],
                    "procedures": [],
                    "date_of_service": ""
                }
            
            return json.loads(json_text)
        except json.JSONDecodeError:
            # Fallback structure if JSON parsing fails
            return {
                "patient": {"name": "Unknown", "dob": "", "insurance_info": {}},
                "provider": {"name": "Unknown", "npi": "", "address": {}},
                "diagnoses": [],
                "procedures": [],
                "date_of_service": ""
            }


class SpeakerIdentificationAgent:
    """AI agent for speaker identification in medical conversations."""
    
    def __init__(self):
        self.gemini_model = genai.GenerativeModel("gemini-2.0-flash-exp")
        self.communicator = create_agent_communicator("SpeakerIdentificationAgent")
    
    def identify_speakers(self, transcript: str, patient_id: str = None) -> str:
        """Identify Doctor vs Patient in transcript."""
        try:
            prompt = f"""
            You are an expert at analyzing medical conversations. Your task is to identify who is speaking (Doctor or Patient) in this clinical transcript and format it properly.

            IMPORTANT RULES:
            1. Identify speakers based on context, medical terminology, and conversation flow
            2. Format as "Doctor: [text]" or "Patient: [text]" 
            3. Be conservative - if unsure, make your best guess based on context
            4. Preserve the exact wording, just add speaker labels
            5. Each speaker change should be on a new line
            6. Look for medical questions, examination instructions, and professional language (Doctor)
            7. Look for personal symptoms, questions about treatment, and casual language (Patient)

            Raw transcript:
            {transcript}

            Format the conversation with proper speaker identification:
            """
            
            response = self.gemini_model.generate_content(prompt)
            formatted_transcript = response.text
            
            # Send completion message to other agents
            if patient_id:
                self.communicator.send_message(
                    MessageType.SPEAKER_IDENTIFICATION_COMPLETE,
                    {
                        'patient_id': patient_id,
                        'formatted_transcript': formatted_transcript,
                        'original_transcript': transcript,
                        'status': 'success'
                    }
                )
            
            return formatted_transcript
            
        except Exception as e:
            error_msg = f"Error processing transcript: {str(e)}"
            
            # Send error message to other agents
            if patient_id:
                self.communicator.send_message(
                    MessageType.ERROR_OCCURRED,
                    {
                        'patient_id': patient_id,
                        'error': error_msg,
                        'agent': 'SpeakerIdentificationAgent'
                    }
                )
            
            return error_msg


class CMSAssistantAgent:
    """AI agent for CMS-1500 form assistance and guidance."""
    
    def __init__(self):
        self.gemini_model = genai.GenerativeModel("gemini-2.0-flash-exp")
    
    def answer_question(self, question: str, form_context: str = "") -> str:
        """Answer questions about CMS-1500 forms."""
        try:
            prompt = f"""
            You are a specialized CMS-1500 form assistant. Provide concise, helpful answers about:
            • CMS-1500 form fields and requirements
            • ICD-10 diagnosis codes and CPT procedure codes  
            • Medical billing procedures and best practices
            • Form completion guidance

            Guidelines:
            - Keep responses focused
            - You CANNOT edit the PDF directly - provide guidance only
            - Include specific code numbers when relevant
            - Remind users to verify information independently

            {form_context}

            User Question: {question}

            Provide a concise, accurate response:
            """
            
            response = self.gemini_model.generate_content(prompt)
            return response.text
            
        except Exception as e:
            return f"Error answering question: {str(e)}"


class PriorAuthorizationAgent:
    """AI agent for prior authorization form selection and guidance."""
    
    def __init__(self):
        self.gemini_model = genai.GenerativeModel("gemini-2.0-flash-exp")
        self.available_states = {
            "alabama": {"display_name": "Alabama", "filename": "alabama_prior_auth.pdf", "path": "forms/alabama_prior_auth.pdf"},
            "alaska": {"display_name": "Alaska", "filename": "alaska_prior_auth.pdf", "path": "forms/alaska_prior_auth.pdf"},
            "arizona": {"display_name": "Arizona", "filename": "arizona_prior_auth.pdf", "path": "forms/arizona_prior_auth.pdf"},
            "california": {"display_name": "California", "filename": "california_prior_auth.pdf", "path": "forms/california_prior_auth.pdf"},
            "texas": {"display_name": "Texas", "filename": "texas_prior_auth.pdf", "path": "forms/texas_prior_auth.pdf"},
            "florida": {"display_name": "Florida", "filename": "florida_prior_auth.pdf", "path": "forms/florida_prior_auth.pdf"},
            "new_york": {"display_name": "New York", "filename": "new_york_prior_auth.pdf", "path": "forms/new_york_prior_auth.pdf"},
            "illinois": {"display_name": "Illinois", "filename": "illinois_prior_auth.pdf", "path": "forms/illinois_prior_auth.pdf"},
            "pennsylvania": {"display_name": "Pennsylvania", "filename": "pennsylvania_prior_auth.pdf", "path": "forms/pennsylvania_prior_auth.pdf"},
            "ohio": {"display_name": "Ohio", "filename": "ohio_prior_auth.pdf", "path": "forms/ohio_prior_auth.pdf"}
        }
    
    def extract_patient_state(self, transcript: str) -> str:
        """Extract patient's state of residence from transcript."""
        try:
            prompt = f"""
            Analyze the following clinical transcript and extract the patient's state of residence.
            Look for mentions of states, cities, or locations that indicate where the patient lives.
            
            Return ONLY the state name in lowercase (e.g., "alabama", "texas", "maryland", "alaska").
            If no state is mentioned or unclear, return "unknown".
            
            Transcript:
            {transcript}
            
            State:
            """
            
            response = self.gemini_model.generate_content(prompt)
            state = response.text.strip().lower()
            
            # Validate that the state is one of our available states
            if state in self.available_states:
                return state
            else:
                return "unknown"
                
        except Exception as e:
            print(f"Error extracting state from transcript: {e}")
            return "unknown"
    
    def search_online_forms(self, state: str) -> List[Dict]:
        """Search for prior authorization forms online for a specific state."""
        try:
            prompt = f"""
            Search for official prior authorization forms for {state.title()} state.
            
            Look for:
            1. State Medicaid prior authorization forms
            2. State health department forms
            3. Official insurance company forms for {state.title()}
            4. Government healthcare forms
            
            Return a JSON list of forms with this structure:
            [
                {{
                    "name": "Form Name",
                    "url": "https://example.com/form.pdf",
                    "source": "State Medicaid",
                    "description": "Brief description",
                    "filename": "suggested_filename.pdf"
                }}
            ]
            
            Only return official, legitimate forms. Focus on government and official insurance sources.
            """
            
            response = self.gemini_model.generate_content(prompt)
            
            # Try to parse the JSON response
            try:
                forms = json.loads(response.text)
                if isinstance(forms, list):
                    return forms[:3]  # Return top 3 results
            except json.JSONDecodeError:
                # If JSON parsing fails, create a basic response
                return [{
                    "name": f"{state.title()} Prior Authorization Form",
                    "url": f"https://www.{state.lower()}.gov/health/prior-auth",
                    "source": f"{state.title()} State Health Department",
                    "description": f"Official prior authorization form for {state.title()}",
                    "filename": f"{state.lower()}_prior_auth.pdf"
                }]
            
            return []
            
        except Exception as e:
            print(f"Error in online search: {e}")
            return []
    
    def generate_guidance(self, state: str, procedure_type: str = "") -> str:
        """Generate guidance for prior authorization requirements for a specific state."""
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
            
            response = self.gemini_model.generate_content(prompt)
            return response.text
            
        except Exception as e:
            return f"Unable to generate guidance for {state.title()}. Please check state-specific requirements."
    
    def select_prior_auth_form(self, patient_state: str, transcript: str = "") -> Dict:
        """Select the appropriate prior auth form based on patient state."""
        # Normalize the state
        state_lower = self._normalize_state(patient_state)
        
        # If state is still unknown, try to extract from transcript
        if state_lower == "unknown" and transcript:
            extracted_state = self.extract_patient_state(transcript)
            if extracted_state != "unknown":
                state_lower = self._normalize_state(extracted_state)
        
        # Check if we have the form locally
        if state_lower in self.available_states:
            form_info = self.available_states[state_lower]
            return {
                "success": True,
                "state": form_info['display_name'],
                "form_filename": form_info['filename'],
                "form_path": form_info['path'],
                "message": f"Found LOCAL prior authorization form for {form_info['display_name']}",
                "available_locally": True,
                "source": "local"
            }
        
        # If not local, search online
        try:
            online_forms = self.search_online_forms(state_lower)
            if online_forms:
                return {
                    "success": True,
                    "state": state_lower.title(),
                    "form_filename": online_forms[0].get('filename', f"{state_lower}_prior_auth.pdf"),
                    "form_url": online_forms[0].get('url'),
                    "message": f"Found ONLINE prior authorization form for {state_lower.title()}",
                    "available_locally": False,
                    "source": "online",
                    "online_forms": online_forms
                }
        except Exception as e:
            print(f"Online search failed: {e}")
        
        # If no form found anywhere
        return {
            "success": False,
            "state": state_lower.title(),
            "message": f"No prior authorization form found for {state_lower.title()}",
            "available_states": list(self.available_states.keys()),
            "available_locally": False,
            "source": "none"
        }
    
    def _normalize_state(self, state: str) -> str:
        """Normalize state name to lowercase and handle abbreviations."""
        if not state:
            return "unknown"
        
        state_lower = state.lower().strip()
        
        # Handle common abbreviations
        state_abbreviations = {
            "al": "alabama", "ak": "alaska", "az": "arizona", "ca": "california",
            "tx": "texas", "fl": "florida", "ny": "new_york", "il": "illinois",
            "pa": "pennsylvania", "oh": "ohio"
        }
        
        if state_lower in state_abbreviations:
            return state_abbreviations[state_lower]
        
        # Handle spaces and underscores
        state_lower = state_lower.replace(" ", "_")
        
        return state_lower


class ContextusAIAgent:
    """AI agent that uses Contextus AI for intelligent queries and insights."""
    
    def __init__(self):
        self.contextus = create_contextus_integration()
    
    def query_patient_data(self, patient_id: str, patient_name: str, doctor_id: str, query: str) -> str:
        """Query patient data using Contextus AI."""
        try:
            # Get patient's project
            project_id = self.contextus.get_patient_project(patient_id, patient_name, doctor_id)
            
            if not project_id:
                return "Patient project not found"
            
            # Query Contextus AI
            response = self.contextus.query_ai_agent(project_id, query)
            return response
            
        except Exception as e:
            return f"Error querying patient data: {str(e)}"
    
    def get_patient_insights(self, patient_id: str, patient_name: str, doctor_id: str) -> Dict:
        """Get AI insights about a patient."""
        try:
            # Get patient's project
            project_id = self.contextus.get_patient_project(patient_id, patient_name, doctor_id)
            
            if not project_id:
                return {"error": "Patient project not found"}
            
            # Get patient context
            context = self.contextus.get_patient_context(project_id)
            
            # Generate insights
            insights = {
                "patient_id": patient_id,
                "patient_name": patient_name,
                "project_id": project_id,
                "billing_patterns": context.get("billing_patterns", {}),
                "common_codes": context.get("common_codes", {}),
                "ai_recommendations": self._generate_recommendations(context)
            }
            
            return insights
            
        except Exception as e:
            return {"error": f"Error getting insights: {str(e)}"}
    
    def _generate_recommendations(self, context: Dict) -> List[str]:
        """Generate AI recommendations based on patient context."""
        recommendations = []
        
        billing_patterns = context.get("billing_patterns", {})
        common_diagnoses = billing_patterns.get("common_diagnoses", {})
        common_procedures = billing_patterns.get("common_procedures", {})
        
        if common_diagnoses:
            top_diagnosis = max(common_diagnoses, key=common_diagnoses.get)
            recommendations.append(f"Consider {top_diagnosis} as a likely diagnosis based on history")
        
        if common_procedures:
            top_procedure = max(common_procedures, key=common_procedures.get)
            recommendations.append(f"Consider {top_procedure} as a likely procedure based on history")
        
        if not recommendations:
            recommendations.append("No specific recommendations available yet - more data needed")
        
        return recommendations


class EnhancedProcessingAgent:
    """AI agent for enhanced processing with Contextus integration."""
    
    def __init__(self):
        self.gemini_model = genai.GenerativeModel("gemini-2.0-flash-exp")
        self.contextus = create_contextus_integration()
    
    def process_with_context(self, transcript: str, patient_id: str, patient_name: str, 
                           doctor_id: str, form_type: str) -> Dict:
        """Process transcript with full Contextus integration."""
        try:
            # Get patient's Contextus project
            project_id = self.contextus.get_patient_project(patient_id, patient_name, doctor_id)
            
            # Get patient context for enhanced processing
            patient_context = self.contextus.get_patient_context(project_id) if project_id else {}
            
            # Create enhanced prompt with full context
            enhanced_prompt = self._create_enhanced_prompt(transcript, form_type, patient_context)
            
            # Process with Gemini
            response = self.gemini_model.generate_content(enhanced_prompt)
            
            # Parse structured data
            structured_data = self._parse_structured_data(response.text)
            
            # Log to Contextus for learning
            if project_id:
                self.contextus.log_transcript_processing(project_id, transcript, structured_data, form_type)
            
            # Calculate AI confidence and insights
            ai_confidence = self.contextus._calculate_confidence(structured_data)
            ai_insights = {
                "confidence": ai_confidence,
                "patient_context_used": bool(patient_context),
                "recommendations": self._generate_processing_recommendations(structured_data, patient_context)
            }
            
            return {
                "success": True,
                "structured_data": structured_data,
                "ai_insights": ai_insights,
                "patient_context": patient_context,
                "project_id": project_id,
                "raw_response": response.text
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _create_enhanced_prompt(self, transcript: str, form_type: str, patient_context: Dict) -> str:
        """Create enhanced prompt with full patient context."""
        base_prompt = f"""
        Extract medical billing information from this transcript for {form_type} form.
        
        Transcript: {transcript}
        
        Return structured JSON with:
        - patient: {{name, dob, insurance_info}}
        - provider: {{name, npi, address}}
        - diagnoses: [{{code, description}}]
        - procedures: [{{code, description, date}}]
        - date_of_service: "YYYY-MM-DD"
        """
        
        # Add comprehensive Contextus context
        if patient_context:
            billing_patterns = patient_context.get("billing_patterns", {})
            common_codes = patient_context.get("common_codes", {})
            
            context_enhancement = f"""
            
            PATIENT CONTEXT FROM AI SECOND BRAIN:
            - Previous common diagnoses: {list(billing_patterns.get('common_diagnoses', {}).keys())[:5]}
            - Previous common procedures: {list(billing_patterns.get('common_procedures', {}).keys())[:5]}
            - Common ICD-10 codes: {list(common_codes.get('icd10', {}).keys())[:5]}
            - Common CPT codes: {list(common_codes.get('cpt', {}).keys())[:5]}
            
            Use this context to:
            1. Ensure consistency with previous billing patterns
            2. Apply learned preferences for this patient
            3. Suggest additional codes based on historical data
            4. Maintain continuity in medical coding approach
            """
            base_prompt += context_enhancement
        
        return base_prompt
    
    def _parse_structured_data(self, response_text: str) -> Dict:
        """Parse structured data from Gemini response."""
        try:
            # Try to extract JSON from response
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                json_text = response_text[json_start:json_end].strip()
            elif "{" in response_text and "}" in response_text:
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                json_text = response_text[json_start:json_end]
            else:
                # Fallback: create basic structure
                return {
                    "patient": {"name": "Unknown", "dob": "", "insurance_info": {}},
                    "provider": {"name": "Unknown", "npi": "", "address": {}},
                    "diagnoses": [],
                    "procedures": [],
                    "date_of_service": ""
                }
            
            return json.loads(json_text)
        except json.JSONDecodeError:
            # Fallback structure if JSON parsing fails
            return {
                "patient": {"name": "Unknown", "dob": "", "insurance_info": {}},
                "provider": {"name": "Unknown", "npi": "", "address": {}},
                "diagnoses": [],
                "procedures": [],
                "date_of_service": ""
            }
    
    def _generate_processing_recommendations(self, structured_data: Dict, patient_context: Dict) -> List[str]:
        """Generate processing recommendations based on data and context."""
        recommendations = []
        
        # Check for missing data
        if not structured_data.get("patient", {}).get("name"):
            recommendations.append("Patient name not found - verify transcript quality")
        
        if not structured_data.get("provider", {}).get("name"):
            recommendations.append("Provider name not found - verify transcript quality")
        
        # Check diagnosis/procedure counts
        diagnoses = structured_data.get("diagnoses", [])
        procedures = structured_data.get("procedures", [])
        
        if not diagnoses:
            recommendations.append("No diagnoses found - consider reviewing transcript")
        
        if not procedures:
            recommendations.append("No procedures found - consider reviewing transcript")
        
        # Add context-based recommendations
        if patient_context:
            billing_patterns = patient_context.get("billing_patterns", {})
            common_diagnoses = billing_patterns.get("common_diagnoses", {})
            
            if common_diagnoses:
                top_diagnosis = max(common_diagnoses, key=common_diagnoses.get)
                recommendations.append(f"Consider {top_diagnosis} based on patient history")
        
        return recommendations


# Agent Factory Functions
def create_medical_billing_agent() -> MedicalBillingAgent:
    """Create a medical billing agent."""
    return MedicalBillingAgent()

def create_speaker_identification_agent() -> SpeakerIdentificationAgent:
    """Create a speaker identification agent."""
    return SpeakerIdentificationAgent()

def create_cms_assistant_agent() -> CMSAssistantAgent:
    """Create a CMS assistant agent."""
    return CMSAssistantAgent()

def create_prior_authorization_agent() -> PriorAuthorizationAgent:
    """Create a prior authorization agent."""
    return PriorAuthorizationAgent()

def create_contextus_ai_agent() -> ContextusAIAgent:
    """Create a Contextus AI agent."""
    return ContextusAIAgent()

def create_enhanced_processing_agent() -> EnhancedProcessingAgent:
    """Create an enhanced processing agent."""
    return EnhancedProcessingAgent()