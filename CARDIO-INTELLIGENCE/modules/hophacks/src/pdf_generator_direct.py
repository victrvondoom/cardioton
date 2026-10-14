import json
import os
import pdb
import tempfile

import fitz  # PyMuPDF


class PDFGeneratorDirect:
    def __init__(self, form_type="tricare"):
        self.form_type = form_type
        self.config = self._load_form_config(form_type)
        self.pdf_template_path = self.config.get(
            "pdf_template", "src/application_images/tricare.pdf"
        )
        self.field_mapping = self.config.get("field_mapping", {})
        self.special_fields = self.config.get("special_fields", {})

    def _load_form_config(self, form_type):
        """Load form configuration from JSON file"""
        config_file = f"form_configs/{form_type}_field_mapping.json"
        try:
            with open(config_file, "r") as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Warning: Form config not found: {config_file}")
            return self._get_default_config()
        except Exception as e:
            print(f"Error loading form config: {e}")
            return self._get_default_config()

    def _get_default_config(self):
        """Fallback configuration for Tricare form"""
        return {
            "form_name": "Tricare Medical Form",
            "pdf_template": "src/application_images/tricare.pdf",
            "field_mapping": {
                "patient": {
                    "name": "Patient Name",
                    "dob": "Date of Birth",
                    "ssn": "Patient SSN",
                    "medicare_id": "Patient DBN",
                },
                "provider": {
                    "name": "Provider Name",
                    "npi": "Provider Tax Identification Number (TIN)",
                },
                "service_info": {
                    "claim_icn": "Claim Internal Control Number (ICN)",
                    "diagnosis_codes": "Diagnosis code(s)",
                },
                "procedures": {
                    "code_1": "HCPCS/CPT Code 1",
                    "desc_1": "Description 1",
                    "qty_1": "Quantity 1",
                    "notes_1": "Notes 1",
                    "code_2": "HCPCS/CPT Code 2",
                    "desc_2": "Description 2",
                    "qty_2": "Quantity 2",
                    "notes_2": "Notes 2",
                    "code_3": "HCPCS/CPT Code 3",
                    "desc_3": "Description 3",
                    "qty_3": "Quantity 3",
                    "notes_3": "Notes 3",
                    "code_4": "HCPCS/CPT Code 4",
                    "desc_4": "Description 4",
                    "qty_4": "Quantity 4",
                    "notes_4": "Notes 4",
                },
                "additional": {
                    "additional_info": "Additional Information",
                    "start_date": "Start date",
                    "end_date": "End date",
                    "authorization_date": "Authroization Date",
                },
            },
            "special_fields": {},
        }

    def generate_pdf(self, data):
        """Generate a filled PDF by directly editing the form fields"""
        try:
            # Open the original PDF
            if not os.path.exists(self.pdf_template_path):
                raise Exception(f"PDF template not found: {self.pdf_template_path}")

            doc = fitz.open(self.pdf_template_path)

            # Get the first page
            page = doc[0]

            # Fill all the fields
            self._fill_all_fields(page, data)

            # Save to temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            temp_filename = temp_file.name
            temp_file.close()  # Close the file handle before saving

            doc.save(temp_filename)
            doc.close()

            return temp_filename

        except Exception as e:
            raise Exception(f"Error generating PDF: {str(e)}")

    def _fill_all_fields(self, page, data):
        """Fill all form fields based on the data and form configuration"""

        print("=" * 80)
        print("FILLING PDF FIELDS WITH DATA:")
        print("=" * 80)
        print(f"Data received: {json.dumps(data, indent=2)}")
        print("=" * 80)

        # Fill patient information
        if "patient" in self.field_mapping:
            print("Filling patient information...")
            self._fill_section(
                page, data.get("patient", {}), self.field_mapping["patient"]
            )

        # Fill provider information
        if "provider" in self.field_mapping:
            print("Filling provider information...")
            self._fill_section(
                page, data.get("provider", {}), self.field_mapping["provider"]
            )

        # Fill service information
        if "service_info" in self.field_mapping:
            print("Filling service information...")
            self._fill_section(
                page, data.get("service_info", {}), self.field_mapping["service_info"]
            )

        # Fill diagnoses
        if "diagnoses" in self.field_mapping or "diagnosis" in self.field_mapping:
            print("Filling diagnoses...")
            self._fill_diagnoses(page, data.get("diagnoses", []))

        # Fill procedures
        if "procedures" in self.field_mapping:
            print("Filling procedures...")
            self._fill_procedures(page, data.get("procedures", []))

        # Fill additional information
        if "additional" in self.field_mapping:
            print("Filling additional information...")
            self._fill_section(
                page, data.get("additional", {}), self.field_mapping["additional"]
            )

        # Fill special fields
        print("Filling special fields...")
        self._fill_special_fields(page, data)

    def _fill_section(self, page, data, field_mapping):
        """Fill a section of fields using the field mapping"""
        print(f"  Filling section with data: {data}")
        print(f"  Field mapping: {field_mapping}")

        for data_key, pdf_field_name in field_mapping.items():
            if (
                data_key in data
                and data[data_key]
                and data[data_key] not in ["Not available", "N/A", "", None]
            ):
                print(
                    f"    Filling {data_key} -> {pdf_field_name} with '{data[data_key]}'"
                )
                self._fill_field(page, pdf_field_name, data[data_key])
            else:
                print(f"    Skipping {data_key} -> {pdf_field_name} (no data or empty)")

    def _fill_special_fields(self, page, data):
        """Fill special fields that don't fit into standard categories"""

        # Hardcode rel_to_ins for CMS-1500 forms
        if self.form_type == "cms1500":
            print("  Hardcoding rel_to_ins to 'S' for CMS-1500")
            self._fill_field(page, "rel_to_ins", "S")

        for field_name, pdf_field_name in self.special_fields.items():
            # Try to find the data in various places
            value = None
            if field_name in data:
                value = data[field_name]
            elif "patient" in data and field_name in data["patient"]:
                value = data["patient"][field_name]
            elif "provider" in data and field_name in data["provider"]:
                value = data["provider"][field_name]
            elif "service_info" in data and field_name in data["service_info"]:
                value = data["service_info"][field_name]

            if value and value not in ["Not available", "N/A", "", None]:
                self._fill_field(page, pdf_field_name, value)

    def _fill_patient_info(self, page, patient_data):
        """Fill patient information fields"""
        if (
            "name" in patient_data
            and patient_data["name"]
            and patient_data["name"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(page, "Patient Name", patient_data["name"])

        if (
            "dob" in patient_data
            and patient_data["dob"]
            and patient_data["dob"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(page, "Date of Birth", patient_data["dob"])

        if (
            "ssn" in patient_data
            and patient_data["ssn"]
            and patient_data["ssn"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(page, "Patient SSN", patient_data["ssn"])

        if (
            "medicare_id" in patient_data
            and patient_data["medicare_id"]
            and patient_data["medicare_id"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(page, "Patient DBN", patient_data["medicare_id"])

    def _fill_provider_info(self, page, provider_data):
        """Fill provider information fields"""
        if (
            "name" in provider_data
            and provider_data["name"]
            and provider_data["name"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(page, "Provider Name", provider_data["name"])

        if (
            "npi" in provider_data
            and provider_data["npi"]
            and provider_data["npi"] not in ["Not available", "N/A", "", None]
        ):
            self._fill_field(
                page, "Provider Tax Identification Number (TIN)", provider_data["npi"]
            )

    def _fill_service_info(self, page, service_data):
        """Fill service information fields"""
        if (
            "date_of_service" in service_data
            and service_data["date_of_service"]
            and service_data["date_of_service"]
            not in ["Not available", "N/A", "", None]
        ):
            # Generate a claim ICN (internal control number)
            icn = f"ICN-{service_data['date_of_service'].replace('-', '')}-001"
            self._fill_field(page, "Claim Internal Control Number (ICN)", icn)

    def _fill_diagnoses(self, page, diagnoses):
        """Fill diagnosis codes field"""
        print(f"  Filling diagnoses with data: {diagnoses}")

        if not diagnoses:
            print("  No diagnoses to fill")
            return

        # Check if we have a diagnosis field mapping
        if "diagnosis_codes" in self.field_mapping.get("service_info", {}):
            # Single field for all diagnoses
            print("  Using single diagnosis field approach")
            diagnosis_codes = []
            for diagnosis in diagnoses:
                if diagnosis.get("code") and diagnosis.get("description"):
                    diagnosis_codes.append(
                        f"{diagnosis['code']} - {diagnosis['description']}"
                    )

            if diagnosis_codes:
                diagnosis_text = "; ".join(diagnosis_codes)
                pdf_field = self.field_mapping["service_info"]["diagnosis_codes"]
                print(
                    f"    Filling diagnosis field '{pdf_field}' with '{diagnosis_text}'"
                )
                self._fill_field(page, pdf_field, diagnosis_text)
        else:
            # Multiple diagnosis fields (like CMS-1500)
            print("  Using multiple diagnosis fields approach")
            diagnosis_mapping = self.field_mapping.get("diagnoses", {})
            print(f"  Diagnosis mapping: {diagnosis_mapping}")

            # Handle both array and dictionary formats
            if isinstance(diagnoses, dict):
                # CMS-1500 format: {"diagnosis1": "code1", "diagnosis2": "code2", ...}
                print("  Processing diagnoses as dictionary format")
                for field_key, diagnosis_code in diagnoses.items():
                    if diagnosis_code and field_key in diagnosis_mapping:
                        pdf_field = diagnosis_mapping[field_key]
                        print(
                            f"    Filling {field_key} field '{pdf_field}' with '{diagnosis_code}'"
                        )
                        self._fill_field(page, pdf_field, diagnosis_code)
                    else:
                        print(
                            f"    No mapping found for diagnosis field key: {field_key}"
                        )
            else:
                # Tricare format: [{"code": "code1", "description": "desc1"}, ...]
                print("  Processing diagnoses as array format")
                for i, diagnosis in enumerate(diagnoses[:12]):  # Limit to 12 diagnoses
                    if diagnosis.get("code"):
                        field_key = f"diagnosis_{i+1}"
                        if field_key in diagnosis_mapping:
                            pdf_field = diagnosis_mapping[field_key]
                            print(
                                f"    Filling diagnosis {i+1} field '{pdf_field}' with '{diagnosis['code']}'"
                            )
                            self._fill_field(page, pdf_field, diagnosis["code"])
                        else:
                            print(
                                f"    No mapping found for diagnosis field key: {field_key}"
                            )
                    else:
                        print(f"    Diagnosis {i+1} has no code: {diagnosis}")

    def _fill_procedures(self, page, procedures):
        """Fill procedure fields"""
        print(f"  Filling procedures with data: {procedures}")

        if not procedures:
            print("  No procedures to fill")
            return

        # Check if we have procedure field mapping
        procedure_mapping = self.field_mapping.get("procedures", {})
        print(f"  Procedure mapping: {procedure_mapping}")

        # Determine max procedures based on form type
        max_procedures = 6 if self.form_type == "cms1500" else 4
        print(f"  Max procedures: {max_procedures}")

        # Handle both array and dictionary formats
        if isinstance(procedures, dict):
            # CMS-1500 format: {"cpt1": "code1", "ch1": "charge1", "cpt2": "code2", ...}
            print("  Processing procedures as dictionary format")
            for field_key, value in procedures.items():
                if field_key.startswith("cpt") and value:
                    # This is a procedure code
                    pdf_field = procedure_mapping.get(field_key)
                    if pdf_field:
                        print(
                            f"    Filling {field_key} field '{pdf_field}' with '{value}'"
                        )
                        self._fill_field(page, pdf_field, value)
                elif field_key.startswith("ch") and value:
                    # This is a charge
                    pdf_field = procedure_mapping.get(field_key)
                    if pdf_field:
                        print(
                            f"    Filling {field_key} field '{pdf_field}' with '{value}'"
                        )
                        self._fill_field(page, pdf_field, value)
        else:
            # Tricare format: [{"code": "code1", "description": "desc1", "charge": "100"}, ...]
            print("  Processing procedures as array format")
            for i, procedure in enumerate(procedures[:max_procedures]):
                if not procedure or not procedure.get("description"):
                    print(f"    Skipping procedure {i+1}: {procedure}")
                    continue

                row_num = i + 1
                print(f"    Processing procedure {row_num}: {procedure}")

                # Try different field naming patterns
                if f"service_{row_num}" in procedure_mapping:
                    # CMS-1500 style with nested service objects
                    service_mapping = procedure_mapping[f"service_{row_num}"]
                    self._fill_procedure_service(page, procedure, service_mapping)
                else:
                    # Tricare style with numbered fields
                    self._fill_procedure_numbered(
                        page, procedure, procedure_mapping, row_num
                    )

    def _fill_procedure_service(self, page, procedure, service_mapping):
        """Fill procedure using CMS-1500 service mapping"""
        for field_key, pdf_field in service_mapping.items():
            if field_key == "date_from" and procedure.get("date_of_service"):
                self._fill_field(page, pdf_field, procedure["date_of_service"])
            elif field_key == "date_to" and procedure.get("date_of_service"):
                self._fill_field(page, pdf_field, procedure["date_of_service"])
            elif field_key == "cpt" and procedure.get("code"):
                self._fill_field(page, pdf_field, procedure["code"])
            elif field_key == "charge" and procedure.get("charge"):
                self._fill_field(page, pdf_field, procedure["charge"])
            elif field_key == "days" and procedure.get("quantity"):
                self._fill_field(page, pdf_field, procedure["quantity"])
            elif field_key == "place" and procedure.get("place_of_service"):
                self._fill_field(page, pdf_field, procedure["place_of_service"])

    def _fill_procedure_numbered(self, page, procedure, procedure_mapping, row_num):
        """Fill procedure using numbered field mapping (Tricare style)"""
        code_field = procedure_mapping.get(f"code_{row_num}")
        desc_field = procedure_mapping.get(f"desc_{row_num}")
        qty_field = procedure_mapping.get(f"qty_{row_num}")
        notes_field = procedure_mapping.get(f"notes_{row_num}")

        # Fill procedure code
        if procedure.get("code") and code_field:
            self._fill_field(page, code_field, procedure["code"])

        # Fill procedure description
        if procedure.get("description") and desc_field:
            self._fill_field(page, desc_field, procedure["description"])

        # Fill quantity (default to 1 if not specified)
        if qty_field:
            quantity = procedure.get("quantity", "1")
            self._fill_field(page, qty_field, str(quantity))

        # Fill notes with charge information
        if procedure.get("charge") and notes_field:
            self._fill_field(page, notes_field, f"Charge: ${procedure['charge']}")

    def _fill_additional_info(self, page, data):
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
            self._fill_field(page, "Additional Information", "; ".join(additional_info))

        # Fill dates
        if data.get("service_info", {}).get("date_of_service"):
            self._fill_field(
                page, "Start date", data["service_info"]["date_of_service"]
            )
            self._fill_field(page, "End date", data["service_info"]["date_of_service"])
            self._fill_field(
                page, "Authroization Date ", data["service_info"]["date_of_service"]
            )

    def _fill_field(self, page, field_name, value):
        """Fill a specific form field with a value using PyMuPDF"""
        try:
            # Find the field by name (exact match first)
            for field in page.widgets():
                if field.field_name == field_name:
                    # Set the field value
                    field.field_value = str(value)
                    field.update()
                    print(f"✓ Filled field '{field_name}' with '{value}'")
                    return

            # If exact match not found, try partial matching
            for field in page.widgets():
                if (
                    field_name.lower() in field.field_name.lower()
                    or field.field_name.lower() in field_name.lower()
                ):
                    field.field_value = str(value)
                    field.update()
                    print(
                        f"✓ Filled field '{field.field_name}' (matched '{field_name}') with '{value}'"
                    )
                    return

            print(f"Warning: Field '{field_name}' not found in PDF form")

        except Exception as e:
            print(f"Error filling field '{field_name}': {e}")

    def discover_form_fields(self):
        """Discover all available form fields in the PDF"""
        try:
            doc = fitz.open(self.pdf_template_path)
            page = doc[0]

            fields = []
            for field in page.widgets():
                fields.append(
                    {
                        "name": field.field_name,
                        "type": field.field_type_string,
                        "value": field.field_value,
                        "rect": field.rect,
                    }
                )

            doc.close()
            return fields

        except Exception as e:
            print(f"Error discovering form fields: {e}")
            return []

    def get_available_fields(self):
        """Get list of available form fields in the PDF"""
        try:
            doc = fitz.open(self.pdf_template_path)
            page = doc[0]

            fields = []
            for field in page.widgets():
                fields.append(
                    {
                        "name": field.field_name,
                        "type": field.field_type_string,
                        "value": field.field_value,
                    }
                )

            doc.close()
            return fields

        except Exception as e:
            print(f"Error getting available fields: {e}")
            return []
