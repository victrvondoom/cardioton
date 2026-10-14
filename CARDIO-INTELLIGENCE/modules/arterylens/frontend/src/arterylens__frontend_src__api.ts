import { 
  SchemaField, 
  SamplePatient, 
  PredictionResult, 
  ExplanationResult, 
  WhatIfResult, 
  MetricsData, 
  PatientData 
} from './arterylens__frontend_src__types';

const API_BASE_URL = 'http://localhost:8000';

export async function fetchSchema(): Promise<SchemaField[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/schema`);
    if (!res.ok) throw new Error(`Schema request failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching schema:', err);
    throw err;
  }
}

export async function fetchSamples(): Promise<SamplePatient[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/samples`);
    if (!res.ok) throw new Error(`Samples request failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching samples:', err);
    throw err;
  }
}

export async function predictRisk(patient: PatientData): Promise<PredictionResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient }),
    });
    if (!res.ok) throw new Error(`Predict request failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error predicting risk:', err);
    throw err;
  }
}

export async function explainRisk(patient: PatientData, target: string = 'CAD'): Promise<ExplanationResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient, target }),
    });
    if (!res.ok) throw new Error(`Explain request failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error explaining risk:', err);
    throw err;
  }
}

export async function askAgent(query: string, patient: PatientData, target: string = 'CAD'): Promise<{
  reply: string;
  target: string;
  probabilities: Record<string, number>;
  risk_tier: string;
  disclaimer: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, patient, target }),
    });
    if (!res.ok) throw new Error(`Agent request failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error contacting agent:', err);
    throw err;
  }
}

export async function simulateWhatIf(patient: PatientData, changes: Record<string, number>): Promise<WhatIfResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/agent/what_if`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient, changes }),
    });
    if (!res.ok) throw new Error(`WhatIf request failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error running what-if:', err);
    throw err;
  }
}

export async function fetchMetrics(): Promise<MetricsData> {
  try {
    const res = await fetch(`${API_BASE_URL}/metrics`);
    if (!res.ok) throw new Error(`Metrics request failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching metrics:', err);
    throw err;
  }
}

export function getReportImageUrl(filename: string): string {
  return `${API_BASE_URL}/reports/${filename}`;
}
