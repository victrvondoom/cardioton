/**
 * CARDIOSPATIAL-3D: Clinical Dashboard Controller
 * Connects UI controls, 3D WebGL heart, real-time ML inference, and SHAP explainability.
 */

let visualizer3D = null;
let shapChart = null;
let radarChart = null;
let currentPredictions = null;
let currentExplanation = null;
let currentActiveTarget = 'CAD';
let debounceTimer = null;
let validationMetrics = null;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize 3D Visualizer
    visualizer3D = new CardioVisualizer3D('canvas3d-container');

    // 2. Setup Global Callback from 3D clicks
    window.onVesselSelected = (vesselKey) => {
        highlightVesselTab(vesselKey);
        loadExplanationForTarget(vesselKey);
        renderIVUSSlice(vesselKey);
    };

    // 3. Initialize Charts & Telemetry Monitors
    initCharts();
    initECGMonitor();

    // 4. Setup Input Event Listeners
    setupInputListeners();

    // 5. Fetch Validation Metrics
    await fetchMetrics();

    // 6. Load Initial Default Preset (Acute LAD Stenosis)
    await loadPreset('isolated_lad');
});

// Setup Input Listeners
function setupInputListeners() {
    const inputs = document.querySelectorAll('.param-input');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            // Update companion value display badge
            const displayId = `${input.id}-val`;
            const displayElem = document.getElementById(displayId);
            if (displayElem) {
                displayElem.textContent = input.value;
            }

            // Sync pulse rate with 3D heart beat
            if (input.id === 'input-PR' && visualizer3D) {
                visualizer3D.bpm = parseInt(input.value) || 75;
            }

            // Debounced real-time prediction
            if (document.getElementById('auto-predict-toggle').checked) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(runPrediction, 250);
            }
        });
    });

    // Tab switching for input categories
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active', 'border-sky-400', 'text-sky-400', 'bg-slate-800/80'));
            btn.classList.add('active', 'border-sky-400', 'text-sky-400', 'bg-slate-800/80');

            const targetSection = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            const showContent = document.getElementById(`tab-${targetSection}`);
            if (showContent) showContent.classList.remove('hidden');
        });
    });

    // Explain target switcher tabs (CAD, LAD, LCX, RCA)
    const explainTabs = document.querySelectorAll('.explain-target-btn');
    explainTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            explainTabs.forEach(b => b.classList.remove('active', 'bg-sky-500', 'text-white'));
            btn.classList.add('active', 'bg-sky-500', 'text-white');
            currentActiveTarget = btn.dataset.target;
            loadExplanationForTarget(currentActiveTarget);
            renderIVUSSlice(currentActiveTarget);
        });
    });
}

// Collect all input features into standardized dictionary
function getPatientFeatures() {
    const features = {};

    // Continuous & Integer features
    const numericFields = [
        'Age', 'Weight', 'Length', 'BMI', 'BP', 'PR', 'FBS', 'CR', 'TG',
        'LDL', 'HDL', 'BUN', 'ESR', 'HB', 'K', 'Na', 'WBC', 'Lymph',
        'Neut', 'PLT', 'EF-TTE', 'Region RWMA', 'Function Class'
    ];
    numericFields.forEach(f => {
        const elem = document.getElementById(`input-${f}`);
        if (elem) features[f] = parseFloat(elem.value) || 0;
    });

    // Binary / Categorical features
    features['Sex'] = document.getElementById('input-Sex').value;
    features['Typical Chest Pain'] = parseInt(document.getElementById('input-Typical-Chest-Pain').value) || 0;
    features['Dyspnea'] = document.getElementById('input-Dyspnea').value;
    features['Atypical'] = document.getElementById('input-Atypical').value;
    features['Nonanginal'] = document.getElementById('input-Nonanginal').value;
    features['LowTH Ang'] = document.getElementById('input-LowTH-Ang').value;
    features['Exertional CP'] = 'N';

    // Comorbidities
    features['DM'] = parseInt(document.getElementById('input-DM').value) || 0;
    features['HTN'] = parseInt(document.getElementById('input-HTN').value) || 0;
    features['Current Smoker'] = parseInt(document.getElementById('input-Current-Smoker').value) || 0;
    features['EX-Smoker'] = parseInt(document.getElementById('input-EX-Smoker').value) || 0;
    features['FH'] = parseInt(document.getElementById('input-FH').value) || 0;
    features['Obesity'] = document.getElementById('input-Obesity').value;
    features['CRF'] = document.getElementById('input-CRF').value;
    features['CVA'] = document.getElementById('input-CVA').value;
    features['Airway disease'] = document.getElementById('input-Airway-disease').value;
    features['Thyroid Disease'] = document.getElementById('input-Thyroid-Disease').value;
    features['CHF'] = document.getElementById('input-CHF').value;
    features['DLP'] = document.getElementById('input-DLP').value;

    // Physical Exam
    features['Edema'] = parseInt(document.getElementById('input-Edema').value) || 0;
    features['Weak Peripheral Pulse'] = document.getElementById('input-Weak-Peripheral-Pulse').value;
    features['Lung rales'] = document.getElementById('input-Lung-rales').value;
    features['Systolic Murmur'] = document.getElementById('input-Systolic-Murmur').value;
    features['Diastolic Murmur'] = document.getElementById('input-Diastolic-Murmur').value;

    // ECG
    features['Q Wave'] = parseInt(document.getElementById('input-Q-Wave').value) || 0;
    features['St Elevation'] = parseInt(document.getElementById('input-St-Elevation').value) || 0;
    features['St Depression'] = parseInt(document.getElementById('input-St-Depression').value) || 0;
    features['Tinversion'] = parseInt(document.getElementById('input-Tinversion').value) || 0;
    features['LVH'] = document.getElementById('input-LVH').value;
    features['Poor R Progression'] = document.getElementById('input-Poor-R-Progression').value;
    features['BBB'] = document.getElementById('input-BBB').value;

    // Echo
    features['VHD'] = document.getElementById('input-VHD').value;

    return features;
}

// Run Multi-Target Prediction Pipeline
async function runPrediction() {
    const features = getPatientFeatures();

    try {
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ features: features })
        });

        if (!response.ok) throw new Error('Prediction API error');
        currentPredictions = await response.json();

        // 1. Update UI Elements
        updateDashboardUI(currentPredictions);

        // 2. Update 3D Visualizer
        if (visualizer3D) {
            visualizer3D.updateRiskColors(currentPredictions);
        }

        // 3. Update SHAP explanation for current target
        await loadExplanationForTarget(currentActiveTarget);

        // 4. Update Physiological Radar Chart
        updateRadarChart(features, currentPredictions);

    } catch (err) {
        console.error('Prediction failed:', err);
    }
}

// Update UI with Prediction Results
function updateDashboardUI(pred) {
    const cad = pred.overall_cad;
    const lad = pred.vessels.LAD;
    const lcx = pred.vessels.LCX;
    const rca = pred.vessels.RCA;

    // 1. Overall CAD Score & Badge
    const cadProbPct = Math.round(cad.probability * 100);
    document.getElementById('cad-score-display').textContent = `${cadProbPct}%`;
    document.getElementById('cad-status-badge').textContent = cad.status;
    document.getElementById('cad-risk-tier').textContent = cad.risk_tier;
    document.getElementById('cad-recommendation').textContent = cad.recommendation;

    // Progress bar for CAD
    const cadBar = document.getElementById('cad-progress-bar');
    cadBar.style.width = `${cadProbPct}%`;
    cadBar.style.backgroundColor = cad.color;

    // 2. Vessel Cards
    updateVesselCard('LAD', lad);
    updateVesselCard('LCX', lcx);
    updateVesselCard('RCA', rca);

    // 3. Occlusion Summary Badge
    const riskCount = pred.vessels_at_risk_count;
    const summaryBadge = document.getElementById('vessels-at-risk-badge');
    if (riskCount === 0) {
        summaryBadge.textContent = "0 Vessels Stenosed (Patent Vasculature)";
        summaryBadge.className = "badge-pill bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    } else if (riskCount === 1) {
        summaryBadge.textContent = `1 Vessel Involved (${pred.vessels_at_risk_list.join(', ')})`;
        summaryBadge.className = "badge-pill bg-amber-500/20 text-amber-400 border border-amber-500/30";
    } else {
        summaryBadge.textContent = `${riskCount} Vessels Involved (${pred.vessels_at_risk_list.join(' + ')})`;
        summaryBadge.className = "badge-pill bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold glow-red";
    }

    // 4. Update IVUS Lumen Cross-Section Slice
    renderIVUSSlice(currentActiveTarget === 'CAD' ? 'LAD' : currentActiveTarget);
}

function updateVesselCard(vKey, vData) {
    const probPct = Math.round(vData.probability * 100);
    document.getElementById(`${vKey.toLowerCase()}-prob-display`).textContent = `${probPct}%`;
    document.getElementById(`${vKey.toLowerCase()}-status-badge`).textContent = vData.status;

    const bar = document.getElementById(`${vKey.toLowerCase()}-bar`);
    if (bar) {
        bar.style.width = `${probPct}%`;
        bar.style.backgroundColor = vData.color;
    }

    const card = document.getElementById(`${vKey.toLowerCase()}-card`);
    if (card) {
        if (probPct > 70) {
            card.className = "p-3 rounded-xl bg-slate-800/80 border border-rose-500/60 shadow-lg shadow-rose-950/40 cursor-pointer transition hover:border-rose-400";
        } else if (probPct >= 40) {
            card.className = "p-3 rounded-xl bg-slate-800/80 border border-amber-500/50 shadow-lg shadow-amber-950/30 cursor-pointer transition hover:border-amber-400";
        } else {
            card.className = "p-3 rounded-xl bg-slate-800/80 border border-emerald-500/40 cursor-pointer transition hover:border-emerald-400";
        }
    }
}

// Load SHAP Feature Attribution
async function loadExplanationForTarget(target) {
    currentActiveTarget = target;
    const features = getPatientFeatures();

    try {
        const response = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ features: features, target: target, top_k: 8 })
        });

        if (!response.ok) throw new Error('Explain API error');
        currentExplanation = await response.json();

        // Update Narrative Text
        document.getElementById('shap-narrative-text').textContent = currentExplanation.narrative;
        document.getElementById('current-explain-target-label').textContent = `${target} Stenosis Feature Attribution`;

        // Render Waterfall/Bar Chart
        renderShapChart(currentExplanation.top_features);

    } catch (err) {
        console.error('Explanation failed:', err);
    }
}

// Initialize Chart.js Instances
function initCharts() {
    // 1. SHAP Feature Attribution Horizontal Bar Chart
    const ctxShap = document.getElementById('shapChart').getContext('2d');
    shapChart = new Chart(ctxShap, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'SHAP Value (Impact on Prediction)',
                data: [],
                backgroundColor: [],
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.parsed.x;
                            return `Impact: ${val > 0 ? '+' : ''}${val.toFixed(3)} (${val > 0 ? 'Increases Risk' : 'Decreases Risk'})`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono' } }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#F8FAFC', font: { family: 'Plus Jakarta Sans', weight: '600' } }
                }
            }
        }
    });

    // 2. Physiological Radar Chart
    const ctxRadar = document.getElementById('radarChart').getContext('2d');
    radarChart = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Vascular / Lipids', 'Structural / Echo', 'Electrical / ECG', 'Hemodynamics', 'Clinical Symptoms', 'Demographics'],
            datasets: [{
                label: 'Patient Risk Index',
                data: [50, 50, 50, 50, 50, 50],
                backgroundColor: 'rgba(56, 189, 248, 0.25)',
                borderColor: '#38BDF8',
                borderWidth: 2,
                pointBackgroundColor: '#38BDF8',
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' },
                    pointLabels: { color: '#CBD5E1', font: { family: 'Plus Jakarta Sans', size: 10 } },
                    ticks: { display: false, min: 0, max: 100 }
                }
            }
        }
    });
}

function renderShapChart(topFeatures) {
    if (!shapChart || !topFeatures) return;

    const labels = topFeatures.map(f => `${f.feature} (${typeof f.value === 'number' ? f.value.toFixed(1) : f.value})`);
    const data = topFeatures.map(f => f.shap_value);
    const colors = topFeatures.map(f => f.shap_value > 0 ? '#EF4444' : '#10B981');

    shapChart.data.labels = labels;
    shapChart.data.datasets[0].data = data;
    shapChart.data.datasets[0].backgroundColor = colors;
    shapChart.update();
}

function updateRadarChart(features, pred) {
    if (!radarChart) return;

    // Compute composite normalized sub-scores (0-100)
    // 1. Lipids: LDL, TG, HDL
    const ldlScore = Math.min(100, (features['LDL'] / 180) * 100);
    const tgScore = Math.min(100, (features['TG'] / 250) * 100);
    const lipidIndex = (ldlScore * 0.6 + tgScore * 0.4);

    // 2. Structural: EF (inverse), RWMA, VHD
    const efScore = Math.max(0, Math.min(100, (65 - features['EF-TTE']) * 2.8));
    const rwmaScore = Math.min(100, (features['Region RWMA'] / 4) * 100);
    const structIndex = (efScore * 0.6 + rwmaScore * 0.4);

    // 3. Electrical: ST elevation/depression, Tinversion, Q wave, BBB
    const ecgCount = (features['St Elevation'] || 0) + (features['St Depression'] || 0) + (features['Tinversion'] || 0) + (features['Q Wave'] || 0);
    const ecgIndex = Math.min(100, ecgCount * 25);

    // 4. Hemodynamics: BP, PR
    const bpScore = Math.min(100, ((features['BP'] - 100) / 70) * 100);
    const hemoIndex = Math.max(10, bpScore);

    // 5. Symptoms: Chest Pain, Dyspnea, LowTH
    const sxScore = (features['Typical Chest Pain'] ? 50 : 0) + (features['Dyspnea'] === 'Y' ? 30 : 0) + (features['LowTH Ang'] === 'Y' ? 20 : 0);
    
    // 6. Demographics: Age, Smoking, DM, HTN
    const ageScore = Math.min(100, ((features['Age'] - 30) / 45) * 100);
    const demoIndex = (ageScore * 0.5 + (features['DM'] ? 25 : 0) + (features['HTN'] ? 25 : 0));

    radarChart.data.datasets[0].data = [
        Math.round(lipidIndex),
        Math.round(structIndex),
        Math.round(ecgIndex),
        Math.round(hemoIndex),
        Math.round(sxScore),
        Math.round(demoIndex)
    ];
    radarChart.update();
}

// Load Patient Preset
async function loadPreset(presetKey) {
    try {
        const resp = await fetch('/api/patient/presets');
        const presets = await resp.json();
        const p = presets[presetKey];
        if (!p) return;

        const data = p.data;
        for (const [key, val] of Object.entries(data)) {
            const elem = document.getElementById(`input-${key.replace(/\s+/g, '-')}`);
            if (elem) {
                elem.value = val;
                const valDisplay = document.getElementById(`input-${key.replace(/\s+/g, '-')}-val`);
                if (valDisplay) valDisplay.textContent = val;
            }
        }

        // Set preset dropdown value
        const presetSelect = document.getElementById('preset-selector');
        if (presetSelect) presetSelect.value = presetKey;

        // Run Prediction Immediately
        await runPrediction();

    } catch (e) {
        console.error('Error loading preset:', e);
    }
}

function highlightVesselTab(vKey) {
    currentActiveTarget = vKey;
    const explainTabs = document.querySelectorAll('.explain-target-btn');
    explainTabs.forEach(b => {
        if (b.dataset.target === vKey) {
            b.classList.add('bg-sky-500', 'text-white');
        } else {
            b.classList.remove('bg-sky-500', 'text-white');
        }
    });
}

// Fetch Validation Metrics from backend
async function fetchMetrics() {
    try {
        const resp = await fetch('/api/metrics');
        validationMetrics = await resp.json();
        renderMetricsModalContent(validationMetrics);
    } catch (e) {
        console.error('Failed to load metrics:', e);
    }
}

function renderMetricsModalContent(metrics) {
    const container = document.getElementById('metrics-content-container');
    if (!container || !metrics) return;

    let html = `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    `;

    ['CAD', 'LAD', 'LCX', 'RCA'].forEach(t => {
        const tData = metrics[t];
        const bestM = tData[tData.best_model];
        html += `
            <div class="p-4 rounded-xl bg-slate-900 border border-slate-700/80">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-bold text-sky-400">${t} Status</span>
                    <span class="text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-300 font-mono">${tData.best_model}</span>
                </div>
                <div class="space-y-1.5 text-xs">
                    <div class="flex justify-between"><span class="text-slate-400">Accuracy:</span><span class="font-mono text-emerald-400 font-bold">${(bestM.accuracy * 100).toFixed(1)}%</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Precision:</span><span class="font-mono text-slate-200">${(bestM.precision * 100).toFixed(1)}%</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">Recall (Sens):</span><span class="font-mono text-slate-200">${(bestM.recall * 100).toFixed(1)}%</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">F1-Score:</span><span class="font-mono text-amber-400 font-bold">${bestM.f1_score.toFixed(4)}</span></div>
                    <div class="flex justify-between"><span class="text-slate-400">ROC-AUC:</span><span class="font-mono text-indigo-400 font-bold">${bestM.roc_auc.toFixed(4)}</span></div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

// Print / Export Clinical Report
function exportClinicalReport() {
    window.print();
}

// -------------------------------------------------------------
// 1. REAL-TIME ICU TELEMETRY ECG OSCILLOSCOPE MONITOR
// -------------------------------------------------------------
let ecgAnimationId = null;
let ecgX = 0;
let ecgPoints = [];
const ECG_SWEEP_SPEED = 2.4;

function initECGMonitor() {
    const canvas = document.getElementById('ecgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    ecgPoints = new Array(width).fill(midY);
    ecgX = 0;
    let beatPhase = 0;

    function renderECGFrame() {
        const bpm = parseInt(document.getElementById('input-PR')?.value) || 74;
        const beatInterval = (60 / bpm) * 60; // frames per beat at 60fps
        beatPhase = (beatPhase + 1) % beatInterval;
        const normalizedPhase = beatPhase / beatInterval;

        // Dynamic clinical pathology modulation
        let stElevation = 0;
        let stDepression = 0;
        let tInversion = 0;
        let isStemi = false;

        if (currentPredictions) {
            const ladP = currentPredictions.vessels?.LAD?.probability || 0;
            const rcaP = currentPredictions.vessels?.RCA?.probability || 0;
            const lcxP = currentPredictions.vessels?.LCX?.probability || 0;

            if (ladP >= 0.50 || document.getElementById('input-St-Elevation')?.value == '1') {
                stElevation = 18; // 18px elevation
                tInversion = -12;
                isStemi = true;
            } else if (rcaP >= 0.50 || document.getElementById('input-St-Depression')?.value == '1') {
                stDepression = -12;
                tInversion = -10;
            }
        }

        // Generate P-QRS-T voltage vector
        let voltage = 0;
        if (normalizedPhase > 0.08 && normalizedPhase < 0.16) {
            const pNorm = (normalizedPhase - 0.08) / 0.08;
            voltage = Math.sin(pNorm * Math.PI) * 7;
        } else if (normalizedPhase >= 0.20 && normalizedPhase < 0.22) {
            voltage = -6;
        } else if (normalizedPhase >= 0.22 && normalizedPhase < 0.28) {
            const rNorm = (normalizedPhase - 0.22) / 0.06;
            voltage = Math.sin(rNorm * Math.PI) * 44;
        } else if (normalizedPhase >= 0.28 && normalizedPhase < 0.31) {
            voltage = -14;
        } else if (normalizedPhase >= 0.31 && normalizedPhase < 0.44) {
            voltage = stElevation + stDepression;
        } else if (normalizedPhase >= 0.44 && normalizedPhase < 0.62) {
            const tNorm = (normalizedPhase - 0.44) / 0.18;
            voltage = (stElevation + stDepression) * (1.0 - tNorm) + (tInversion !== 0 ? tInversion : 12) * Math.sin(tNorm * Math.PI);
        } else {
            voltage = 0;
        }

        const currentY = midY - voltage + (Math.random() - 0.5) * 1.1;

        for (let s = 0; s < ECG_SWEEP_SPEED; s++) {
            const curIdx = (Math.floor(ecgX) + s) % width;
            ecgPoints[curIdx] = currentY;
            for (let erase = 1; erase <= 16; erase++) {
                ecgPoints[(curIdx + erase) % width] = midY;
            }
        }

        ecgX = (ecgX + ECG_SWEEP_SPEED) % width;

        ctx.clearRect(0, 0, width, height);

        ctx.beginPath();
        ctx.strokeStyle = isStemi ? '#EF4444' : '#10B981';
        ctx.lineWidth = 2.0;
        ctx.lineJoin = 'round';

        let first = true;
        for (let x = 0; x < width; x++) {
            const y = ecgPoints[x];
            if (first) {
                ctx.moveTo(x, y);
                first = false;
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = '#FFFFFF';
        ctx.arc(ecgX, currentY, 3, 0, Math.PI * 2);
        ctx.fill();

        const rhythmBadge = document.getElementById('ecg-rhythm-badge');
        const bpmVal = document.getElementById('ecg-bpm-val');
        if (bpmVal) bpmVal.textContent = bpm;
        if (rhythmBadge) {
            if (isStemi) {
                rhythmBadge.textContent = "STEMI (ST-Elevation)";
                rhythmBadge.className = "badge-pill bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30";
            } else if (stDepression < 0) {
                rhythmBadge.textContent = "Ischemia (ST-Depression)";
                rhythmBadge.className = "badge-pill bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30";
            } else {
                rhythmBadge.textContent = "Normal Sinus";
                rhythmBadge.className = "badge-pill bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
            }
        }

        ecgAnimationId = requestAnimationFrame(renderECGFrame);
    }

    renderECGFrame();
}

// -------------------------------------------------------------
// 2. VIRTUAL INTRAVASCULAR ULTRASOUND (IVUS) & FFR RENDERER
// -------------------------------------------------------------
function renderIVUSSlice(vesselKey) {
    if (!vesselKey || vesselKey === 'CAD') vesselKey = 'LAD';
    const canvas = document.getElementById('ivusCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    const hemo = currentPredictions?.hemodynamics?.vessels?.[vesselKey];
    const pctStenosis = hemo?.percent_stenosis || 20.0;
    const ffr = hemo?.ffr || 0.94;
    const isIschemic = hemo?.is_ischemic || false;

    // Update Display Labels
    const titleElem = document.getElementById('ivus-vessel-title');
    if (titleElem) titleElem.textContent = vesselKey;

    const ffrElem = document.getElementById('ivus-ffr-val');
    if (ffrElem) {
        ffrElem.textContent = ffr.toFixed(2);
        ffrElem.className = `font-mono font-bold text-xs ${isIschemic ? 'text-rose-400' : 'text-emerald-400'}`;
    }

    const pctElem = document.getElementById('ivus-pct-stenosis');
    if (pctElem) {
        pctElem.textContent = `${pctStenosis}%`;
        pctElem.className = `font-mono font-bold text-xs ${pctStenosis >= 50 ? 'text-rose-400' : (pctStenosis >= 30 ? 'text-amber-400' : 'text-emerald-400')}`;
    }

    const mlaElem = document.getElementById('ivus-mla-val');
    if (mlaElem) mlaElem.textContent = `${hemo?.mla_mm2 || 7.2} mm²`;

    const plaqueElem = document.getElementById('ivus-plaque-val');
    if (plaqueElem) plaqueElem.textContent = `${hemo?.plaque_burden_pct || 22}%`;

    const badge = document.getElementById('ivus-ischemia-badge');
    if (badge) {
        if (isIschemic) {
            badge.textContent = `Ischemic (+) FFR ≤ 0.80`;
            badge.className = "badge-pill bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30";
        } else {
            badge.textContent = `Preserved (FFR > 0.80)`;
            badge.className = "badge-pill bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
        }
    }

    // Canvas Render
    ctx.clearRect(0, 0, w, h);

    // 1. External Elastic Membrane (Outer Vessel Border)
    const outerR = 36;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = "#1E293B";
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 2. Atherosclerotic Lipid/Fibrous Plaque (Amber/Crimson Crescent)
    const plaqueFraction = pctStenosis / 100.0;
    const lumenR = Math.max(7, outerR * (1.0 - plaqueFraction * 0.72));

    ctx.beginPath();
    ctx.arc(cx, cy, outerR - 1, 0, Math.PI * 2);
    ctx.fillStyle = isIschemic ? "#7F1D1D" : (pctStenosis >= 30 ? "#78350F" : "#1E293B");
    ctx.fill();

    // 3. Eccentric Residual Patent Lumen (Blood Channel)
    const lumenShiftX = cx + (outerR - lumenR) * 0.35;
    const lumenShiftY = cy - (outerR - lumenR) * 0.25;

    ctx.beginPath();
    ctx.arc(lumenShiftX, lumenShiftY, lumenR, 0, Math.PI * 2);
    ctx.fillStyle = isIschemic ? "#991B1B" : "#0284C7";
    ctx.fill();
    ctx.strokeStyle = isIschemic ? "#EF4444" : "#38BDF8";
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

// -------------------------------------------------------------
// 3. "WHAT-IF" COUNTERFACTUAL INTERVENTION SIMULATOR
// -------------------------------------------------------------
let lastInterventionResult = null;

function openInterventionModal() {
    document.getElementById('intervention-modal').classList.remove('hidden');
    // Pre-populate if simulation already run
    if (!lastInterventionResult) {
        executeInterventionSimulation();
    }
}

async function executeInterventionSimulation() {
    const features = getPatientFeatures();
    const interventions = {
        statin: document.getElementById('treat-statin').checked,
        bp_control: document.getElementById('treat-bp').checked,
        smoking_cessation: document.getElementById('treat-smoke').checked,
        glucose_control: document.getElementById('treat-glucose').checked,
        rehab: document.getElementById('treat-rehab').checked,
        anti_ischemic: document.getElementById('treat-ischemic')?.checked ?? true
    };

    try {
        const resp = await fetch('/api/simulate_intervention', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ features: features, interventions: interventions })
        });

        if (!resp.ok) throw new Error('Simulation failed');
        lastInterventionResult = await resp.json();

        // Populate results
        const resDiv = document.getElementById('intervention-results');
        resDiv.classList.remove('hidden');

        const bCAD = Math.round(lastInterventionResult.baseline_prediction.overall_cad.probability * 100);
        const pCAD = Math.round(lastInterventionResult.post_intervention_prediction.overall_cad.probability * 100);
        document.getElementById('sim-cad-delta').textContent = `${bCAD}% → ${pCAD}%`;
        document.getElementById('sim-cad-pct').textContent = `-${lastInterventionResult.cad_relative_reduction_pct}% Relative`;

        const vDeltas = lastInterventionResult.vessel_deltas;
        const bLAD = Math.round(vDeltas.LAD.baseline_probability * 100);
        const pLAD = Math.round(vDeltas.LAD.post_probability * 100);
        document.getElementById('sim-lad-delta').textContent = `${bLAD}% → ${pLAD}%`;
        document.getElementById('sim-lad-pct').textContent = pLAD < 30 ? "Patent Reversal" : `-${Math.round(bLAD - pLAD)}% Abs`;

        const bLCX = Math.round(vDeltas.LCX.baseline_probability * 100);
        const pLCX = Math.round(vDeltas.LCX.post_probability * 100);
        document.getElementById('sim-lcx-delta').textContent = `${bLCX}% → ${pLCX}%`;
        document.getElementById('sim-lcx-pct').textContent = pLCX < 50 ? "Risk Normalized" : `-${Math.round(bLCX - pLCX)}% Abs`;

        const bRCA = Math.round(vDeltas.RCA.baseline_probability * 100);
        const pRCA = Math.round(vDeltas.RCA.post_probability * 100);
        document.getElementById('sim-rca-delta').textContent = `${bRCA}% → ${pRCA}%`;
        document.getElementById('sim-rca-pct').textContent = pRCA < 30 ? "Patent (Stable)" : `-${Math.round(bRCA - pRCA)}% Abs`;

        const narrativeElem = document.getElementById('sim-narrative-summary');
        if (narrativeElem) {
            const treatmentsText = lastInterventionResult.applied_treatments.join('; ');
            narrativeElem.textContent = `Applied Clinical Protocol: ${treatmentsText || 'None'}. Projected overall CAD risk reduction of ${lastInterventionResult.cad_relative_reduction_pct}%, successfully mitigating flow-limiting ischemic progression.`;
        }

    } catch (err) {
        console.error('Intervention simulation error:', err);
    }
}

function applyInterventionTo3D() {
    if (!lastInterventionResult) return;
    // Update 3D anatomy with post-treatment counterfactual probabilities
    if (visualizer3D) {
        visualizer3D.updateRiskColors(lastInterventionResult.post_intervention_prediction);
    }
    updateDashboardUI(lastInterventionResult.post_intervention_prediction);
    document.getElementById('intervention-modal').classList.add('hidden');
}

// -------------------------------------------------------------
// 4. HOSPITAL CARDIOLOGY CONSULTATION REPORT (S.O.A.P.)
// -------------------------------------------------------------
let cachedSoapText = "";

async function openSoapModal() {
    const features = getPatientFeatures();
    const modal = document.getElementById('soap-modal');
    modal.classList.remove('hidden');

    try {
        const resp = await fetch('/api/generate_soap_note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ features: features })
        });

        if (!resp.ok) throw new Error('SOAP note API error');
        const data = await resp.json();

        document.getElementById('soap-subj').textContent = data.subjective;
        document.getElementById('soap-obj').textContent = data.objective;
        document.getElementById('soap-assess').textContent = data.assessment;
        document.getElementById('soap-plan').textContent = data.plan;

        cachedSoapText = data.full_note;

    } catch (err) {
        console.error('SOAP note error:', err);
    }
}

function copySoapNote() {
    if (!cachedSoapText) return;
    navigator.clipboard.writeText(cachedSoapText).then(() => {
        const btnText = document.getElementById('copy-soap-btn-text');
        btnText.textContent = "Copied to Clipboard!";
        setTimeout(() => { btnText.textContent = "Copy Full Note"; }, 2500);
    });
}

// -------------------------------------------------------------
// 5. BENCHMARK COHORT PATIENT EXPLORER
// -------------------------------------------------------------
let cohortCache = [];

async function openCohortModal() {
    const modal = document.getElementById('cohort-modal');
    modal.classList.remove('hidden');

    if (cohortCache.length === 0) {
        try {
            const resp = await fetch('/api/cohort');
            cohortCache = await resp.json();
            renderCohortTable(cohortCache);
        } catch (err) {
            console.error('Cohort loading error:', err);
        }
    }
}

function renderCohortTable(cohort) {
    const tbody = document.getElementById('cohort-table-body');
    if (!tbody) return;

    let rows = '';
    cohort.forEach((pt, index) => {
        const isCad = pt.ground_truth.CAD.toLowerCase().includes('cad');
        const badgeCol = isCad ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        
        rows += `
            <tr class="hover:bg-slate-800/40 transition">
                <td class="p-2 font-mono font-bold text-sky-400">${pt.patient_id}</td>
                <td class="p-2">${pt.age}y / ${pt.sex}</td>
                <td class="p-2"><span class="badge-pill ${badgeCol} text-[10px]">${pt.category}</span></td>
                <td class="p-2 font-mono text-[11px] text-slate-300">
                    LAD:${pt.ground_truth.LAD} | LCX:${pt.ground_truth.LCX} | RCA:${pt.ground_truth.RCA}
                </td>
                <td class="p-2 font-mono">${pt.ef_tte}%</td>
                <td class="p-2 font-mono text-slate-400">${pt.bp} / ${pt.ldl}</td>
                <td class="p-2 text-right">
                    <button onclick="loadCohortPatient(${index})" class="px-3 py-1 rounded-lg bg-sky-600/30 hover:bg-sky-500 text-white font-semibold text-[11px] transition">
                        Load Patient
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rows;
}

async function loadCohortPatient(index) {
    const pt = cohortCache[index];
    if (!pt) return;

    // Populate all form inputs
    Object.entries(pt.features).forEach(([key, val]) => {
        const elem = document.getElementById(`input-${key}`);
        if (elem) {
            elem.value = val;
            const valDisplay = document.getElementById(`input-${key}-val`);
            if (valDisplay) valDisplay.textContent = val;
        }
    });

    // Run prediction
    await runPrediction();

    // Close modal
    document.getElementById('cohort-modal').classList.add('hidden');
}

