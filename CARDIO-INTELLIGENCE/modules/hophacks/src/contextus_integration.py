#!/usr/bin/env python3
"""
Contextus AI Second Brain Integration for ScribeMD
Provides AI-powered learning and context-aware processing capabilities.
"""

import os
import requests
from datetime import datetime
from typing import Dict, List, Optional


class ContextusIntegration:
    """Contextus integration for AI Second Brain capabilities."""
    
    def __init__(self, collection_id: str, base_url: str = "https://www.contextus.space"):
        self.base_url = base_url
        self.collection_id = collection_id
        self.patient_projects = {}  # Cache patient project IDs
    
    def get_patient_project(self, patient_id: str, patient_name: str, doctor_id: str) -> str:
        """Get or create a Contextus project for a patient."""
        if patient_id not in self.patient_projects:
            project_id = self.create_patient_project(patient_id, patient_name, doctor_id)
            if project_id:
                self.patient_projects[patient_id] = project_id
        return self.patient_projects.get(patient_id)
    
    def create_patient_project(self, patient_id: str, patient_name: str, doctor_id: str) -> str:
        """Create a Contextus project for a specific patient."""
        project_data = {
            "collection_id": self.collection_id,
            "label": f"Medical Billing - {patient_name}",
            "metadata": {
                "patient_id": patient_id,
                "patient_name": patient_name,
                "doctor_id": doctor_id,
                "created_at": datetime.now().isoformat(),
                "project_type": "medical_billing",
                "status": "active"
            },
            "artifacts": [{
                "type": "patient_profile",
                "title": f"Patient Profile - {patient_name}",
                "data": {
                    "patient_id": patient_id,
                    "name": patient_name,
                    "doctor_id": doctor_id,
                    "billing_history": [],
                    "common_diagnoses": [],
                    "common_procedures": []
                }
            }]
        }
        
        try:
            response = requests.post(f"{self.base_url}/v1/projects", json=project_data)
            response.raise_for_status()
            result = response.json()
            return result.get("project_id")
        except requests.RequestException as e:
            print(f"Error creating Contextus project: {e}")
            return None
    
    def log_transcript_processing(self, project_id: str, transcript: str, structured_data: dict, form_type: str) -> bool:
        """Log a transcript processing session to Contextus."""
        if not project_id:
            return False
            
        processing_artifact = {
            "type": "transcript_processing",
            "title": f"Transcript Processing - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "data": {
                "timestamp": datetime.now().isoformat(),
                "form_type": form_type,
                "transcript_preview": transcript[:200] + "..." if len(transcript) > 200 else transcript,
                "structured_data": structured_data,
                "ai_confidence": self._calculate_confidence(structured_data),
                "processing_notes": self._generate_processing_notes(structured_data)
            }
        }
        
        metadata_update = {
            "last_processing": datetime.now().isoformat(),
            "total_transcripts": 1,  # Simplified for now
            "form_types": [form_type]
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/v1/projects/{project_id}/write",
                json={
                    "metadata": metadata_update,
                    "artifacts": [processing_artifact]
                }
            )
            response.raise_for_status()
            
            # Notify all agents about learning update
            self._notify_agents_learning_update(project_id, structured_data, form_type)
            
            return True
        except requests.RequestException as e:
            print(f"Error logging to Contextus: {e}")
            return False
    
    def _notify_agents_learning_update(self, project_id: str, structured_data: dict, form_type: str):
        """Notify all agents about Contextus learning updates."""
        try:
            from agent_communication import create_agent_communicator, MessageType
            
            # Extract learning patterns
            billing_patterns = self._extract_billing_patterns_from_data(structured_data)
            common_codes = self._extract_common_codes_from_data(structured_data)
            
            # Send learning update to all agents
            contextus_agent = create_agent_communicator("ContextusAgent")
            contextus_agent.send_message(
                MessageType.CONTEXTUS_LEARNING_UPDATE,
                {
                    'project_id': project_id,
                    'form_type': form_type,
                    'new_patterns': billing_patterns,
                    'common_codes': common_codes,
                    'confidence_scores': {
                        'diagnosis': len(structured_data.get('diagnoses', [])),
                        'procedures': len(structured_data.get('procedures', []))
                    },
                    'timestamp': datetime.now().isoformat()
                }
            )
        except Exception as e:
            print(f"Error notifying agents about learning update: {e}")
    
    def _extract_billing_patterns_from_data(self, structured_data: dict) -> dict:
        """Extract billing patterns from current structured data."""
        patterns = {
            "common_diagnoses": {},
            "common_procedures": {},
            "success_rate": 0.0
        }
        
        # Count diagnoses
        for diagnosis in structured_data.get("diagnoses", []):
            code = diagnosis.get("code")
            if code:
                patterns["common_diagnoses"][code] = patterns["common_diagnoses"].get(code, 0) + 1
        
        # Count procedures
        for procedure in structured_data.get("procedures", []):
            code = procedure.get("code")
            if code:
                patterns["common_procedures"][code] = patterns["common_procedures"].get(code, 0) + 1
        
        return patterns
    
    def _extract_common_codes_from_data(self, structured_data: dict) -> dict:
        """Extract common codes from current structured data."""
        codes = {
            "icd10": {},
            "cpt": {}
        }
        
        # Extract ICD-10 codes
        for diagnosis in structured_data.get("diagnoses", []):
            code = diagnosis.get("code")
            if code and code.startswith(("A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z")):
                codes["icd10"][code] = codes["icd10"].get(code, 0) + 1
        
        # Extract CPT codes
        for procedure in structured_data.get("procedures", []):
            code = procedure.get("code")
            if code and code.isdigit():
                codes["cpt"][code] = codes["cpt"].get(code, 0) + 1
        
        return codes
    
    def get_patient_context(self, project_id: str) -> dict:
        """Retrieve patient's medical billing context from Contextus."""
        if not project_id:
            return {}
            
        try:
            print(f"DEBUG: Getting context for project_id: {project_id}")
            
            # Get metadata
            metadata_response = requests.get(f"{self.base_url}/v1/projects/{project_id}/metadata")
            metadata = metadata_response.json() if metadata_response.status_code == 200 else {}
            print(f"DEBUG: Metadata type: {type(metadata)}, content: {metadata}")
            
            # Get artifacts
            artifacts_response = requests.get(f"{self.base_url}/v1/projects/{project_id}/artifacts")
            artifacts = artifacts_response.json() if artifacts_response.status_code == 200 else []
            print(f"DEBUG: Artifacts type: {type(artifacts)}, length: {len(artifacts) if isinstance(artifacts, list) else 'not a list'}")
            
            # Extract patterns and codes
            try:
                billing_patterns = self._extract_billing_patterns(artifacts)
                print(f"DEBUG: Billing patterns type: {type(billing_patterns)}, content: {billing_patterns}")
            except Exception as e:
                print(f"ERROR extracting billing patterns: {e}")
                import traceback
                print(f"Billing patterns error traceback: {traceback.format_exc()}")
                billing_patterns = {}
            
            try:
                common_codes = self._extract_common_codes(artifacts)
                print(f"DEBUG: Common codes type: {type(common_codes)}, content: {common_codes}")
            except Exception as e:
                print(f"ERROR extracting common codes: {e}")
                import traceback
                print(f"Common codes error traceback: {traceback.format_exc()}")
                common_codes = {}
            
            return {
                "metadata": metadata,
                "artifacts": artifacts,
                "billing_patterns": billing_patterns,
                "common_codes": common_codes
            }
        except requests.RequestException as e:
            print(f"Error retrieving Contextus context: {e}")
            import traceback
            print(f"Contextus request error traceback: {traceback.format_exc()}")
            return {}
    
    def query_ai_agent(self, project_id: str, query: str) -> str:
        """Query the AI agent with natural language."""
        if not project_id:
            return "No project context available"
            
        try:
            response = requests.post(
                f"{self.base_url}/v1/projects/{project_id}/query",
                json={"q": query}
            )
            response.raise_for_status()
            result = response.json()
            return result.get("response", "No response from AI agent")
        except requests.RequestException as e:
            print(f"Error querying AI agent: {e}")
            return f"Error: {e}"
    
    def _calculate_confidence(self, structured_data: dict) -> float:
        """Calculate confidence score for AI processing results."""
        confidence_factors = []
        
        # Check if required fields are populated
        required_fields = ["patient", "provider", "diagnoses", "procedures"]
        populated_fields = sum(1 for field in required_fields if structured_data.get(field))
        confidence_factors.append(populated_fields / len(required_fields))
        
        # Check if medical codes are present
        diagnoses = structured_data.get("diagnoses", [])
        procedures = structured_data.get("procedures", [])
        
        if diagnoses:
            coded_diagnoses = sum(1 for d in diagnoses if d.get("code"))
            confidence_factors.append(coded_diagnoses / len(diagnoses))
        
        if procedures:
            coded_procedures = sum(1 for p in procedures if p.get("code"))
            confidence_factors.append(coded_procedures / len(procedures))
        
        return sum(confidence_factors) / len(confidence_factors) if confidence_factors else 0.0
    
    def _generate_processing_notes(self, structured_data: dict) -> str:
        """Generate human-readable notes about the AI processing."""
        notes = []
        
        diagnoses = structured_data.get("diagnoses", [])
        procedures = structured_data.get("procedures", [])
        
        if diagnoses:
            notes.append(f"Extracted {len(diagnoses)} diagnosis(es)")
        
        if procedures:
            notes.append(f"Extracted {len(procedures)} procedure(s)")
        
        # Check for missing data
        if not structured_data.get("patient", {}).get("name"):
            notes.append("Warning: Patient name not found")
        
        if not structured_data.get("provider", {}).get("name"):
            notes.append("Warning: Provider name not found")
        
        return "; ".join(notes) if notes else "Processing completed successfully"
    
    def _extract_billing_patterns(self, artifacts: list) -> dict:
        """Extract billing patterns from historical data."""
        patterns = {
            "common_diagnoses": {},
            "common_procedures": {},
            "average_processing_time": 0,
            "success_rate": 0.0
        }
        
        # Analyze artifacts to find patterns
        for artifact in artifacts:
            if artifact.get("type") == "transcript_processing":
                data = artifact.get("data", {})
                structured_data = data.get("structured_data", {})
                
                # Count diagnoses
                for diagnosis in structured_data.get("diagnoses", []):
                    code = diagnosis.get("code")
                    if code:
                        patterns["common_diagnoses"][code] = patterns["common_diagnoses"].get(code, 0) + 1
                
                # Count procedures
                for procedure in structured_data.get("procedures", []):
                    code = procedure.get("code")
                    if code:
                        patterns["common_procedures"][code] = patterns["common_procedures"].get(code, 0) + 1
        
        return patterns
    
    def _extract_common_codes(self, artifacts: list) -> dict:
        """Extract commonly used medical codes."""
        codes = {
            "icd10": {},
            "cpt": {}
        }
        
        for artifact in artifacts:
            if artifact.get("type") == "transcript_processing":
                data = artifact.get("data", {})
                structured_data = data.get("structured_data", {})
                
                # Extract ICD-10 codes
                for diagnosis in structured_data.get("diagnoses", []):
                    code = diagnosis.get("code")
                    if code and code.startswith(("A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z")):
                        codes["icd10"][code] = codes["icd10"].get(code, 0) + 1
                
                # Extract CPT codes
                for procedure in structured_data.get("procedures", []):
                    code = procedure.get("code")
                    if code and code.isdigit():
                        codes["cpt"][code] = codes["cpt"].get(code, 0) + 1
        
        return codes


def create_contextus_integration() -> ContextusIntegration:
    """Create and return a ContextusIntegration instance."""
    collection_id = os.getenv("CONTEXTUS_COLLECTION_ID", "a13ca4cd-5320-41cd-9e80-fed01107c729")
    return ContextusIntegration(collection_id=collection_id)