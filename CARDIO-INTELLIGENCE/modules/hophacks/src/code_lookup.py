# Enhanced Medical code lookup service
# This provides comprehensive medical code lookups with fuzzy matching and fallbacks

import re
from difflib import get_close_matches


def find_medical_codes(terms):
    """
    Takes a list of plain English medical terms and returns their codes.
    Enhanced with fuzzy matching and comprehensive code database.
    """
    if not terms:
        return {}

    # ICD-10 Diagnosis Codes - Expanded database
    diagnosis_codes = {
        # Respiratory conditions
        "strep throat": "J02.9",
        "acute pharyngitis": "J02.9",
        "pharyngitis": "J02.9",
        "sore throat": "J02.9",
        "fever": "R50.9",
        "fever of unknown origin": "R50.9",
        "pyrexia": "R50.9",
        "headache": "R51",
        "cephalgia": "R51",
        "cough": "R05",
        "chest pain": "R06.02",
        "thoracic pain": "R06.02",
        "abdominal pain": "R10.9",
        "stomach pain": "R10.9",
        "nausea": "R11.0",
        "vomiting": "R11.2",
        "emesis": "R11.2",
        "diarrhea": "R19.7",
        "fatigue": "R53.83",
        "dizziness": "R42",
        "vertigo": "R42",
        "shortness of breath": "R06.02",
        "dyspnea": "R06.02",
        "breathing difficulty": "R06.02",
        # Cardiovascular conditions
        "hypertension": "I10",
        "high blood pressure": "I10",
        "htn": "I10",
        "diabetes": "E11.9",
        "type 2 diabetes": "E11.9",
        "diabetes mellitus": "E11.9",
        "dm": "E11.9",
        # Respiratory infections
        "common cold": "J00",
        "upper respiratory infection": "J06.9",
        "uri": "J06.9",
        "bronchitis": "J40",
        "pneumonia": "J18.9",
        "asthma": "J45.9",
        "allergic rhinitis": "J30.9",
        "hay fever": "J30.9",
        "sinusitis": "J32.9",
        "sinus infection": "J32.9",
        # ENT conditions
        "ear infection": "H66.9",
        "otitis media": "H66.9",
        "conjunctivitis": "H10.9",
        "pink eye": "H10.9",
        # Skin conditions
        "skin rash": "R21",
        "rash": "R21",
        "dermatitis": "L30.9",
        "eczema": "L30.9",
        # Genitourinary conditions
        "urinary tract infection": "N39.0",
        "uti": "N39.0",
        "bladder infection": "N39.0",
        # Musculoskeletal conditions
        "back pain": "M54.9",
        "low back pain": "M54.9",
        "lumbago": "M54.9",
        "joint pain": "M25.9",
        "arthralgia": "M25.9",
        "muscle pain": "M79.3",
        "myalgia": "M79.3",
        # Mental health conditions
        "anxiety": "F41.9",
        "depression": "F32.9",
        "insomnia": "G47.00",
        "sleep disorder": "G47.00",
        # Neurological conditions
        "migraine": "G43.9",
        "head injury": "S09.9",
        "concussion": "S06.0",
        # Injuries
        "laceration": "S01.9",
        "cut": "S01.9",
        "contusion": "S00.9",
        "bruise": "S00.9",
        "sprain": "S93.9",
        "strain": "S93.9",
        # Additional common conditions
        "allergic reaction": "T78.40",
        "allergy": "T78.40",
        "constipation": "K59.00",
        "heartburn": "K21.9",
        "gastroesophageal reflux": "K21.9",
        "gerd": "K21.9",
        "indigestion": "K30",
        "dyspepsia": "K30",
    }

    # CPT Procedure Codes - Expanded database
    procedure_codes = {
        # Office visits
        "office visit": "99213",
        "new patient office visit": "99202",
        "established patient office visit": "99213",
        "comprehensive office visit": "99215",
        "brief office visit": "99212",
        "level 3 visit": "99213",
        "level 4 visit": "99214",
        "level 5 visit": "99215",
        # Laboratory tests
        "rapid strep test": "87880",
        "strep test": "87880",
        "throat culture": "87081",
        "blood pressure check": "93000",
        "temperature check": "99213",
        "physical examination": "99213",
        "vital signs": "99213",
        "urinalysis": "81001",
        "urine test": "81001",
        "blood test": "36415",
        "cbc": "85025",
        "complete blood count": "85025",
        "stool test": "82270",
        "pregnancy test": "81025",
        # Imaging
        "x-ray": "73060",
        "chest x-ray": "71020",
        "ekg": "93000",
        "electrocardiogram": "93000",
        "mammogram": "77067",
        # Procedures
        "injection": "96372",
        "shot": "96372",
        "vaccination": "90471",
        "flu shot": "90471",
        "immunization": "90471",
        "colonoscopy": "45378",
        "endoscopy": "43235",
        "suturing": "12001",
        "stitches": "12001",
        "wound care": "12001",
        "splinting": "29125",
        "casting": "29125",
        "suture removal": "12001",
        "bandage change": "12001",
        "dressing change": "12001",
        "injection administration": "96372",
        "medication administration": "96372",
        # Services
        "counseling": "99213",
        "patient education": "99213",
        "referral": "99213",
        "consultation": "99242",
        "pap smear": "88150",
    }

    result = {}

    for term in terms:
        if not term or not term.strip():
            continue

        term_lower = term.lower().strip()
        found_match = False

        # Direct lookup first
        if term_lower in diagnosis_codes:
            result[term] = {
                "icd10": diagnosis_codes[term_lower],
                "cpt": None,
                "type": "diagnosis",
            }
            found_match = True
        elif term_lower in procedure_codes:
            result[term] = {
                "icd10": None,
                "cpt": procedure_codes[term_lower],
                "type": "procedure",
            }
            found_match = True

        # Fuzzy matching if no direct match
        if not found_match:
            # Try fuzzy matching for diagnosis codes
            diagnosis_matches = get_close_matches(
                term_lower, diagnosis_codes.keys(), n=1, cutoff=0.8
            )
            if diagnosis_matches:
                matched_key = diagnosis_matches[0]
                result[term] = {
                    "icd10": diagnosis_codes[matched_key],
                    "cpt": None,
                    "type": "diagnosis",
                    "matched_term": matched_key,
                }
                found_match = True

            # Try fuzzy matching for procedure codes
            if not found_match:
                procedure_matches = get_close_matches(
                    term_lower, procedure_codes.keys(), n=1, cutoff=0.8
                )
                if procedure_matches:
                    matched_key = procedure_matches[0]
                    result[term] = {
                        "icd10": None,
                        "cpt": procedure_codes[matched_key],
                        "type": "procedure",
                        "matched_term": matched_key,
                    }
                    found_match = True

        # If still no match, try to extract medical terms from compound phrases
        if not found_match:
            # Look for common medical terms within the phrase
            medical_terms = [
                "pain",
                "infection",
                "fever",
                "cough",
                "headache",
                "nausea",
                "vomiting",
                "diarrhea",
                "rash",
                "visit",
                "test",
                "exam",
            ]
            for med_term in medical_terms:
                if med_term in term_lower:
                    if med_term in diagnosis_codes:
                        result[term] = {
                            "icd10": diagnosis_codes[med_term],
                            "cpt": None,
                            "type": "diagnosis",
                            "extracted_term": med_term,
                        }
                        found_match = True
                        break
                    elif med_term in procedure_codes:
                        result[term] = {
                            "icd10": None,
                            "cpt": procedure_codes[med_term],
                            "type": "procedure",
                            "extracted_term": med_term,
                        }
                        found_match = True
                        break

        # Final fallback
        if not found_match:
            result[term] = {
                "icd10": None,
                "cpt": None,
                "type": "unknown",
                "note": "No matching medical code found",
            }

    return result


def extract_medical_terms_from_text(text):
    """
    Extract potential medical terms from clinical text for code lookup.
    """
    if not text:
        return []

    # Common medical terms and patterns
    medical_patterns = [
        r"\b(?:strep throat|pharyngitis|sore throat)\b",
        r"\b(?:fever|pyrexia)\b",
        r"\b(?:headache|cephalgia)\b",
        r"\b(?:cough)\b",
        r"\b(?:chest pain|thoracic pain)\b",
        r"\b(?:abdominal pain|stomach pain)\b",
        r"\b(?:nausea)\b",
        r"\b(?:vomiting|emesis)\b",
        r"\b(?:diarrhea)\b",
        r"\b(?:fatigue)\b",
        r"\b(?:dizziness|vertigo)\b",
        r"\b(?:shortness of breath|dyspnea|breathing difficulty)\b",
        r"\b(?:hypertension|high blood pressure|htn)\b",
        r"\b(?:diabetes|diabetes mellitus|dm)\b",
        r"\b(?:common cold)\b",
        r"\b(?:upper respiratory infection|uri)\b",
        r"\b(?:bronchitis)\b",
        r"\b(?:pneumonia)\b",
        r"\b(?:asthma)\b",
        r"\b(?:allergic rhinitis|hay fever)\b",
        r"\b(?:sinusitis|sinus infection)\b",
        r"\b(?:ear infection|otitis media)\b",
        r"\b(?:conjunctivitis|pink eye)\b",
        r"\b(?:skin rash|rash)\b",
        r"\b(?:urinary tract infection|uti|bladder infection)\b",
        r"\b(?:back pain|low back pain|lumbago)\b",
        r"\b(?:joint pain|arthralgia)\b",
        r"\b(?:muscle pain|myalgia)\b",
        r"\b(?:anxiety)\b",
        r"\b(?:depression)\b",
        r"\b(?:insomnia|sleep disorder)\b",
        r"\b(?:migraine)\b",
        r"\b(?:head injury)\b",
        r"\b(?:laceration|cut)\b",
        r"\b(?:contusion|bruise)\b",
        r"\b(?:sprain|strain)\b",
        r"\b(?:office visit|visit)\b",
        r"\b(?:rapid strep test|strep test)\b",
        r"\b(?:blood pressure check)\b",
        r"\b(?:physical examination|exam)\b",
        r"\b(?:injection|shot)\b",
        r"\b(?:vaccination|flu shot|immunization)\b",
        r"\b(?:x-ray)\b",
        r"\b(?:chest x-ray)\b",
        r"\b(?:ekg|electrocardiogram)\b",
        r"\b(?:urinalysis|urine test)\b",
        r"\b(?:blood test)\b",
        r"\b(?:cbc|complete blood count)\b",
    ]

    extracted_terms = []
    text_lower = text.lower()

    for pattern in medical_patterns:
        matches = re.findall(pattern, text_lower)
        extracted_terms.extend(matches)

    # Remove duplicates while preserving order
    seen = set()
    unique_terms = []
    for term in extracted_terms:
        if term not in seen:
            seen.add(term)
            unique_terms.append(term)

    return unique_terms


def generate_medical_codes_from_transcript(transcript):
    """
    Generate medical codes from a clinical transcript using the enhanced lookup system.
    """
    if not transcript:
        return {"diagnoses": [], "procedures": []}

    # Extract medical terms from the transcript
    medical_terms = extract_medical_terms_from_text(transcript)

    # Look up codes for the extracted terms
    code_results = find_medical_codes(medical_terms)

    # Separate diagnoses and procedures
    diagnoses = []
    procedures = []

    for term, codes in code_results.items():
        if codes.get("type") == "diagnosis" and codes.get("icd10"):
            diagnoses.append(
                {
                    "description": term,
                    "code": codes["icd10"],
                    "confidence": "high" if "matched_term" not in codes else "medium",
                }
            )
        elif codes.get("type") == "procedure" and codes.get("cpt"):
            procedures.append(
                {
                    "description": term,
                    "code": codes["cpt"],
                    "charge": "0.00",  # Default charge, should be updated based on actual billing
                    "quantity": "1",
                    "confidence": "high" if "matched_term" not in codes else "medium",
                }
            )

    return {
        "diagnoses": diagnoses,
        "procedures": procedures,
        "extracted_terms": medical_terms,
        "code_results": code_results,
    }
