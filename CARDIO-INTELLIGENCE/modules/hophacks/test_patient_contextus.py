#!/usr/bin/env python3
"""
Test Contextus project creation for different patients by the same doctor
"""

from src.contextus_integration import create_contextus_integration

def test_patient_contextus_creation():
    """Test that each patient gets their own Contextus project."""
    
    print("🧪 Testing Patient-Specific Contextus Project Creation")
    print("=" * 60)
    
    # Initialize Contextus integration
    contextus = create_contextus_integration()
    
    # Simulate a doctor processing transcripts for different patients
    doctor_id = "doc_001"
    
    patients = [
        {"patient_id": "patient_001", "patient_name": "Alice Johnson"},
        {"patient_id": "patient_002", "patient_name": "Bob Wilson"},
        {"patient_id": "patient_003", "patient_name": "Carol Davis"},
        {"patient_id": "patient_004", "patient_name": "David Brown"},
    ]
    
    print(f"👨‍⚕️ Doctor ID: {doctor_id}")
    print(f"👥 Processing {len(patients)} patients...")
    print()
    
    for i, patient in enumerate(patients, 1):
        print(f"{i}️⃣ Processing {patient['patient_name']} (ID: {patient['patient_id']})")
        
        try:
            # Get or create Contextus project for this patient
            project_id = contextus.get_patient_project(
                patient_id=patient["patient_id"],
                patient_name=patient["patient_name"],
                doctor_id=doctor_id
            )
            
            if project_id:
                print(f"   ✅ Contextus project created: {project_id}")
                
                # Simulate logging a transcript processing
                transcript = f"Doctor: How are you feeling today, {patient['patient_name']}? Patient: I'm doing well, thank you."
                structured_data = {
                    "patient": {"name": patient["patient_name"]},
                    "provider": {"name": "Dr. Smith"},
                    "diagnoses": [{"code": "Z00.00", "description": "Encounter for general adult medical examination"}],
                    "procedures": [{"code": "99213", "description": "Office visit"}]
                }
                
                success = contextus.log_transcript_processing(
                    project_id=project_id,
                    transcript=transcript,
                    structured_data=structured_data,
                    form_type="cms1500"
                )
                
                if success:
                    print(f"   ✅ Transcript logged successfully")
                else:
                    print(f"   ❌ Failed to log transcript")
                    
            else:
                print(f"   ❌ Failed to create Contextus project")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        print()
    
    print("🎯 Summary:")
    print("   - Each patient should have their own Contextus project")
    print("   - Doctor processes transcripts for different patients")
    print("   - Each patient gets their own AI Second Brain")
    print("   - Check your Contextus collection to see all patient projects!")

if __name__ == "__main__":
    test_patient_contextus_creation()
