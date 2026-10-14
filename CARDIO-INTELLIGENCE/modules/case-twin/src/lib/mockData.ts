export type Match = {
  id: string;
  facility: string;
  country: string;
  diagnosis: string;
  similarity: number;
  outcome: "Stable" | "Improved" | "Transferred";
  details: Record<string, string>;
};

export type TriageFacility = {
  rank: number;
  facility: string;
  distance: string;
  equipment: string;
  reason: string;
};

export const metrics = {
  topSimilarity: "94%",
  matchesReturned: 5,
  recommendedCenter: "Mayo Clinic - Rochester"
};

export const matches: Match[] = [
  {
    id: "m1",
    facility: "Mayo Clinic",
    country: "United States",
    diagnosis: "Acute ischemic stroke",
    similarity: 94,
    outcome: "Improved",
    details: {
      "Patient profile": "Male, 62, hypertension, diabetes",
      "Key finding": "Left MCA occlusion on CT angiography",
      "Treatment": "Mechanical thrombectomy in 54 minutes",
      "Hospital stay": "6 days",
      "Discharge status": "Neurologic improvement, outpatient rehab"
    }
  },
  {
    id: "m2",
    facility: "Cleveland Clinic",
    country: "United States",
    diagnosis: "Large vessel stroke",
    similarity: 91,
    outcome: "Stable",
    details: {
      "Patient profile": "Female, 58, atrial fibrillation",
      "Key finding": "Distal ICA thrombus",
      "Treatment": "Thrombolysis followed by transfer",
      "Hospital stay": "5 days",
      "Discharge status": "Stable with home support"
    }
  },
  {
    id: "m3",
    facility: "Karolinska University Hospital",
    country: "Sweden",
    diagnosis: "Posterior circulation stroke",
    similarity: 89,
    outcome: "Improved",
    details: {
      "Patient profile": "Male, 47, smoking history",
      "Key finding": "Basilar artery occlusion",
      "Treatment": "Endovascular revascularization",
      "Hospital stay": "8 days",
      "Discharge status": "Improved motor response"
    }
  },
  {
    id: "m4",
    facility: "Singapore General Hospital",
    country: "Singapore",
    diagnosis: "Hemorrhagic conversion risk",
    similarity: 87,
    outcome: "Transferred",
    details: {
      "Patient profile": "Female, 71, anticoagulant therapy",
      "Key finding": "Early edema and perfusion mismatch",
      "Treatment": "Neuro ICU monitoring + intervention",
      "Hospital stay": "10 days",
      "Discharge status": "Transferred to step-down care"
    }
  },
  {
    id: "m5",
    facility: "Apollo Hospitals",
    country: "India",
    diagnosis: "Acute stroke with aspiration risk",
    similarity: 85,
    outcome: "Stable",
    details: {
      "Patient profile": "Male, 65, COPD",
      "Key finding": "Right hemispheric infarct",
      "Treatment": "Airway stabilization + stroke protocol",
      "Hospital stay": "7 days",
      "Discharge status": "Stable for supervised rehab"
    }
  }
];

export const equipmentOptions = [
  "Robotic surgery",
  "Pediatric ICU",
  "Interventional radiology",
  "3T MRI",
  "Oncology center"
];

export const triageFacilities: TriageFacility[] = [
  {
    rank: 1,
    facility: "Mayo Clinic - Rochester",
    distance: "182 km",
    equipment: "Interventional radiology, 3T MRI",
    reason: "Best overlap with neuro-intervention and imaging"
  },
  {
    rank: 2,
    facility: "Cleveland Clinic",
    distance: "426 km",
    equipment: "Robotic surgery, Oncology center",
    reason: "High specialist availability and rapid transfer lane"
  },
  {
    rank: 3,
    facility: "Northwestern Memorial",
    distance: "512 km",
    equipment: "Interventional radiology, Pediatric ICU",
    reason: "Strong ICU support for mixed-risk profile"
  }
];

export const memoText = {
  presentingComplaint:
    "Patient with acute focal neurologic deficit, symptom onset estimated within 2 hours, NIHSS consistent with moderate-to-severe stroke pattern.",
  caseTwinMatch:
    "Top-matched historical cases suggest favorable outcomes when early thrombectomy pathway is initiated at a center with high-volume neuro-interventional capability.",
  recommendedProtocol:
    "Activate stroke transfer protocol, repeat perfusion imaging on arrival, maintain blood pressure within guideline window, and prepare endovascular suite standby.",
  logistics:
    "Ground transfer within 45 minutes. Include CT/CTA package, anticoagulant history, allergy status, and current vitals in transfer packet."
};

export const fhirPreview = {
  patient_age: 62,
  patient_sex: "male",
  conditions: ["hypertension", "type_2_diabetes", "atrial_fibrillation"],
  observations: [
    "acute_right_side_weakness",
    "slurred_speech",
    "cta_left_mca_occlusion"
  ]
};

export const expertBridge = {
  center: "Johns Hopkins Department of Neurology",
  summary:
    "Recommended protocol includes immediate vessel imaging confirmation, transfer triage with intervention readiness, and post-procedure monitoring in a neurocritical care unit."
};
