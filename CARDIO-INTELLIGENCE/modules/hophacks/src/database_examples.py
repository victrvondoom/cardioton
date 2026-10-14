# Example Usage of New Database Structure

from database import Database
import json

# Initialize database
db = Database()

# Example: Creating a doctor
doctor_info = {
    "specialty": "Internal Medicine",
    "license_number": "MD123456",
    "practice_name": "Downtown Medical Center",
    "phone": "(555) 123-4567"
}

doctor_id = db.create_doctor("drsmith", "dr.smith@example.com", "password123", doctor_info)
print(f"Created doctor with ID: {doctor_id}")

# Example: Adding a patient
patient_info = {
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "1980-05-15",
    "phone": "(555) 987-6543",
    "email": "john.doe@email.com",
    "insurance": {
        "provider": "Blue Cross",
        "policy_number": "BC123456789",
        "group_number": "GRP001"
    },
    "address": {
        "street": "123 Main St",
        "city": "Anytown",
        "state": "CA",
        "zip": "12345"
    },
    "emergency_contact": {
        "name": "Jane Doe",
        "relationship": "Spouse",
        "phone": "(555) 987-6544"
    }
}

patient_id = db.add_patient(doctor_id, patient_info, "/path/to/profile/image.jpg")
print(f"Added patient with ID: {patient_id}")

# Example: Adding a visit
transcript = """
Doctor: Good morning, Mr. Doe. How are you feeling today?
Patient: Good morning, Doctor. I've been having some chest pain and shortness of breath.
Doctor: When did this start?
Patient: About 3 days ago. It gets worse when I climb stairs.
Doctor: Let me listen to your heart and lungs. [Performs examination]
Doctor: I'm going to order an EKG and chest X-ray to rule out any cardiac issues.
Patient: Okay, should I be worried?
Doctor: Let's get the tests done first and we'll discuss the results.
"""

visit_id = db.add_visit(patient_id, transcript, "/path/to/generated/form.pdf")
print(f"Added visit with ID: {visit_id}")

# Example: Retrieving data
doctor_patients = db.get_doctor_patients(doctor_id)
print(f"Doctor has {len(doctor_patients)} patients")

patient_visits = db.get_patient_visits(patient_id)
print(f"Patient has {len(patient_visits)} visits")

recent_visits = db.get_doctor_recent_visits(doctor_id, limit=5)
print(f"Doctor's {len(recent_visits)} most recent visits across all patients")

print("Database structure examples completed!")