# Global cardiovascular environmental context

The additive authenticated environment adapter supplies public geography and source-backed ambient context. It never receives patient identifiers, report text or a patient location history. Selected coordinates are contextual; they do not establish physical presence or personal exposure.

## Sources verified on 9 October 2026

| Source | Implemented variables | Resolution / boundary |
|---|---|---|
| [Open-Meteo CAMS global](https://open-meteo.com/en/docs/air-quality-api) | PM2.5, PM10, NO₂, O₃ | Approximately 45 km / 0.4°, native three-hourly global steps interpolated hourly by the provider; archive from August 2022, subject to gaps |
| [Open-Meteo historical weather / ERA5](https://open-meteo.com/en/docs/historical-weather-api) | Temperature, relative humidity, apparent temperature | Approximately 25 km, hourly modeled reanalysis; older dates from 1940 |
| [Open-Meteo weather](https://open-meteo.com/en/docs) | Same weather variables for recent dates | Automatic weather models with variable grids; future timestamps classified as forecast |
| [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api) / GeoNames | City/country search | Bounded eight-result lookup; manual coordinates remain available if search fails |
| [WHO 2021 guidelines](https://www.who.int/publications/i/item/9789240034228) | Complete past UTC-day PM2.5, PM10 and NO₂ comparisons | 24-hour reference values 15, 45 and 25 µg/m³ respectively; never hourly or annual substitutes |

Ozone has no supplied guideline calculation because its averaging period differs. A single modeled day is an exploratory comparison, not assessment of annual guideline compliance. Population-level health context links to [WHO air pollution and health](https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health); it does not assign causation or an individual cardiovascular event probability.

Open-Meteo data attribution is CC BY 4.0; its [free API terms](https://open-meteo.com/en/terms) restrict the free service to non-commercial use. Commercial deployment requires an appropriate provider agreement. No OpenAQ key, adapter or station measurements are added. OpenFreeMap/OSM provides the MapLibre basemap, independently from environmental values.

## API and behavior

All endpoints require authentication under `/api/v1/cardiotwin/environment`:

| GET path | Parameters | Result |
|---|---|---|
| `/locations` | `q` (2–80 printable characters) | Public location search, or explicit 503 |
| `/observations` | finite `lat`, `lon`, ISO `date` | Seven hourly series, units, modeled/forecast labels, gaps, provider/grid/retrieval provenance, daily summaries |
| `/layer` | `lat`, `lon`, `date`, one of four air `variable` identifiers | Batched sparse 3 × 3 regional samples and provenance |

The globe supports rotation, pan, zoom, location click/selection and region camera transitions. Date and hourly slider update the displayed values. Two locations can be compared with hourly plots and exact tables. The optional regional heatmap smooths nine provider samples; unsampled areas remain unknown, and its relative colors do not encode a clinical severity scale. Geographic controls, provenance, comparison and readings remain available in text mode or after map failure.

Responses preserve observation times and current ingestion times. Original publication/availability is unknown, so historical environmental retrieval is not asserted to be knowledge available at a clinical replay boundary. Missing hours, units and provider failures remain gaps; there are no mock environmental substitutions. Strict UTC-hour parsing rejects inconsistent timezone metadata. Patient alignment requires explicit temporary local consent and does not save or send a patient-location association.

The HTTP adapter verifies TLS, limits response size to 1 MiB, uses six-second overall / three-second connect timeouts and two bounded attempts, batches region requests, and caches normalized responses for ten minutes with 256 entries. Per-process budgeting is 60 provider calls/minute and 4,500/day. Shared multi-replica quotas/cache, commercial credentials, provider SLA monitoring and station-data integration remain deployment work.

## Actual live browser check

On 9 October 2026, real source requests for Chennai on 10 August 2026 returned 24/24 PM2.5 hours and 24/24 weather hours. Delhi coordinates returned 24/24 weather hours. The regional PM2.5 request returned 9/9 samples at the selected hour; city search returned HTTP 200. The browser exercised map/text views, comparison, date controls, source provenance and consented clinical alignment. An earlier air-provider TLS handshake timed out and was displayed as a gap; retry later succeeded. These results establish the tested retrieval, not uninterrupted worldwide coverage.

Offline tests in `backend/tests/cardiotwin/test_environment.py` cover units, timestamp validation, gaps, budget/cache/retry, failure isolation, batching, guideline averaging and PHI-free source queries. Frontend tests cover request normalization, date changes, stale-result exclusion, comparison and text alternatives. Reusable live journey: `frontend/e2e/cardio-environment-journey.js`.
