"""CardioCity — urban systems and healthcare-access analysis.

A deterministic synthetic demonstration city: a routing graph with facility
locations by public category, and Dijkstra travel-time analysis from any node.
Hypothetical access scenarios (add a facility, close a road) recompute the same
way. Everything is labelled as a synthetic network.

Honesty rules:
- No live traffic, bed availability, ambulance positions or emergency dispatch claims.
- Travel times are graph estimates on a synthetic network, not real-world guidance.
- The graph model is OSM-*compatible* in shape (nodes/edges/categories), so a
  real OSM-derived graph can be loaded later without changing the analysis code.
"""

from __future__ import annotations

import heapq
import math
from typing import Any

CITY_NOTICE = (
    "Synthetic demonstration city network. Travel times are graph estimates, not "
    "emergency dispatch guidance; no live traffic or facility-availability data is used."
)

# Nodes: id, x/y in local metres (deterministic layout), residential population anchor.
_NODES: list[dict[str, Any]] = [
    {"id": "n01", "x": 0, "y": 0, "residents": 5200},
    {"id": "n02", "x": 1400, "y": 200, "residents": 4300},
    {"id": "n03", "x": 2800, "y": 0, "residents": 6100},
    {"id": "n04", "x": 700, "y": 1300, "residents": 3800},
    {"id": "n05", "x": 2100, "y": 1500, "residents": 5500},
    {"id": "n06", "x": 3500, "y": 900, "residents": 4700},
    {"id": "n07", "x": 0, "y": 2600, "residents": 3100},
    {"id": "n08", "x": 1500, "y": 2900, "residents": 5900},
    {"id": "n09", "x": 3000, "y": 2700, "residents": 4200},
    {"id": "n10", "x": 800, "y": 3900, "residents": 2800},
    {"id": "n11", "x": 2400, "y": 4100, "residents": 5100},
    {"id": "n12", "x": 3700, "y": 3300, "residents": 3600},
]

# Edges: bidirectional road segments with length (m) and free-flow speed (m/s).
_EDGES: list[tuple[str, str, float, float]] = [
    ("n01", "n02", 1420, 11), ("n02", "n03", 1430, 11),
    ("n01", "n04", 1470, 10), ("n04", "n05", 1530, 10),
    ("n05", "n06", 1450, 11), ("n03", "n06", 1170, 12),
    ("n04", "n07", 1480, 9), ("n07", "n08", 1560, 10),
    ("n08", "n09", 1510, 10), ("n09", "n06", 1350, 11),
    ("n08", "n05", 1620, 9), ("n07", "n10", 1150, 8),
    ("n10", "n11", 1670, 9), ("n11", "n09", 920, 10),
    ("n11", "n12", 1310, 10), ("n12", "n09", 1020, 11),
    ("n10", "n08", 1270, 8), ("n12", "n06", 2590, 12),
]

# Facilities by public category (positions on nodes).
_FACILITIES: list[dict[str, Any]] = [
    {"id": "h1", "name": "Central Cardiac Centre", "category": "hospital", "node": "n05"},
    {"id": "h2", "name": "Northside Hospital", "category": "hospital", "node": "n10"},
    {"id": "c1", "name": "Riverside Cardiology Clinic", "category": "clinic", "node": "n02"},
    {"id": "c2", "name": "Hilltop Clinic", "category": "clinic", "node": "n08"},
    {"id": "p1", "name": "Market Pharmacy", "category": "pharmacy", "node": "n01"},
    {"id": "p2", "name": "East Gate Pharmacy", "category": "pharmacy", "node": "n06"},
]

_ACCESS_TARGET_MINUTES = 20.0  # demonstration threshold for access statistics


def city_graph() -> dict[str, Any]:
    return {
        "nodes": _NODES,
        "edges": [
            {"a": a, "b": b, "length_m": round(length, 0), "speed_mps": speed, "travel_minutes": round(length / speed / 60.0, 2)}
            for a, b, length, speed in _EDGES
        ],
        "facilities": _FACILITIES,
        "notice": CITY_NOTICE,
    }


def _adjacency(closed_edges: set[tuple[str, str]]) -> dict[str, list[tuple[str, float]]]:
    adj: dict[str, list[tuple[str, float]]] = {node["id"]: [] for node in _NODES}
    for a, b, length, speed in _EDGES:
        if (a, b) in closed_edges or (b, a) in closed_edges:
            continue
        minutes = length / speed / 60.0
        adj[a].append((b, minutes))
        adj[b].append((a, minutes))
    return adj


def travel_times(from_node: str, closed_edges: set[tuple[str, str]] | None = None) -> dict[str, float]:
    """Dijkstra travel times (minutes) from a node to every other node."""
    if from_node not in {n["id"] for n in _NODES}:
        raise ValueError(f"Unknown node: {from_node}")
    adj = _adjacency(closed_edges or set())
    dist: dict[str, float] = {from_node: 0.0}
    heap: list[tuple[float, str]] = [(0.0, from_node)]
    while heap:
        d, node = heapq.heappop(heap)
        if d > dist.get(node, math.inf):
            continue
        for neighbour, minutes in adj[node]:
            nd = d + minutes
            if nd < dist.get(neighbour, math.inf):
                dist[neighbour] = nd
                heapq.heappush(heap, (nd, neighbour))
    return dist


def access_analysis(
    from_node: str | None = None,
    *,
    closed_edges: list[tuple[str, str]] | None = None,
    added_facility: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Facility access times and population-weighted access statistics.

    Without ``from_node`` the analysis is city-wide (every residential node to
    its nearest facility of each category). Scenarios: close road segments or
    add a hypothetical facility, then recompute.
    """
    facilities = [dict(f) for f in _FACILITIES]
    if added_facility:
        if added_facility.get("node") not in {n["id"] for n in _NODES}:
            raise ValueError("added facility must reference an existing node")
        facilities.append({**added_facility, "id": added_facility.get("id", "new-facility")})
    closed = {tuple(e) for e in (closed_edges or [])}
    nodes = {node["id"]: node for node in _NODES}

    if from_node is not None:
        dist = travel_times(from_node, closed)
        reachable = [
            {
                "facility": f,
                "travel_minutes": round(dist.get(f["node"], math.inf), 2)
                if math.isfinite(dist.get(f["node"], math.inf)) else None,
            }
            for f in facilities
        ]
        reachable.sort(key=lambda r: (r["travel_minutes"] is None, r["travel_minutes"] or 0))
        nearest = next((r for r in reachable if r["travel_minutes"] is not None), None)
        return {
            "from_node": from_node,
            "facilities": reachable,
            "nearest": nearest,
            "closed_edges": sorted(map(list, closed)),
            "added_facility": added_facility,
            "notice": CITY_NOTICE,
        }

    # City-wide population-weighted statistics per category.
    categories = sorted({f["category"] for f in facilities})
    per_category: dict[str, dict[str, Any]] = {}
    for category in categories:
        cat_facilities = [f for f in facilities if f["category"] == category]
        weighted_sum, total_residents, worst_node, worst_minutes, within = 0.0, 0, None, 0.0, 0
        for node_id, node in nodes.items():
            dist = travel_times(node_id, closed)
            best = min(
                (dist.get(f["node"], math.inf) for f in cat_facilities), default=math.inf
            )
            minutes = best if math.isfinite(best) else None
            residents = node["residents"]
            total_residents += residents
            if minutes is None:
                worst_node, worst_minutes = node_id, math.inf
                continue
            weighted_sum += minutes * residents
            if minutes <= _ACCESS_TARGET_MINUTES:
                within += residents
            if minutes > worst_minutes and minutes < math.inf:
                worst_node, worst_minutes = node_id, minutes
        per_category[category] = {
            "facilities": len(cat_facilities),
            "population_weighted_mean_minutes": round(weighted_sum / total_residents, 2) if total_residents else None,
            "residents_within_20min": within,
            "share_within_20min": round(within / total_residents, 4) if total_residents else None,
            "worst_served_node": worst_node,
            "worst_travel_minutes": None if worst_minutes == math.inf else round(worst_minutes, 2),
        }
    return {
        "city_wide": per_category,
        "access_target_minutes": _ACCESS_TARGET_MINUTES,
        "closed_edges": sorted(map(list, closed)),
        "added_facility": added_facility,
        "scenario_label": "hypothetical scenario" if (closed or added_facility) else "baseline",
        "notice": CITY_NOTICE,
    }
