# BigQuery — beacon events stream (P2-9)

This module streams each non-duplicate beacon ingest into BigQuery so ops can
build Looker Studio agency reports over real data.

## Environment

| Variable              | Default        | Notes                                                   |
| --------------------- | -------------- | ------------------------------------------------------- |
| `BIGQUERY_ENABLED`    | `true` in prod | Set `false` to disable streaming entirely.              |
| `BIGQUERY_DATASET`    | `beacon`       | Dataset name. Must exist in the same GCP project.       |
| `BIGQUERY_TABLE`      | `events`       | Table name; DDL below.                                  |
| `GOOGLE_CLOUD_PROJECT`| *(none)*       | Required for the BigQuery client; falls back to ADC.    |

Auth uses Application Default Credentials. The runtime service account must
have `roles/bigquery.dataEditor` on the target dataset.

## DDL (run once in the target project)

```sql
CREATE SCHEMA IF NOT EXISTS `beacon`
  OPTIONS (location = "US");

CREATE TABLE IF NOT EXISTS `beacon.events` (
  id         STRING NOT NULL,
  receivedAt TIMESTAMP NOT NULL,
  time       STRING,
  macAddress STRING,
  agency     STRING,
  severity   INT64,
  categories ARRAY<STRING>,
  gpsLat     FLOAT64,
  gpsLng     FLOAT64,
  hopCount   INT64,
  messageLen INT64
)
PARTITION BY DATE(receivedAt)
CLUSTER BY agency, macAddress;
```

## Looker Studio

Point a Looker Studio report at `beacon.events`. Typical charts:

- **Incidents by agency over time** — dimension `agency`, metric `COUNT(id)`,
  time dimension `receivedAt`.
- **Severity heatmap** — geo chart on `gpsLat`/`gpsLng`, colour by `severity`.
- **Mesh health** — `AVG(hopCount)` vs. `COUNT(id)` per hour.
