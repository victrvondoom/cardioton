/**
 * Case Profile View Component for CardioTwin
 *
 * Extracted and adapted from: case-twin-main/src/components/CaseProfileView.tsx
 * Original License: MIT (CaseTwin project)
 *
 * This component displays comprehensive cardiovascular case profiles
 * with structured sections for patient information, imaging, assessment, and findings.
 */

import React from 'react';
import { Heart, User, Stethoscope, FileImage, Microscope, ClipboardList, Tag, AlertTriangle, CheckCircle2, XCircle, Activity, Wind, Layers, FlaskConical, BookOpen, ExternalLink, Zap, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CardiacCaseProfile } from './core__cardiotwin_evidence__types';

// ============================================================================
// Helper Components
// ============================================================================

/** Section card wrapper for profile sections */
function SectionCard({
    icon,
    title,
    children,
    className,
}: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={`mb-8 border-b border-slate-700/50 pb-8 last:border-0 last:pb-0 ${className || ''}`}>
            <div className="flex items-center gap-2.5 mb-4">
                <span className="text-slate-500 flex items-center justify-center h-6 w-6 rounded-md bg-slate-800/50 border border-slate-700/50">
                    {icon}
                </span>
                <h3 className="text-lg font-semibold text-slate-200 tracking-tight">{title}</h3>
            </div>
            <div className="space-y-4 pl-9">{children}</div>
        </section>
    );
}

/** Field display component */
function Field({
    label,
    value,
    wide,
}: {
    label: string;
    value: React.ReactNode;
    wide?: boolean;
}) {
    return (
        <div className={`space-y-1 ${wide ? 'col-span-2' : ''}`}>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <div className="text-base leading-relaxed text-slate-200">{value}</div>
        </div>
    );
}

/** Chip component for tags and labels */
function Chip({ label, variant = "neutral" }: { label: string; variant?: "neutral" | "primary" | "success" | "warning" | "danger" }) {
    const variantClasses = {
        neutral: "bg-slate-700/50 text-slate-400",
        primary: "bg-orange-900/30 text-orange-400",
        success: "bg-green-900/30 text-green-400",
        warning: "bg-yellow-900/30 text-yellow-400",
        danger: "bg-red-900/30 text-red-400",
    };

    return (
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-medium ${variantClasses[variant]}`}>
            {label}
        </span>
    );
}

/** Yes/No badge with icons */
function YesNoBadge({ value }: { value: string | null }) {
    if (!value) return <span className="text-slate-500">—</span>;
    const isYes = value.toLowerCase() === "yes";
    const isNo = value.toLowerCase() === "no";

    if (isYes) return (
        <span className="inline-flex items-center gap-1.5 text-slate-200 font-medium">
            <CheckCircle2 className="h-4 w-4 text-green-500" />{value}
        </span>
    );
    if (isNo) return (
        <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
            <XCircle className="h-4 w-4 text-slate-600" />{value}
        </span>
    );
    return <span className="text-slate-200">{value}</span>;
}

/** Check if value is empty */
function isEmpty(val: any): boolean {
    if (val === null || val === undefined) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
}

// ============================================================================
// Section Components
// ============================================================================

/** Patient information section */
function PatientSection({ patient }: { patient: CardiacCaseProfile['patient'] }) {
    const hasAny = !isEmpty(patient.age_years) || !isEmpty(patient.sex) ||
        !isEmpty(patient.weight_kg) || !isEmpty(patient.immunocompromised) ||
        !isEmpty(patient.comorbidities) || !isEmpty(patient.medications) ||
        !isEmpty(patient.allergies) || !isEmpty(patient.cardiovascular_risk_factors);

    if (!hasAny) return null;

    return (
        <SectionCard icon={<User className="h-4 w-4" />} title="Patient">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {!isEmpty(patient.age_years) && <Field label="Age" value={`${patient.age_years} yrs`} />}
                {!isEmpty(patient.sex) && <Field label="Sex" value={patient.sex} />}
                {!isEmpty(patient.weight_kg) && <Field label="Weight" value={`${patient.weight_kg} kg`} />}
                {!isEmpty(patient.immunocompromised) && <Field label="Immunocompromised" value={<YesNoBadge value={patient.immunocompromised} />} />}

                {!isEmpty(patient.cardiovascular_risk_factors) && (
                    <Field wide label="Cardiovascular Risk Factors" value={
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {patient.cardiovascular_risk_factors?.map((c) => (
                                <Chip key={c} label={c} variant="warning" />
                            ))}
                        </div>
                    } />
                )}

                {!isEmpty(patient.comorbidities) && (
                    <Field wide label="Comorbidities" value={
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {patient.comorbidities.map((c) => <Chip key={c} label={c} variant="neutral" />)}
                        </div>
                    } />
                )}

                {!isEmpty(patient.medications) && (
                    <Field wide label="Medications" value={
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {patient.medications.map((m) => <Chip key={m} label={m} variant="primary" />)}
                        </div>
                    } />
                )}

                {!isEmpty(patient.allergies) && <Field label="Allergies" value={patient.allergies} />}
                {!isEmpty(patient.family_history) && <Field wide label="Family History" value={patient.family_history} />}
            </div>
        </SectionCard>
    );
}

/** Presentation information section */
function PresentationSection({ pres }: { pres: CardiacCaseProfile['presentation'] }) {
    const hasAny = !isEmpty(pres.chief_complaint) || !isEmpty(pres.symptom_duration) ||
        !isEmpty(pres.hpi) || !isEmpty(pres.pmh) || !isEmpty(pres.chest_pain_characteristics);

    if (!hasAny) return null;

    return (
        <SectionCard icon={<Stethoscope className="h-4 w-4" />} title="Presentation">
            <div className="space-y-3">
                {!isEmpty(pres.chief_complaint) && <Field label="Chief Complaint" value={pres.chief_complaint} />}
                {!isEmpty(pres.symptom_duration) && <Field label="Symptom Duration" value={pres.symptom_duration} />}

                {!isEmpty(pres.chest_pain_characteristics) && (
                    <Field label="Chest Pain" value={pres.chest_pain_characteristics} />
                )}

                {!isEmpty(pres.dyspnea_class) && (
                    <Field label="Dyspnea (NYHA Class)" value={pres.dyspnea_class} />
                )}

                {!isEmpty(pres.palpitations) && <Field label="Palpitations" value={pres.palpitations} />}
                {!isEmpty(pres.syncope) && <Field label="Syncope" value={pres.syncope} />}

                {!isEmpty(pres.hpi) && (
                    <Field label="HPI" value={
                        <div className="text-base leading-relaxed text-slate-300 border-l-3 border-slate-600/50 pl-3 py-1 mt-1 break-words">
                            {pres.hpi}
                        </div>
                    } />
                )}
                {!isEmpty(pres.pmh) && <Field label="PMH" value={pres.pmh} />}
            </div>
        </SectionCard>
    );
}

/** Study information section */
function StudySection({ study }: { study: CardiacCaseProfile['study'] }) {
    const hasAny = !isEmpty(study.image_url) || !isEmpty(study.modality) ||
        !isEmpty(study.body_region) || !isEmpty(study.view_position) ||
        !isEmpty(study.ecg_url) || !isEmpty(study.echo_url) || !isEmpty(study.cmr_url);

    if (!hasAny) return null;

    return (
        <SectionCard icon={<FileImage className="h-4 w-4" />} title="Imaging Study">
            <div className="space-y-3">
                {/* Image display */}
                {study.image_url && (
                    <div className="overflow-hidden rounded-xl border border-slate-600/50 bg-slate-900/30">
                        <img
                            src={study.image_url}
                            alt={study.caption || "Medical image"}
                            className="w-full max-h-64 object-contain"
                        />
                        {study.caption && (
                            <p className="px-3 py-2 text-sm text-slate-500 bg-slate-800/50 border-t border-slate-600/50">
                                {study.caption}
                            </p>
                        )}
                    </div>
                )}

                {/* Study details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {!isEmpty(study.modality) && (
                        <Field label="Modality" value={<Chip label={study.modality!} variant="primary" />} />
                    )}
                    {!isEmpty(study.body_region) && <Field label="Body Region" value={study.body_region} />}
                    {!isEmpty(study.view_position) && <Field label="View Position" value={study.view_position} />}
                    {!isEmpty(study.image_type) && <Field label="Image Type" value={study.image_type} />}
                </div>

                {/* Cardiovascular-specific study links */}
                <div className="flex gap-2 flex-wrap">
                    {study.ecg_url && (
                        <a
                            href={study.ecg_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-orange-400 hover:bg-slate-700/50 transition-colors text-sm"
                        >
                            <Layers className="h-4 w-4" />
                            View ECG
                        </a>
                    )}
                    {study.echo_url && (
                        <a
                            href={study.echo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-orange-400 hover:bg-slate-700/50 transition-colors text-sm"
                        >
                            <Heart className="h-4 w-4" />
                            View Echo
                        </a>
                    )}
                    {study.cmr_url && (
                        <a
                            href={study.cmr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-orange-400 hover:bg-slate-700/50 transition-colors text-sm"
                        >
                            <FlaskConical className="h-4 w-4" />
                            View CMR
                        </a>
                    )}
                </div>
            </div>
        </SectionCard>
    );
}

/** Assessment information section */
function AssessmentSection({ assessment }: { assessment: CardiacCaseProfile['assessment'] }) {
    const hasAny = !isEmpty(assessment.diagnosis_primary) || !isEmpty(assessment.suspected_primary) ||
        !isEmpty(assessment.differential) || !isEmpty(assessment.urgency) ||
        !isEmpty(assessment.cardiac_risk_score);

    if (!hasAny) return null;

    const urgencyVariant = (u: string | null) => {
        if (!u) return "neutral" as const;
        if (/emergent/i.test(u)) return "danger" as const;
        if (/semi/i.test(u)) return "warning" as const;
        return "neutral" as const;
    };

    return (
        <SectionCard icon={<Microscope className="h-4 w-4" />} title="Assessment">
            <div className="space-y-3">
                {/* Primary diagnosis */}
                {!isEmpty(assessment.diagnosis_primary) && (
                    <div className="rounded-xl bg-slate-800/30 border border-slate-600/50 px-4 py-3">
                        <p className="text-sm font-medium text-slate-500 mb-1">Primary Diagnosis</p>
                        <p className="text-lg font-semibold text-slate-200 capitalize">
                            {assessment.diagnosis_primary}
                        </p>
                    </div>
                )}

                {/* Suspected diagnosis */}
                {!isEmpty(assessment.suspected_primary) && (
                    <Field label="Suspected (Primary)" value={
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {assessment.suspected_primary?.map((d) => (
                                <Chip key={d} label={d} variant="success" />
                            ))}
                        </div>
                    } />
                )}

                {/* Differential diagnosis */}
                {!isEmpty(assessment.differential) && (
                    <Field label="Differential" value={
                        <ul className="space-y-1.5 mt-1 list-disc list-inside">
                            {assessment.differential.map((d) => (
                                <li key={d} className="text-slate-300">{d}</li>
                            ))}
                        </ul>
                    } />
                )}

                {/* Risk scores and urgency */}
                <div className="grid grid-cols-2 gap-3">
                    {!isEmpty(assessment.urgency) && (
                        <Field
                            label="Urgency"
                            value={<Chip label={assessment.urgency!} variant={urgencyVariant(assessment.urgency)} />}
                        />
                    )}
                    {!isEmpty(assessment.cardiac_risk_score) && (
                        <Field label="Cardiac Risk Score" value={assessment.cardiac_risk_score} />
                    )}
                    {!isEmpty(assessment.ejection_fraction) && (
                        <Field label="Ejection Fraction" value={assessment.ejection_fraction} />
                    )}
                    {!isEmpty(assessment.arrhythmia_type) && (
                        <Field label="Arrhythmia" value={assessment.arrhythmia_type} />
                    )}
                </div>

                {/* Clinical synthesis */}
                {!isEmpty(assessment.clinical_synthesis) && (
                    <div className="rounded-xl bg-slate-800/20 border border-slate-700/50 p-4 shadow-sm">
                        <p className="text-sm font-medium text-slate-400 mb-2">
                            <Activity className="h-4 w-4 inline text-orange-500 mr-1" />
                            Clinical Synthesis
                        </p>
                        <div className="prose prose-sm prose-invert max-w-none text-slate-300">
                            <ReactMarkdown>{assessment.clinical_synthesis}</ReactMarkdown>
                        </div>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

/** Findings section - Cardiovascular */
function FindingsSection({ findings }: { findings: CardiacCaseProfile['findings'] }) {
    const { lungs, pleura, cardiomediastinal, devices } = findings;

    const hasCardio = !isEmpty(cardiomediastinal.cardiomegaly) ||
        !isEmpty(cardiomediastinal.left_atrial_enlargement) ||
        !isEmpty(cardiomediastinal.ejection_fraction);

    const hasLungs = !isEmpty(lungs.consolidation_present) || !isEmpty(lungs.edema_present);
    const hasPleura = !isEmpty(pleura.effusion_present);
    const hasDevices = !isEmpty(devices.lines_tubes_present) || !isEmpty(devices.device_list);

    if (!hasCardio && !hasLungs && !hasPleura && !hasDevices) return null;

    return (
        <SectionCard icon={<Wind className="h-4 w-4" />} title="Findings">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Cardiovascular findings */}
                {hasCardio && (
                    <div className="rounded-xl border border-slate-600/50 bg-slate-800/20 p-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-400 mb-2">Cardiovascular</p>
                        {!isEmpty(cardiomediastinal.cardiomegaly) && (
                            <Field label="Cardiomegaly" value={cardiomediastinal.cardiomegaly} />
                        )}
                        {!isEmpty(cardiomediastinal.left_atrial_enlargement) && (
                            <Field label="Left Atrial Enlargement" value={cardiomediastinal.left_atrial_enlargement} />
                        )}
                        {!isEmpty(cardiomediastinal.left_ventricular_hypertrophy) && (
                            <Field label="LV Hypertrophy" value={cardiomediastinal.left_ventricular_hypertrophy} />
                        )}
                        {!isEmpty(cardiomediastinal.ejection_fraction) && (
                            <Field label="Ejection Fraction" value={cardiomediastinal.ejection_fraction} />
                        )}
                        {!isEmpty(cardiomediastinal.coronary_artery_disease) && (
                            <Field label="CAD" value={cardiomediastinal.coronary_artery_disease} />
                        )}
                        {!isEmpty(cardiomediastinal.pericardial_effusion) && (
                            <Field label="Pericardial Effusion" value={cardiomediastinal.pericardial_effusion} />
                        )}
                        {!isEmpty(cardiomediastinal.pulmonary_congestion) && (
                            <Field label="Pulmonary Congestion" value={cardiomediastinal.pulmonary_congestion} />
                        )}
                    </div>
                )}

                {/* Lung findings */}
                {hasLungs && (
                    <div className="rounded-xl border border-slate-600/50 bg-slate-800/20 p-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-400 mb-2">Lungs</p>
                        {!isEmpty(lungs.consolidation_present) && (
                            <Field label="Consolidation" value={lungs.consolidation_present} />
                        )}
                        {!isEmpty(lungs.edema_present) && (
                            <Field label="Edema" value={lungs.edema_present} />
                        )}
                        {lungs.edema_pattern && lungs.edema_pattern !== "unknown" && (
                            <Field label="Edema pattern" value={lungs.edema_pattern} />
                        )}
                    </div>
                )}

                {/* Pleura findings */}
                {hasPleura && (
                    <div className="rounded-xl border border-slate-600/50 bg-slate-800/20 p-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-400 mb-2">Pleura</p>
                        <Field label="Effusion" value={pleura.effusion_present || '—'} />
                        {pleura.effusion_side && pleura.effusion_side !== "unknown" && (
                            <Field label="Effusion side" value={pleura.effusion_side} />
                        )}
                        <Field label="Pneumothorax" value={pleura.pneumothorax_present || '—'} />
                    </div>
                )}

                {/* Devices */}
                {hasDevices && (
                    <div className="rounded-xl border border-slate-600/50 bg-slate-800/20 p-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-400 mb-2">Devices / Lines</p>
                        <Field label="Present" value={devices.lines_tubes_present || '—'} />
                        {!isEmpty(devices.device_list) && (
                            <div className="pt-1.5 flex flex-wrap gap-1">
                                {devices.device_list.map((d) => (
                                    <span
                                        key={d}
                                        className="inline-flex items-center rounded-md bg-slate-700/50 text-slate-400 px-2 py-0.5 text-xs font-medium"
                                    >
                                        {d}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

/** Summary section */
function SummarySection({ summary }: { summary: CardiacCaseProfile['summary'] }) {
    const hasAny = !isEmpty(summary.one_liner) || !isEmpty(summary.key_points) || !isEmpty(summary.red_flags);

    if (!hasAny) return null;

    return (
        <SectionCard icon={<ClipboardList className="h-4 w-4" />} title="Summary">
            <div className="space-y-3">
                {/* One-liner summary */}
                {!isEmpty(summary.one_liner) && (
                    <p className="text-lg leading-relaxed text-slate-300 italic border-l-3 border-slate-600/50 pl-3 py-1">
                        {summary.one_liner}
                    </p>
                )}

                {/* Key points */}
                {!isEmpty(summary.key_points) && (
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-2">Key Points</p>
                        <ul className="space-y-1.5 list-disc list-inside">
                            {summary.key_points.map((kp) => (
                                <li key={kp} className="text-slate-300">{kp}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Red flags */}
                {!isEmpty(summary.red_flags) && (
                    <div>
                        <p className="text-sm font-medium text-red-500 mb-2 flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4" />
                            Red Flags
                        </p>
                        <ul className="space-y-1.5">
                            {summary.red_flags.map((rf) => (
                                <li
                                    key={rf}
                                    className="flex items-start gap-2 text-slate-200 bg-red-900/20 rounded-xl px-4 py-2 border border-red-700/50"
                                >
                                    <Zap className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                    {rf}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

/** Outcome section */
function OutcomeSection({ outcome }: { outcome: CardiacCaseProfile['outcome'] }) {
    const hasAny = !isEmpty(outcome.success) || !isEmpty(outcome.detail);
    if (!hasAny) return null;

    return (
        <SectionCard icon={<Heart className="h-4 w-4" />} title="Outcome">
            <div className="flex items-start gap-3">
                {!isEmpty(outcome.success) && (
                    <span className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium shrink-0 ${
                        outcome.success === "yes"
                            ? "bg-green-900/20 text-green-400 border border-green-700/50"
                            : "bg-red-900/20 text-red-400 border border-red-700/50"
                    }`}>
                        {outcome.success === "yes"
                            ? <CheckCircle2 className="h-4 w-4" />
                            : <XCircle className="h-4 w-4" />}
                        {outcome.success === "yes" ? "Successful" : "Unsuccessful"}
                    </span>
                )}
                {!isEmpty(outcome.detail) && (
                    <p className="text-slate-300 leading-relaxed py-1">{outcome.detail}</p>
                )}
            </div>
        </SectionCard>
    );
}

/** Provenance section */
function ProvenanceSection({ prov }: { prov: CardiacCaseProfile['provenance'] }) {
    const hasData = prov.article_title || prov.journal || prov.pmc_id || prov.doi;
    if (!hasData) return null;

    return (
        <SectionCard icon={<BookOpen className="h-4 w-4" />} title="Source / Provenance">
            <div className="space-y-2">
                {prov.article_title && (
                    <p className="text-base font-medium text-slate-200 leading-relaxed">
                        {prov.article_title}
                    </p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    {prov.journal && <span>{prov.journal}</span>}
                    {prov.year && <span>{prov.year}</span>}
                    {prov.pmid && <span>PMID: {prov.pmid}</span>}
                </div>
                {prov.authors.length > 0 && (
                    <p className="text-sm text-slate-500">{prov.authors.join(", ")}</p>
                )}
                {prov.doi && (
                    <a
                        href={`https://doi.org/${prov.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300 transition-colors underline underline-offset-2"
                    >
                        DOI: {prov.doi} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                )}
                {prov.source_url && !prov.doi && (
                    <a
                        href={prov.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300 transition-colors underline underline-offset-2"
                    >
                        View source <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                )}
            </div>
        </SectionCard>
    );
}

/** Tags section */
function TagsSection({ tags }: { tags: CardiacCaseProfile['tags'] }) {
    const allKeywords = [...new Set([...tags.keywords, ...tags.ml_labels, ...tags.gt_labels])];
    const hasData = allKeywords.length > 0 || tags.mesh_terms.length > 0;
    if (!hasData) return null;

    return (
        <SectionCard icon={<Tag className="h-4 w-4" />} title="Tags & Labels">
            <div className="space-y-2.5">
                {allKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {allKeywords.map((k) => (
                            <Chip key={k} label={k} variant="neutral" />
                        ))}
                    </div>
                )}
                {tags.mesh_terms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {tags.mesh_terms.map((m) => (
                            <Chip key={m} label={`MeSH: ${m}`} variant="primary" />
                        ))}
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

/** Extra fields section */
function ExtraFieldsSection({ extra }: { extra: Record<string, string | string[]> }) {
    const entries = Object.entries(extra).filter(([, v]) =>
        v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)
    );
    if (entries.length === 0) return null;

    return (
        <SectionCard icon={<FlaskConical className="h-4 w-4" />} title="Additional Information">
            <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-6">
                {entries.map(([key, value]) => {
                    const label = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                    const displayValue = Array.isArray(value) ? value.join(", ") : value;
                    return (
                        <div key={key} className="space-y-0.5">
                            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{label}</p>
                            <p className="text-base text-slate-200 leading-snug break-words">{displayValue}</p>
                        </div>
                    );
                })}
            </div>
        </SectionCard>
    );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * CaseProfileView component
 * Displays comprehensive cardiovascular case profiles with structured sections
 *
 * Features:
 * - Patient information
 * - Presentation details
 * - Imaging study information
 * - Assessment and diagnosis
 * - Cardiovascular findings
 * - Summary with red flags
 * - Outcome tracking
 * - Provenance information
 * - Tags and labels
 *
 * @example
 * ```tsx
 * <CaseProfileView
 *   profile={cardiacCaseProfile}
 *   onEnhance={() => console.log('Enhance profile')}
 * />
 * ```
 */
export const CaseProfileView: React.FC<{
    profile: CardiacCaseProfile;
    className?: string;
    onEnhance?: () => void;
    isEnhancing?: boolean;
    enhancedSynthesis?: string;
    enhancedImaging?: string;
}> = ({
    profile,
    className,
    onEnhance,
    isEnhancing = false,
    enhancedSynthesis,
    enhancedImaging,
}) => {
    // Build sections array
    const sections = [
        <PatientSection key="patient" patient={profile.patient} />,
        <PresentationSection key="presentation" pres={profile.presentation} />,
        <StudySection key="study" study={profile.study} />,
        <AssessmentSection key="assessment" assessment={profile.assessment} />,
        <FindingsSection key="findings" findings={profile.findings} />,
        <SummarySection key="summary" summary={profile.summary} />,
        <OutcomeSection key="outcome" outcome={profile.outcome} />,
        <ProvenanceSection key="provenance" prov={profile.provenance} />,
        <TagsSection key="tags" tags={profile.tags} />,
        <ExtraFieldsSection key="extra" extra={profile.extra_fields ?? {}} />,
    ];

    return (
        <div className={`cardiotwin-case-profile space-y-4 relative ${className || ''}`}>
            {/* Enhance Profile Button */}
            {onEnhance && !enhancedSynthesis && (
                <div className="flex justify-end mb-4">
                    <button
                        onClick={onEnhance}
                        disabled={isEnhancing}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all shadow-sm border ${
                            isEnhancing
                                ? "bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed"
                                : "bg-slate-800/50 text-slate-200 border-slate-600/50 hover:bg-slate-700/50 hover:text-slate-100 active:bg-slate-600/50 hover:border-orange-500/30"
                        }`}
                    >
                        {isEnhancing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Enhancing Profile...
                            </>
                        ) : (
                            <>
                                <Activity className="h-4 w-4 text-orange-500" />
                                Enhance Profile
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* AI Clinical Synthesis Section */}
            {enhancedSynthesis && (
                <SectionCard
                    icon={<Activity className="h-4 w-4" />}
                    title="AI Clinical Synthesis"
                    className="bg-orange-900/10 p-5 rounded-2xl border border-orange-700/50 -mx-5 px-5 pt-6 shadow-sm mb-6"
                >
                    <div className="prose prose-sm prose-invert max-w-none text-slate-300">
                        <ReactMarkdown>{enhancedSynthesis}</ReactMarkdown>
                    </div>
                </SectionCard>
            )}
            {enhancedImaging && (
                <SectionCard icon={<FileImage className="h-4 w-4" />} title="Enhanced Imaging Review">
                    <div className="prose prose-sm prose-invert max-w-none text-slate-300">
                        <ReactMarkdown>{enhancedImaging}</ReactMarkdown>
                    </div>
                </SectionCard>
            )}

            {/* Render all sections */}
            {sections}
        </div>
    );
};

export default CaseProfileView;
