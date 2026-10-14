import os
import secrets
from datetime import datetime, timedelta

import bcrypt
from bson.objectid import ObjectId
from pymongo import MongoClient


class Database:
    def __init__(self):
        # MongoDB connection - you can use MongoDB Atlas free tier or local MongoDB
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/scribemd")
        self.client = MongoClient(mongo_uri)
        try:
            # Add connection timeout and server selection timeout
            self.client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=5000,  # 5 second timeout
                connectTimeoutMS=5000,  # 5 second connection timeout
                socketTimeoutMS=5000,  # 5 second socket timeout
            )

            # Test the connection immediately
            self.client.admin.command("ping")
            print("MongoDB connection successful!")

        except Exception as e:
            print(f"MongoDB connection failed: {e}")
            raise

        self.db = self.client.scribemd

        # Collections
        self.doctors = self.db.doctors  # Renamed from users to doctors
        self.sessions = self.db.sessions
        self.patients = self.db.patients
        self.visits = self.db.visits

    def create_doctor(self, username, email, password, additional_info=None):
        """Create a new doctor with hashed password"""
        # Check if doctor already exists
        if self.doctors.find_one({"$or": [{"username": username}, {"email": email}]}):
            return None

        # Hash password
        hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

        doctor_data = {
            "username": username,
            "email": email,
            "password": hashed_password,
            "additional_info": additional_info
            or {},  # JSON field for extra doctor info
            "created_at": datetime.utcnow(),
            "last_login": None,
        }

        result = self.doctors.insert_one(doctor_data)
        return str(result.inserted_id)

    def verify_doctor(self, username, password):
        """Verify doctor credentials"""
        doctor = self.doctors.find_one({"username": username})
        if doctor and bcrypt.checkpw(password.encode("utf-8"), doctor["password"]):
            # Update last login
            self.doctors.update_one(
                {"_id": doctor["_id"]}, {"$set": {"last_login": datetime.utcnow()}}
            )
            return doctor
        return None

    def create_session(self, doctor_id, selected_patient_id=None):
        """Create a new session for doctor"""
        session_token = secrets.token_urlsafe(32)
        session_data = {
            "doctor_id": ObjectId(doctor_id),
            "selected_patient_id": (
                ObjectId(selected_patient_id) if selected_patient_id else None
            ),
            "token": session_token,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(days=7),  # 7-day expiration
        }

        self.sessions.insert_one(session_data)
        return session_token

    def update_session_patient(self, session_token, patient_id):
        """Update the selected patient for a session"""
        session = self.sessions.find_one({"token": session_token})
        if session and session.get("selected_patient_id") == ObjectId(patient_id):
            return True  # Patient is already selected

        result = self.sessions.update_one(
            {"token": session_token},
            {"$set": {"selected_patient_id": ObjectId(patient_id)}},
        )
        return result.modified_count > 0

    def get_session_info(self, session_token):
        """Get full session info including doctor and selected patient"""
        session = self.sessions.find_one(
            {"token": session_token, "expires_at": {"$gt": datetime.utcnow()}}
        )

        if session:
            doctor = self.doctors.find_one({"_id": session["doctor_id"]})
            selected_patient = None
            if session.get("selected_patient_id"):
                selected_patient = self.patients.find_one(
                    {"_id": session["selected_patient_id"]}
                )

            return {
                "doctor": doctor,
                "selected_patient": selected_patient,
                "session": session,
            }
        return None

    def get_doctor_from_session(self, session_token):
        """Get doctor from session token"""
        session = self.sessions.find_one(
            {"token": session_token, "expires_at": {"$gt": datetime.utcnow()}}
        )

        if session:
            doctor = self.doctors.find_one({"_id": session["doctor_id"]})
            return doctor
        return None

    def delete_session(self, session_token):
        """Delete a session (logout)"""
        self.sessions.delete_one({"token": session_token})

    # Provider Information Management
    def update_doctor_provider_info(self, doctor_id, provider_info):
        """Update provider information for a doctor"""
        result = self.doctors.update_one(
            {"_id": ObjectId(doctor_id)},
            {"$set": {"additional_info": provider_info}}
        )
        return result.modified_count > 0

    def get_doctor_provider_info(self, doctor_id):
        """Get provider information for a doctor"""
        doctor = self.doctors.find_one({"_id": ObjectId(doctor_id)})
        if doctor:
            return doctor.get("additional_info", {})
        return {}

    # Patient Management
    def add_patient(self, doctor_id, patient_info, profile_image_path=None):
        """Add a new patient for a doctor"""
        patient_data = {
            "doctor_id": ObjectId(doctor_id),
            "patient_info": patient_info,  # JSON object with patient details
            "profile_image": profile_image_path,  # Path to profile image file
            "created_at": datetime.utcnow(),
            "last_updated": datetime.utcnow(),
        }

        result = self.patients.insert_one(patient_data)
        return str(result.inserted_id)

    def get_doctor_patients(self, doctor_id):
        """Get all patients for a doctor"""
        return list(
            self.patients.find({"doctor_id": ObjectId(doctor_id)}).sort(
                "last_updated", -1
            )
        )

    def get_patient(self, patient_id):
        """Get a specific patient by ID"""
        return self.patients.find_one({"_id": ObjectId(patient_id)})

    def search_patients(self, doctor_id, search_term, limit=10):
        """Search patients by name for a specific doctor"""
        if not search_term:
            return []

        # Create a case-insensitive regex pattern
        pattern = {"$regex": search_term, "$options": "i"}

        # Search in patient_info fields (assuming name fields exist)
        query = {
            "doctor_id": ObjectId(doctor_id),
            "$or": [
                {"patient_info.first_name": pattern},
                {"patient_info.last_name": pattern},
                {"patient_info.full_name": pattern},
                {"patient_info.name": pattern},
            ],
        }

        return list(self.patients.find(query).limit(limit))

    # Visit Management
    def add_visit(
        self,
        patient_id,
        transcript_text,
        form_type="cms1500",  # Default to cms1500 for backward compatibility
        form_pdf_path=None,
        structured_data=None,
        pdf_content=None,
        audio_content=None,
        audio_filename=None,
    ):
        """Add a new visit for a patient with enhanced backup capabilities"""
        visit_data = {
            "patient_id": ObjectId(patient_id),
            "timestamp": datetime.utcnow(),
            "transcript_text": transcript_text,  # The clinical conversation transcript
            "form_type": form_type,  # Type of form (tricare, cms1500, cms1450, etc.)
            "form_pdf_path": form_pdf_path,  # Path to generated PDF form
            "structured_data": structured_data,  # JSON data extracted from transcript
            "pdf_content": pdf_content,  # Binary PDF content for backup persistence
            "audio_content": audio_content,  # Binary audio content for recording storage
            "audio_filename": audio_filename,  # Original filename of the audio recording
            "created_at": datetime.utcnow(),
        }

        result = self.visits.insert_one(visit_data)

        # Update patient's last_updated timestamp
        self.patients.update_one(
            {"_id": ObjectId(patient_id)}, {"$set": {"last_updated": datetime.utcnow()}}
        )

        return str(result.inserted_id)

    def get_patient_visits(self, patient_id):
        """Get all visits for a patient"""
        return list(
            self.visits.find({"patient_id": ObjectId(patient_id)}).sort("timestamp", -1)
        )

    def get_patient_visits_by_form_type(self, patient_id, form_type):
        """Get all visits for a patient filtered by form type"""
        return list(
            self.visits.find({
                "patient_id": ObjectId(patient_id),
                "form_type": form_type
            }).sort("timestamp", -1)
        )

    def get_doctor_visits_by_form_type(self, doctor_id, form_type, limit=10):
        """Get recent visits for a doctor filtered by form type"""
        # First get all patient IDs for this doctor
        patients = self.patients.find({"doctor_id": ObjectId(doctor_id)}, {"_id": 1})
        patient_ids = [patient["_id"] for patient in patients]

        # Then get recent visits for those patients with specified form type
        return list(
            self.visits.find({
                "patient_id": {"$in": patient_ids},
                "form_type": form_type
            }).sort("timestamp", -1).limit(limit)
        )

    def get_visit(self, visit_id):
        """Get a specific visit by ID"""
        return self.visits.find_one({"_id": ObjectId(visit_id)})

    def get_visit_audio(self, visit_id):
        """Get audio content for a specific visit"""
        visit = self.visits.find_one(
            {"_id": ObjectId(visit_id)}, {"audio_content": 1, "audio_filename": 1}
        )
        if visit and visit.get("audio_content"):
            return visit["audio_content"], visit.get("audio_filename", "recording.wav")
        return None, None

    def get_doctor_recent_visits(self, doctor_id, limit=10):
        """Get recent visits across all patients for a doctor"""
        # First get all patient IDs for this doctor
        patients = self.patients.find({"doctor_id": ObjectId(doctor_id)}, {"_id": 1})
        patient_ids = [patient["_id"] for patient in patients]

        # Then get recent visits for those patients
        return list(
            self.visits.find({"patient_id": {"$in": patient_ids}})
            .sort("timestamp", -1)
            .limit(limit)
        )

    def get_visit_pdf_content(self, visit_id):
        """Get PDF content from visit for backup retrieval"""
        visit = self.get_visit(visit_id)
        if visit and visit.get("pdf_content"):
            return visit["pdf_content"]
        return None

    def restore_pdf_from_backup(self, visit_id, output_path):
        """Restore PDF file from database backup"""
        pdf_content = self.get_visit_pdf_content(visit_id)
        if pdf_content:
            try:
                with open(output_path, "wb") as pdf_file:
                    pdf_file.write(pdf_content)
                return True
            except Exception as e:
                print(f"Error restoring PDF: {str(e)}")
                return False
        return False

    # Legacy compatibility methods (for existing app functionality)
    def save_transcript(self, doctor_id, transcript_data):
        """Save a transcript - creates a temporary patient if needed for legacy support"""
        # For now, create a temporary patient entry or use existing logic
        # This maintains compatibility with existing app.py
        transcript = {
            "doctor_id": ObjectId(doctor_id),
            "transcript": transcript_data.get("transcript", ""),
            "generated_data": transcript_data.get("generated_data"),
            "created_at": datetime.utcnow(),
        }

        # Store in visits collection for new structure
        visit_data = {
            "patient_id": None,  # No specific patient assigned yet
            "doctor_id": ObjectId(doctor_id),  # Track which doctor created this
            "timestamp": datetime.utcnow(),
            "transcript_text": transcript_data.get("transcript", ""),
            "form_type": transcript_data.get("form_type", "cms1500"),  # Default to cms1500 for legacy
            "form_pdf_path": None,  # Will be updated when PDF is generated
            "generated_data": transcript_data.get("generated_data"),
            "created_at": datetime.utcnow(),
        }

        result = self.visits.insert_one(visit_data)
        return str(result.inserted_id)

    def get_user_transcripts(self, doctor_id):
        """Get all transcripts for a doctor (legacy compatibility)"""
        return list(
            self.visits.find({"doctor_id": ObjectId(doctor_id)}).sort("created_at", -1)
        )

    def save_form(self, doctor_id, form_type, form_data):
        """Save a form for a doctor (legacy compatibility)"""
        form = {
            "doctor_id": ObjectId(doctor_id),
            "form_type": form_type,
            "form_data": form_data,
            "created_at": datetime.utcnow(),
        }

        # Could be stored in visits or separate forms collection
        result = self.visits.insert_one(form)
        return str(result.inserted_id)

    def get_user_forms(self, doctor_id, form_type=None):
        """Get all forms for a doctor (legacy compatibility)"""
        query = {"doctor_id": ObjectId(doctor_id)}
        if form_type:
            query["form_type"] = form_type

        return list(self.visits.find(query).sort("created_at", -1))
