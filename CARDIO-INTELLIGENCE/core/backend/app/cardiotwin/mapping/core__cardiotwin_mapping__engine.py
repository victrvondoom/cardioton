"""CardioTwin Scientific Evidence Mapping & Analytics Engine.

Transforms normalized evidence records into multi-stage relational flow graphs (Sankey visualization),
calculates evidence maturity metrics, filters evidence by clinical parameters, and manages reviewer screening statistics.
"""

from __future__ import annotations

import hashlib
import re
from collections import Counter
from datetime import UTC, datetime

from app.cardiotwin.analytics.core__cardiotwin_analytics__fixtures import demo_records
from app.cardiotwin.analytics.core__cardiotwin_analytics__repository import ResearchRepository
from app.cardiotwin.evidence.schema import (
    DataMode,
    EvidenceEdge,
    EvidenceGraphData,
    EvidenceNode,
    EvidenceRecord,
    ReviewScreeningStats,
)
from app.core__backend_app__config import settings


class EvidenceMappingEngine:
    """Core mapping engine for CardioTwin Global Evidence."""

    def __init__(self, repository: ResearchRepository | None = None) -> None:
        self.repository = repository or ResearchRepository()
        if not self.repository.records() and not settings.CARDIOTWIN_GLOBAL_LIVE_SOURCES:
            self.repository.ingest(demo_records())

    def get_all_records(self, force_refresh: bool = False) -> list[EvidenceRecord]:
        return self.repository.records()

    def filter_records(
        self,
        records: list[EvidenceRecord],
        query: str | None = None,
        clinical_area: str | None = None,
        modality: str | None = None,
        task_category: str | None = None,
        validation_grade: str | None = None,
        intervention: str | None = None,
        study_type: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[EvidenceRecord]:
        filtered = list({(r.source_name, r.source_identifier): r for r in records}.values())

        if query:
            tokens = [t.lower() for t in re.findall(r"[\w-]+", query) if len(t) >= 2]
            if tokens:
                filtered = [
                    r for r in filtered
                    if any(
                        t in r.title.lower()
                        or t in r.target_indication.lower()
                        or t in (r.intervention_or_device or "").lower()
                        or t in r.authors_or_sponsor.lower()
                        or t in r.source_identifier.lower()
                        for t in tokens
                    )
                ]

        if clinical_area:
            filtered = [r for r in filtered if r.clinical_area.value == clinical_area or r.clinical_area.name == clinical_area]

        if modality:
            filtered = [r for r in filtered if r.modality.value == modality or r.modality.name == modality]

        if task_category:
            filtered = [r for r in filtered if r.task_category.value == task_category or r.task_category.name == task_category]

        if validation_grade:
            filtered = [r for r in filtered if r.validation_grade.value == validation_grade or r.validation_grade.name == validation_grade]

        if intervention:
            filtered = [r for r in filtered if intervention.lower() in (r.intervention_or_device or "").lower()]
        if study_type:
            filtered = [r for r in filtered if study_type.lower() in r.study_design.lower()]
        if date_from:
            filtered = [r for r in filtered if r.publication_or_start_date and r.publication_or_start_date >= date_from]
        if date_to:
            filtered = [r for r in filtered if r.publication_or_start_date and r.publication_or_start_date[:10] <= date_to]

        return filtered

    def build_sankey_graph(
        self,
        query: str | None = None,
        clinical_area: str | None = None,
        modality: str | None = None,
        task_category: str | None = None,
        validation_grade: str | None = None,
        intervention: str | None = None,
        study_type: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> EvidenceGraphData:
        records = self.get_all_records()
        filtered = self.filter_records(
            records,
            query=query,
            clinical_area=clinical_area,
            modality=modality,
            task_category=task_category,
            validation_grade=validation_grade,
            intervention=intervention, study_type=study_type, date_from=date_from, date_to=date_to,
        )

        nodes_map: dict[str, EvidenceNode] = {}
        edges_map: dict[str, EvidenceEdge] = {}

        def add_node(nid: str, label: str, cat: str) -> None:
            if nid in nodes_map:
                nodes_map[nid].count += 1
            else:
                nodes_map[nid] = EvidenceNode(id=nid, label=label, category=cat, count=1)

        def add_edge(src: str, tgt: str, flow_cat: str, rec_id: str) -> None:
            key = f"{src}->{tgt}"
            if key in edges_map:
                edges_map[key].value += 1
                edges_map[key].evidence_ids.append(rec_id)
            else:
                edges_map[key] = EvidenceEdge(
                    source=src,
                    target=tgt,
                    value=1,
                    flow_category=flow_cat,
                    evidence_ids=[rec_id],
                )

        # Build 4-stage flow: Source -> Clinical Area -> Modality -> Clinical Task -> Indication
        for r in filtered:
            src_id = f"src-{hashlib.sha256(r.source_name.encode()).hexdigest()[:16]}"
            area_id = f"area-{r.clinical_area.name.lower()}"
            mod_id = f"mod-{r.modality.name.lower()}"
            task_id = f"task-{r.task_category.name.lower()}"
            target_id = f"target-{hashlib.sha256(r.target_indication.encode()).hexdigest()[:16]}"

            add_node(src_id, r.source_name, "source")
            add_node(area_id, r.clinical_area.value, "area")
            add_node(mod_id, r.modality.value, "modality")
            add_node(task_id, r.task_category.value.title(), "task")
            add_node(target_id, r.target_indication, "target")

            add_edge(src_id, area_id, "source_to_area", r.id)
            add_edge(area_id, mod_id, "area_to_modality", r.id)
            add_edge(mod_id, task_id, "modality_to_task", r.id)
            add_edge(task_id, target_id, "task_to_target", r.id)

        has_synthetic = any(r.data_mode == DataMode.SYNTHETIC_DEMO for r in filtered)
        current_data_mode = DataMode.SYNTHETIC_DEMO if has_synthetic else DataMode.PUBLIC_SCIENTIFIC

        by_record_id = {record.id: record for record in filtered}
        for edge in edges_map.values():
            statuses = {by_record_id[record_id].mapping_status for record_id in edge.evidence_ids}
            edge.verification_status = next(iter(statuses)) if len(statuses) == 1 else "mixed"

        return EvidenceGraphData(
            nodes=list(nodes_map.values()),
            edges=list(edges_map.values()),
            total_records=len(filtered),
            data_mode=current_data_mode,
            as_of=max((r.retrieved_at for r in filtered), default=datetime.now(UTC).isoformat()),
            filter_summary={
                "query": query,
                "clinical_area": clinical_area,
                "modality": modality,
                "task_category": task_category,
                "validation_grade": validation_grade,
                "intervention": intervention, "study_type": study_type, "date_from": date_from, "date_to": date_to,
            },
        )

    def get_review_stats(self, records: list[EvidenceRecord] | None = None) -> ReviewScreeningStats:
        records = records if records is not None else self.get_all_records()
        grade_counts: dict[str, int] = {}
        for r in records:
            g = r.validation_grade.value
            grade_counts[g] = grade_counts.get(g, 0) + 1

        count = len(records)
        def explicitly_randomized(record: EvidenceRecord) -> bool:
            design = record.trial_metadata.get("study_design", {})
            if isinstance(design, dict) and design.get("allocation"):
                return bool(design["allocation"] == "RANDOMIZED")
            # Only explicit labels count; 'nonrandomized' must never match.
            label = record.study_design.strip().lower()
            return label in {"randomized controlled trial", "randomised controlled trial", "interventional (randomized)", "interventional (randomised)", "rct"}
        modalities = Counter(r.modality.value for r in records)
        top = modalities.most_common(1)
        return ReviewScreeningStats(
            articles_retrieved=count,
            articles_screened=sum(r.human_verified for r in records),
            ai_articles_screened=0,
            ai_articles_included=0,
            rct_percentage=100 * sum(explicitly_randomized(r) for r in records) / count if count else 0,
            prospective_percentage=100 * sum("prospective" in r.study_design.lower() for r in records) / count if count else 0,
            top_modality=f"{top[0][0]} ({top[0][1]}/{count})" if top else "No records",
            independent_reviewers=0,
            grade_distribution=grade_counts,
        )
