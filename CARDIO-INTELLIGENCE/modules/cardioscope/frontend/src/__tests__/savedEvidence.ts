// Frozen aggregate fixture only. Never includes saved patient-level prediction pairs.
import results from '../../../artifacts/final_holdout/final-v1-f1fd0d4cdc334c65aba46c37fa68717b/results.json';
import receipt from '../../../artifacts/final_holdout/final-v1-f1fd0d4cdc334c65aba46c37fa68717b/evaluation_record.json';
import { TARGETS } from '../api';
import type { EvidenceData } from '../evidence';
export const savedEvidence = {
  phase: results.phase, evaluation_id: receipt.evaluation_id, completed_utc: receipt.completed_utc,
  records: { total: 303, development: 242, holdout: 61 }, threshold: .5, nested_cv: {outer:5,inner:3},
  model_version:'a'.repeat(64),schema_version:1,schema_fingerprint:'a'.repeat(64),development_run_id:receipt.development_run_id,
  source:{path:receipt.output_directory+'/results.json',sha256:receipt.results_sha256},
  targets:Object.fromEntries(TARGETS.map(t=>[t,{
    definition:results.targets[t].encoding,model:results.targets[t].frozen_candidate,metrics:results.targets[t].metrics,
    uncertainty:results.targets[t].uncertainty,development_roc_auc:results.targets[t].development_comparison.roc_auc,
  }]))
} as unknown as EvidenceData;
