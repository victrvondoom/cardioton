import json
import os
import tempfile

from fpdf import FPDF
from PIL import Image


class PDFGenerator:
    def __init__(self, form_fields_json_path=None):
        # Load the coordinate data from your extracted JSON
        self.form_fields = self._load_form_fields(form_fields_json_path)

        # Create a mapping from our data structure to form field names
        self.field_mapping = {
            # Patient information
            "patient_name": "Patient Name",
            "patient_dob": "Date of Birth",
            "patient_ssn": "Patient SSN",
            "patient_dbn": "Patient DBN",
            # Provider information
            "provider_name": "Provider Name",
            "provider_tin": "Provider Tax Identification Number (TIN)",
            # Service information
            "claim_icn": "Claim Internal Control Number (ICN)",
            "diagnosis_codes": "Diagnosis code(s)",
            # Procedures - map to HCPCS/CPT codes
            "procedure_1_code": "HCPCS/CPT Code 1",
            "procedure_1_desc": "Description 1",
            "procedure_1_qty": "Quantity 1",
            "procedure_1_notes": "Notes 1",
            "procedure_2_code": "HCPCS/CPT Code 2",
            "procedure_2_desc": "Description 2",
            "procedure_2_qty": "Quantity 2",
            "procedure_2_notes": "Notes 2",
            "procedure_3_code": "HCPCS/CPT Code 3",
            "procedure_3_desc": "Description 3",
            "procedure_3_qty": "Quantity 3",
            "procedure_3_notes": "Notes 3",
            "procedure_4_code": "HCPCS/CPT Code 4",
            "procedure_4_desc": "Description 4",
            "procedure_4_qty": "Quantity 4",
            "procedure_4_notes": "Notes 4",
            # Additional fields
            "additional_info": "Additional Information",
            "length_of_need": "Length of need",
            "start_date": "Start date",
            "end_date": "End date",
            "physician_signature": "Physician Signature",
            "authorization_date": "Authroization Date ",
        }

        # Font settings
        self.font_size = 8
        self.font_family = "Arial"

    def _load_form_fields(self, json_path):
        """Load form field coordinates from JSON file"""
        if json_path and os.path.exists(json_path):
            try:
                with open(json_path, "r") as f:
                    data = json.load(f)
                    return {field["field_name"]: field for field in data["form_fields"]}
            except Exception as e:
                print(f"Warning: Could not load form fields from {json_path}: {e}")
                return {}
        return {}

    def generate_pdf(self, data):
        """Generate a filled PDF from structured data"""
        try:
            # Create a new PDF
            pdf = FPDF(orientation="P", unit="mm", format="A4")
            pdf.add_page()

            # Add the form as background image if available
            if os.path.exists("application_images/tricare-page-1.png"):
                pdf.image(
                    "application_images/tricare-page-1.png", x=0, y=0, w=210, h=297
                )

            # Set font
            pdf.set_font(self.font_family, "", self.font_size)

            # Fill all the fields
            self._fill_all_fields(pdf, data)

            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            pdf.output(temp_file.name)
            temp_file.close()

            return temp_file.name

        except Exception as e:
            raise Exception(f"Error generating PDF: {str(e)}")

    def _fill_all_fields(self, pdf, data):
        """Fill all form fields based on the data"""

        # Fill patient information
        self._fill_patient_info(pdf, data.get("patient", {}))

        # Fill provider information
        self._fill_provider_info(pdf, data.get("provider", {}))

        # Fill service information
        self._fill_service_info(pdf, data.get("service_info", {}))

        # Fill diagnoses
        self._fill_diagnoses(pdf, data.get("diagnoses", []))

        # Fill procedures
        self._fill_procedures(pdf, data.get("procedures", []))

        # Fill additional information
        self._fill_additional_info(pdf, data)

    def _fill_patient_info(self, pdf, patient_data):
        """Fill patient information fields"""
        if (
            "name" in patient_data
            and patient_data["name"]
            and patient_data["name"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(pdf, "Patient Name", patient_data["name"])

        if (
            "dob" in patient_data
            and patient_data["dob"]
            and patient_data["dob"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(pdf, "Date of Birth", patient_data["dob"])

        if (
            "ssn" in patient_data
            and patient_data["ssn"]
            and patient_data["ssn"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(pdf, "Patient SSN", patient_data["ssn"])

        if (
            "medicare_id" in patient_data
            and patient_data["medicare_id"]
            and patient_data["medicare_id"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(pdf, "Patient DBN", patient_data["medicare_id"])

    def _fill_provider_info(self, pdf, provider_data):
        """Fill provider information fields"""
        if (
            "name" in provider_data
            and provider_data["name"]
            and provider_data["name"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(pdf, "Provider Name", provider_data["name"])

        if (
            "npi" in provider_data
            and provider_data["npi"]
            and provider_data["npi"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(
                pdf, "Provider Tax Identification Number (TIN)", provider_data["npi"]
            )

    def _fill_service_info(self, pdf, service_data):
        """Fill service information fields"""
        if (
            "date_of_service" in service_data
            and service_data["date_of_service"]
            and service_data["date_of_service"]
            not in ["Not available", "N/A", "", None]
        ):
            # Generate a claim ICN (internal control number)
            icn = f"ICN-{service_data['date_of_service'].replace('-', '')}-001"
            self._fill_field(pdf, "Claim Internal Control Number (ICN)", icn)

    def _fill_diagnoses(self, pdf, diagnoses):
        """Fill diagnosis codes field"""
        if diagnoses:
            diagnosis_codes = []
            for diagnosis in diagnoses:
                if diagnosis.get("code") and diagnosis.get("description"):
                    diagnosis_codes.append(
                        f"{diagnosis['code']} - {diagnosis['description']}"
                    )

            if diagnosis_codes:
                diagnosis_text = "; ".join(diagnosis_codes)
                self._fill_field(pdf, "Diagnosis code(s)", diagnosis_text)

    def _fill_procedures(self, pdf, procedures):
        """Fill procedure fields"""
        for i, procedure in enumerate(procedures[:4]):  # Limit to 4 procedures
            if not procedure or not procedure.get("description"):
                continue

            row_num = i + 1
            code_field = f"HCPCS/CPT Code {row_num}"
            desc_field = f"Description {row_num}"
            qty_field = f"Quantity {row_num}"
            notes_field = f"Notes {row_num}"

            # Fill procedure code
            if procedure.get("code"):
                self._fill_field(pdf, code_field, procedure["code"])

            # Fill procedure description
            if procedure.get("description"):
                self._fill_field(pdf, desc_field, procedure["description"])

            # Fill quantity (default to 1 if not specified)
            quantity = procedure.get("quantity", "1")
            self._fill_field(pdf, qty_field, str(quantity))

            # Fill notes with charge information
            if procedure.get("charge"):
                self._fill_field(pdf, notes_field, f"Charge: ${procedure['charge']}")

    def _fill_additional_info(self, pdf, data):
        """Fill additional information fields"""
        # Fill additional information
        additional_info = []

        if data.get("patient", {}).get("address"):
            additional_info.append(f"Patient Address: {data['patient']['address']}")

        if data.get("service_info", {}).get("place_of_service"):
            additional_info.append(
                f"Place of Service: {data['service_info']['place_of_service']}"
            )

        if additional_info:
            self._fill_field(pdf, "Additional Information", "; ".join(additional_info))

        # Fill dates
        if data.get("service_info", {}).get("date_of_service"):
            self._fill_field(pdf, "Start date", data["service_info"]["date_of_service"])
            self._fill_field(pdf, "End date", data["service_info"]["date_of_service"])
            self._fill_field(
                pdf, "Authroization Date ", data["service_info"]["date_of_service"]
            )

    def _fill_field(self, pdf, field_name, value):
        """Fill a specific form field with a value"""
        if field_name not in self.form_fields:
            print(f"Warning: Field '{field_name}' not found in form fields")
            return

        field_info = self.form_fields[field_name]
        x = field_info["coordinates"]["x"]
        y = field_info["coordinates"]["y"]

        # Convert coordinates from PDF points to mm
        # Based on actual image dimensions 2550x3301 and A4 size 210x297mm
        # Factor: (25.4/72) * (210/2550) ≈ 0.029052
        conversion_factor = 0.4
        
        x_mm = x * conversion_factor
        y_mm = y * conversion_factor

        # No additional offset needed with correct scaling
        y_fpdf = y_mm

        try:
            pdf.text(x_mm, y_fpdf, str(value))
        except Exception as e:
            print(f"Error filling field '{field_name}': {e}")
