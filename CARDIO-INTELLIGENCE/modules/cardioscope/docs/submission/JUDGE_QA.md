# Judge Q&A

Use frozen V1 final results as primary evidence. V2/V2.1 are post-holdout development-only studies, not external or independent validation. Keep answers short; point to the six-page report or technical documents for details.

**1. Why this problem?** A score alone is hard to interpret spatially. Track A asks for prediction, coronary visualization and explanations; CardioScope connects all three with inspectable evidence.

**2. What is novel?** The contribution is an integrated, reproducible inspection workflow: verified coronary anatomy, linked vessel/model interaction, target-specific source-feature SHAP, saved evidence and reproducible scientific provenance. We do not claim a new classifier algorithm or state-of-the-art results.

**3. Why four separate classifiers?** The dataset supplies an overall CAD label and three vessel labels. We model each supervised target explicitly. "Separate" describes trained pipelines, not statistical independence of the clinical labels.

**4. Why not derive CAD from vessel outputs?** CAD has its own supplied target definition. Combining thresholded vessel predictions would introduce an unvalidated rule and compound errors; V1 instead uses its separately evaluated CAD classifier.

**5. Why these algorithms?** A small dataset favors a bounded search. Balanced L2 logistic regression was selected for CAD/LAD; shallow unweighted forests for LCX/RCA, using the documented development-only inner-score rule. All forest references use 100 trees; depths 3/5 and minimum leaf size 10.

**6. Why not deep learning originally?** With only 242 development records, a compact classical baseline offered lower complexity and inspectable training. That is a design choice, not proof that neural models can never help.

**7. Did you later test deep learning?** Yes, one final bounded preregistered development-only study. A small shared MLP learned all four labels, with just two layouts, two dropout values, two L2 values and two fixed task-loss weight choices.

**8. What happened to the multi-task model?** RCA's mean scores were higher on paired development folds; its vessel gate passed. LCX had an ineligible fold and insufficient sensitivity/stability; CAD balanced accuracy exceeded the permitted decline. The joint gate failed, the study stopped, and no final all-development neural candidate was fitted.

**9. Why are LCX/RCA weaker?** The observed facts are moderate ranking and poor sensitivity at 0.5 in a small same-source dataset. Limited sample size, target-specific information and operating threshold may contribute, but we have not established a clinical cause or isolated one explanation experimentally.

**10. Why not just lower thresholds?** Lowering a threshold trades specificity for sensitivity. The consumed final holdout cannot be used to choose a replacement. V2 tested a predefined inner-CV screening criterion; it did not deliver the required stable joint improvement.

**11. Did you try to improve LCX/RCA?** V1 honestly exposed weak sensitivity; its holdout was then treated as consumed. V2 tested thresholds, elastic-net, forests/cost sensitivity and XGBoost with development-only repeated nested CV; its locked gate failed. V2.1 tested a small multi-task neural model; RCA's mean scores were higher on paired development folds, but LCX and CAD preservation failed. Neither was deployed. A genuinely new untouched cohort is needed for independent validation of a new model.

**12. Why not deploy V2?** It failed the preregistered joint development gate. Its full-development candidates remain research artifacts, without independent new-cohort evaluation.

**13. Why not deploy the neural model?** A single vessel's internal gain did not satisfy the two-vessel and stronger-task safeguards. Preserving the evaluated V1 was the predefined disposition on failure.

**14. What does ROC-AUC mean?** It describes ranking across thresholds: how often a positive record receives a higher score than a negative one. It is not threshold-specific recall, probability calibration, or evidence of clinical usefulness by itself.

**15. Why low recall despite moderate AUC?** Ranking and the fixed classification cutoff answer different questions. LCX/RCA scores ranked moderately but many true positives remained below 0.5. Their once-only holdout recall was 0.2083/0.2857; the interface does not hide these misses.

**16. Why nested CV?** Model selection uses inner folds; outer validation assesses that selection procedure on unseen development records. Preprocessing, candidate choices and any later research thresholds stay inside the outer-training boundary.

**17. How did you prevent leakage?** An exact 55-column allowlist excludes Cath/LAD/LCX/RCA and aliases. Scalers and automatic encoder vocabularies fit training partitions only; groups stay disjoint; selection uses inner scores. The final holdout was locked before development and access was guarded.

**18. Was the holdout used more than once?** V1 performed one batch inference per target on the prespecified 61 records. Later dashboards/docs read saved aggregate evidence; they do not rerun inference or decode reserved source labels. V2/V2.1 used only the original 242 development outcomes.

**19. Is V2 externally validated?** No. Neither research study is independently or externally validated; repeated nested development CV is internal evidence only.

**20. Why only 303 source records?** This is the size of the supplied public UCI research dataset. We did not manufacture additional records. Small-sample and same-source limitations remain explicit; no representativeness claim is made.

**21. Are the probabilities calibrated?** Calibration is unverified; no calibration fit was added. The UI says model-estimated probability, not established clinical risk.

**22. What does SHAP explain?** It decomposes the frozen model output relative to a fixed reference into signed source-feature associations for this profile. It does not establish a causal factor, disease mechanism or treatment.

**23. Why different SHAP units?** Logistic models are reconstructed in positive-class log-odds; forest outputs are reconstructed in positive-class probability space. The units match each explainer/model contract and are labeled; contributions across these spaces are not directly comparable.

**24. Why 100 background records?** A deterministic 100-record development-only reference fixes the computational and comparison context. It is a frozen design choice, not a clinically representative control cohort or a result-dependent selection. No holdout record is used in the background.

**25. Is the heart patient-specific?** No. It is BodyParts3D reference anatomy. Clinical tabular fields are not anatomical coordinates or imaging reconstructions.

**26. Does CardioScope locate stenosis?** No. It predicts each named vessel's binary source label and colors the whole anatomical group. It does not locate lesions, estimate diameters or calculate percent narrowing.

**27. How do colors work?** A fixed continuous blue-to-red scale encodes lower-to-higher vessel model probability; selected geometry gets a separate highlight. The legend and numeric values accompany color. Neutral styling means no accepted prediction, not zero risk.

**28. What happens if SHAP fails?** The explanation panel shows an explicit unavailable state. Verified numerical predictions and evidence remain usable; partial or mismatched explanations are not accepted.

**29. What happens if WebGL fails?** The viewer reports failure, and numerical outputs/evidence provide the fallback. The UI does not imply successful rendering or substitute fake anatomy.

**30. What runs offline?** After installation/build, bundled models, mesh files, SHAP reference and saved evidence are served locally. No cloud AI API or external CDN is required for inference. Package/container installation and opening upstream links require network.

**31. Is it reproducible?** Frozen model/source/configuration hashes, exact scientific packages, shared split, deterministic SHAP reference, Docker and documented checks support reproduction. Hardened V1 passed 134 Python and 75 frontend tests on macOS ARM64 and clean Ubuntu ARM64. Hosted GitHub Actions has not yet run; its workflow is prepared and locally validated.

**32. What is needed before clinical use?** Independently collected representative data, verified patient identity/grouping, prospective external validation, calibration and operating-threshold assessment, expert review and appropriate deployment/security/governance work. Current screenshots and same-source holdout results do not establish that readiness.

**33. What would more data improve?** Larger representative cohorts could support more stable vessel estimates and honest independent evaluation. Any new model would need its own prespecified development procedure and new untouched evaluation cohort; improvements cannot be promised in advance.

**34. Why stop searching?** Both research studies had predefined bounded searches and stopping gates. Their failure was the stopping condition. Continuing until numbers looked favorable would weaken the credibility of the evidence.

**35. Which results should we judge as the product's performance?** The frozen V1 once-only 61-record holdout: CAD/LAD ROC-AUC 0.9134/0.8474; LCX/RCA 0.6723/0.6976. All four targets, recalls, matrices and limits are reported. Research CV values are explicitly separate.

**36. Is the repository already published or licensed?** The owner selected MIT for project code; upstream dataset/anatomy/dependency terms remain separate. This is a clean public snapshot with fresh history and all seven organizer PDFs excluded. The archival repository remains preserved. Publication status is recorded in the README; video and Devpost submission are separate user tasks.

**37. What does 3D add beyond three vessel probability bars?** Spatial orientation of the named arteries, linked numerical/anatomical inspection and selection from either a card or geometry. We have not measured improved comprehension or clinical outcomes.

**38. Is LCX better than always predicting Normal?** Its frozen-holdout thresholded accuracy equals the majority-class Normal baseline: 37/61 (0.6066). Its nonconstant scores contain ranking information (ROC-AUC 0.6723), but positive detection at 0.5 is weak. RCA has only one more correct classification than its Normal baseline: 41/61 versus 40/61. Neither is strong thresholded performance.

**39. Can CAD say Normal while a vessel says Stenotic?** Yes. The four classifiers are separately trained, and logical consistency between their outputs is not enforced. That is a limitation; the interface does not turn them into a joint probability model.

**40. Does this predict heart attack or future cardiovascular risk?** No. It predicts the supplied CAD/LAD/LCX/RCA source labels, not future events. It is not a longitudinal event-risk model. Normal is the model's dataset class label at threshold 0.5, not a clinical finding that disease is absent.

**41. Are all 55 inputs realistically available at deployment time?** This has not been prospectively validated. The prototype follows the source schema; clinical acquisition workflow and timing are outside the current validation.

**42. Does exact SHAP reconstruction mean the explanation is clinically correct?** No. It verifies numerical consistency with the model. It does not establish causality, stability under correlated features or clinical validity.

**43. Why should the 61-record holdout generalize?** It does not establish external generalization. It is a prespecified same-source holdout only; a new independent cohort would be needed to assess broader performance.

Research metric summaries, wherever quoted, are **unweighted outer-fold means**, separate from V1 final-holdout evidence. V2 uses 25 folds per vessel; V2.1 has 24 eligible LCX folds and 25 RCA folds. Both studies are post-holdout, development-only, without independent validation or deployment.
