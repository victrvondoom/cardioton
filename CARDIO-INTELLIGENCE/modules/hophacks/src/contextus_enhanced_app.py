"""
Enhanced ScribeMD Application with Contextus Integration
AI Second Brain for Medical Billing Projects
"""

import json
import os
from flask import Flask, request, jsonify, render_template
from contextus_integration import ContextusIntegration
from app import app, model, get_form_specific_prompt, enhance_medical_codes, fix_form_specific_data_issues

# Initialize Contextus integration
CONTEXTUS_COLLECTION_ID = os.getenv("CONTEXTUS_COLLECTION_ID", "your-collection-id-here")
contextus = ContextusIntegration(collection_id=CONTEXTUS_COLLECTION_ID)

class ContextusEnhancedScribeMD:
    """
    Enhanced ScribeMD with Contextus AI Second Brain capabilities.
    Each patient gets their own AI context and learning.
    """
    
    def __init__(self):
        self.contextus = contextus
        self.patient_projects = {}  # Cache patient project IDs
    
    def get_patient_project(self, patient_id: str, patient_name: str, doctor_id: str) -> str:
        """Get or create a Contextus project for a patient."""
        if patient_id not in self.patient_projects:
            project_id = self.contextus.create_patient_project(patient_id, patient_name, doctor_id)
            if project_id:
                self.patient_projects[patient_id] = project_id
        return self.patient_projects.get(patient_id)
    
    def process_transcript_with_context(self, transcript: str, form_type: str, patient_id: str, patient_name: str, doctor_id: str) -> dict:
        """
        Process transcript with Contextus AI context and learning.
        This is the enhanced version of the original generate_claim function.
        """
        try:
            # Get patient's AI context
            project_id = self.get_patient_project(patient_id, patient_name, doctor_id)
            patient_context = self.contextus.get_patient_context() if project_id else {}
            
            # Enhance the prompt with patient context
            enhanced_prompt = self._create_context_aware_prompt(transcript, form_type, patient_context)
            
            # Generate content with Gemini AI
            response = model.generate_content(enhanced_prompt)
            content = self._extract_response_content(response)
            
            if not content:
                return {"error": "No content in AI response"}
            
            # Parse structured data
            structured_data = self._parse_structured_data(content)
            if not structured_data:
                return {"error": "Failed to extract structured data from AI response"}
            
            # Enhance with medical codes using patient history
            structured_data = self._enhance_with_patient_history(structured_data, patient_context)
            structured_data = enhance_medical_codes(structured_data, transcript)
            structured_data = fix_form_specific_data_issues(structured_data, form_type)
            
            # Log to Contextus for learning
            if project_id:
                self.contextus.log_transcript_processing(transcript, structured_data, form_type)
            
            return {
                "success": True,
                "structured_data": structured_data,
                "patient_context": patient_context,
                "ai_insights": self._generate_ai_insights(structured_data, patient_context)
            }
            
        except Exception as e:
            return {"error": f"Processing error: {str(e)}"}
    
    def _create_context_aware_prompt(self, transcript: str, form_type: str, patient_context: dict) -> str:
        """Create an AI prompt enhanced with patient context from Contextus."""
        base_prompt = get_form_specific_prompt(form_type, transcript)
        
        # Add patient context to the prompt
        context_enhancement = ""
        if patient_context:
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
        
        return base_prompt + context_enhancement
    
    def _enhance_with_patient_history(self, structured_data: dict, patient_context: dict) -> dict:
        """Enhance structured data using patient's historical context."""
        if not patient_context:
            return structured_data
        
        billing_patterns = patient_context.get("billing_patterns", {})
        common_diagnoses = billing_patterns.get("common_diagnoses", {})
        common_procedures = billing_patterns.get("common_procedures", {})
        
        # Enhance diagnoses with historical patterns
        if "diagnoses" in structured_data:
            for diagnosis in structured_data["diagnoses"]:
                if not diagnosis.get("code") and diagnosis.get("description"):
                    # Try to find a similar diagnosis from history
                    desc_lower = diagnosis["description"].lower()
                    for hist_code, count in common_diagnoses.items():
                        if any(word in desc_lower for word in hist_code.lower().split()):
                            diagnosis["code"] = hist_code
                            diagnosis["confidence"] = "historical_pattern"
                            break
        
        # Enhance procedures with historical patterns
        if "procedures" in structured_data:
            for procedure in structured_data["procedures"]:
                if not procedure.get("code") and procedure.get("description"):
                    # Try to find a similar procedure from history
                    desc_lower = procedure["description"].lower()
                    for hist_code, count in common_procedures.items():
                        if any(word in desc_lower for word in hist_code.lower().split()):
                            procedure["code"] = hist_code
                            procedure["confidence"] = "historical_pattern"
                            break
        
        return structured_data
    
    def _generate_ai_insights(self, structured_data: dict, patient_context: dict) -> dict:
        """Generate AI insights based on current processing and patient history."""
        insights = {
            "processing_confidence": self._calculate_confidence(structured_data),
            "recommendations": [],
            "warnings": [],
            "learning_opportunities": []
        }
        
        # Analyze confidence
        confidence = insights["processing_confidence"]
        if confidence < 0.7:
            insights["warnings"].append("Low confidence in AI processing - manual review recommended")
        
        # Check for missing critical data
        if not structured_data.get("patient", {}).get("name"):
            insights["warnings"].append("Patient name missing - may need manual input")
        
        if not structured_data.get("provider", {}).get("name"):
            insights["warnings"].append("Provider information incomplete")
        
        # Generate recommendations based on patient history
        if patient_context:
            billing_patterns = patient_context.get("billing_patterns", {})
            if billing_patterns.get("common_diagnoses"):
                insights["recommendations"].append("Consider adding commonly used diagnoses for this patient")
            
            if billing_patterns.get("common_procedures"):
                insights["recommendations"].append("Review historical procedures for completeness")
        
        # Learning opportunities
        diagnoses = structured_data.get("diagnoses", [])
        procedures = structured_data.get("procedures", [])
        
        if len(diagnoses) > 3:
            insights["learning_opportunities"].append("Complex case with multiple diagnoses - good learning data")
        
        if any(p.get("code") for p in procedures):
            insights["learning_opportunities"].append("Successful procedure coding - pattern can be reinforced")
        
        return insights
    
    def _calculate_confidence(self, structured_data: dict) -> float:
        """Calculate confidence score for the processing results."""
        confidence_factors = []
        
        # Check required fields
        required_fields = ["patient", "provider", "diagnoses", "procedures"]
        populated_fields = sum(1 for field in required_fields if structured_data.get(field))
        confidence_factors.append(populated_fields / len(required_fields))
        
        # Check medical codes
        diagnoses = structured_data.get("diagnoses", [])
        procedures = structured_data.get("procedures", [])
        
        if diagnoses:
            coded_diagnoses = sum(1 for d in diagnoses if d.get("code"))
            confidence_factors.append(coded_diagnoses / len(diagnoses))
        
        if procedures:
            coded_procedures = sum(1 for p in procedures if p.get("code"))
            confidence_factors.append(coded_procedures / len(procedures))
        
        return sum(confidence_factors) / len(confidence_factors) if confidence_factors else 0.0
    
    def _extract_response_content(self, response) -> str:
        """Extract content from Gemini response."""
        if hasattr(response, 'text'):
            return response.text
        elif hasattr(response, "candidates") and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, "content") and candidate.content:
                if hasattr(candidate.content, 'parts') and candidate.content.parts:
                    return candidate.content.parts[0].text
                elif hasattr(candidate.content, 'text'):
                    return candidate.content.text
        return str(response)
    
    def _parse_structured_data(self, content: str) -> dict:
        """Parse structured data from AI response."""
        try:
            start_idx = content.find("{")
            end_idx = content.rfind("}") + 1
            if start_idx != -1 and end_idx != -1:
                json_str = content[start_idx:end_idx]
                return json.loads(json_str)
        except (json.JSONDecodeError, ValueError):
            pass
        return None

# Initialize the enhanced ScribeMD
enhanced_scribemd = ContextusEnhancedScribeMD()

# Enhanced API endpoints
@app.route("/api/enhanced-generate-claim", methods=["POST"])
def enhanced_generate_claim():
    """
    Enhanced claim generation with Contextus AI Second Brain.
    Provides context-aware processing and learning.
    """
    try:
        data = request.get_json()
        transcript = data.get("transcript", "")
        form_type = data.get("form_type", "tricare")
        patient_id = data.get("patient_id", "default_patient")
        patient_name = data.get("patient_name", "Unknown Patient")
        doctor_id = data.get("doctor_id", "default_doctor")
        
        if not transcript:
            return jsonify({"error": "No transcript provided"}), 400
        
        # Process with Contextus enhancement
        result = enhanced_scribemd.process_transcript_with_context(
            transcript, form_type, patient_id, patient_name, doctor_id
        )
        
        if "error" in result:
            return jsonify(result), 500
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": f"Enhanced processing error: {str(e)}"}), 500

@app.route("/api/patient-context/<patient_id>")
def get_patient_context(patient_id):
    """Get AI context for a specific patient."""
    try:
        project_id = enhanced_scribemd.patient_projects.get(patient_id)
        if not project_id:
            return jsonify({"error": "Patient project not found"}), 404
        
        context = enhanced_scribemd.contextus.get_patient_context()
        return jsonify(context)
        
    except Exception as e:
        return jsonify({"error": f"Error retrieving context: {str(e)}"}), 500

@app.route("/api/ai-agent-query", methods=["POST"])
def query_ai_agent():
    """Query the AI agent with natural language."""
    try:
        data = request.get_json()
        query = data.get("query", "")
        patient_id = data.get("patient_id", "")
        
        if not query:
            return jsonify({"error": "No query provided"}), 400
        
        if patient_id and patient_id in enhanced_scribemd.patient_projects:
            project_id = enhanced_scribemd.patient_projects[patient_id]
            enhanced_scribemd.contextus.project_id = project_id
        
        response = enhanced_scribemd.contextus.query_ai_agent(query)
        return jsonify({"response": response})
        
    except Exception as e:
        return jsonify({"error": f"AI agent query error: {str(e)}"}), 500

@app.route("/api/ai-insights/<patient_id>")
def get_ai_insights(patient_id):
    """Get AI insights and recommendations for a patient."""
    try:
        project_id = enhanced_scribemd.patient_projects.get(patient_id)
        if not project_id:
            return jsonify({"error": "Patient project not found"}), 404
        
        context = enhanced_scribemd.contextus.get_patient_context()
        insights = {
            "billing_patterns": context.get("billing_patterns", {}),
            "common_codes": context.get("common_codes", {}),
            "total_transcripts": context.get("metadata", {}).get("total_transcripts", 0),
            "success_rate": context.get("billing_patterns", {}).get("success_rate", 0.0)
        }
        
        return jsonify(insights)
        
    except Exception as e:
        return jsonify({"error": f"Error retrieving insights: {str(e)}"}), 500

if __name__ == "__main__":
    print("🤖 Enhanced ScribeMD with Contextus AI Second Brain")
    print("=" * 60)
    print("Features:")
    print("✅ AI Second Brain for each patient")
    print("✅ Context-aware medical coding")
    print("✅ Learning from historical data")
    print("✅ AI agent queries")
    print("✅ Intelligent insights and recommendations")
    print("=" * 60)
    print("Make sure to set CONTEXTUS_COLLECTION_ID environment variable")
    print("Get your collection ID from: https://www.contextus.space/login")
    print("=" * 60)
    
    app.run(debug=True, host="0.0.0.0", port=5000)
