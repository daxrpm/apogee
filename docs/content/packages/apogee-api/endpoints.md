---
title: API Endpoints
description: REST API endpoint reference
---

# API Endpoints

## Health Check

```http
GET /health
```

**Response:**
```json
{"status": "ok", "service": "apogee-api"}
```

## Launch Simulation

```http
POST /launch/simulate
Content-Type: application/json

{
  "h_target_km": 200,
  "payload_kg": 5000,
  "include_trajectory": true
}
```

**Response:**
```json
{
  "schema_version": 1,
  "inputs": {...},
  "optimal_numerics": {
    "theta0_rad": 0.1547,
    "t_coast_s": 5.28,
    "t_burn2_s": 351.42,
    "alpha2_rad": 0.1132
  },
  "summary": {
    "ecc": 0.000498,
    "h_err_m": -1644.6,
    "v_err_mps": 1.83,
    "gamma_deg": -0.026
  },
  "trajectory": {...}
}
```

## Orbit Trajectory

```http
POST /orbit/trajectory
Content-Type: application/json

{
  "r_m": 6570000,
  "nu_initial_rad": 0.242,
  "sun_x": 1.0,
  "sun_y": 0.0,
  "sun_z": 0.0,
  "n_points": 100
}
```

## Yaw Instant

Fast endpoint for real-time yaw updates (~5ms).

```http
POST /orbit/yaw
Content-Type: application/json

{
  "r_m": 6570000,
  "nu_initial_rad": 0.242,
  "sun_x": 1.0,
  "sun_y": 0.0,
  "sun_z": 0.0,
  "t_s": 0
}
```

**Response:**
```json
{
  "yaw_rad": 3.14159,
  "yaw_deg": 180.0,
  "beta_rad": 0.0,
  "beta_deg": 0.0,
  "sun_body": [0.24, 0.0, -0.97],
  "satellite_position": [6378554, 1574466, 0]
}
```
