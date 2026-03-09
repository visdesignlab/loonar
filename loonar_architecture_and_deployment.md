# Loonar Deployment & Orchestration Guide

This document provides a hyper-detailed breakdown of how Loonar runs, covering its ports, container build processes, environment variable injection, MinIO setup, and the mechanics of experiment loading (`aa_index.json`).

---

## 1. Network & Ports

Each container in the Loonar stack is assigned specific ports. The network configuration relies heavily on the `docker-compose.template.yml` orchestrator.

- **`80` (HTTP) / `443` (HTTPS) - `client` container:**
  Exposed via an NGINX reverse proxy inside the `client` container. Handles all frontend frontend traffic. `nginx-http.conf` or `nginx-https.conf` proxy specific paths (e.g., `/api` to the server, `/data` to MinIO).
- **`8000` - `server` container:**
  The Django backend API port. NGINX forwards `/api` requests to this port.
- **`3306` - `db` container:**
  Standard MySQL port. Used by Django to persist relational data (Experiments, Locations, User data).
- **`6379` - `redis` container:**
  Standard Redis port. Used as the message broker and result backend for Celery background tasks (e.g., asynchronous data processing).
- **`9000` - `minio` container (API):**
  The S3-compatible API port for MinIO. This is where file uploads/downloads (images, parquet files, and JSONs) take place.
- **`9090` - `minio` container (Console):**
  The web UI (GUI) port for exploring MinIO buckets in a browser. Note: `Dockerfile.minio` defines `9001` in the `CMD` but `docker-compose.template.yml` maps `9090` to the host.
- **`3000` - `duckdb` container:**
  The remote DuckDB processing container listening for websocket analytical queries from the frontend.

---

## 2. Container Orchestration & Lifecycle

Loonar does not use raw Docker Compose files out of the box. Instead, a dynamic python script acts as the entrypoint for configuration and container starting.

### The `build.py` Orchestrator Lifecycle
1. **Command Invocation:** Started via `python3 build.py -osi --config-file .build-files/config-standard.json`.
2. **Parsing & Validating (`BuildConfig.py`):**
   `BuildConfig.py` reads `config-standard.json`, checks it against a JSON schema (`config.json.schema`), and dynamically overrides values if you have matching host environment variables (e.g., overriding `MYSQL_ROOT_PASSWORD` if the env var is present).
3. **Environment Generation:**
   A central `.env` file is generated within `.build-files/`. It synthesizes flattened environment variables from the nested JSON. Key generated variables include:
   - `VITE_ENVIRONMENT`, `VITE_USE_HTTP`, `VITE_SERVER_URL`
   - `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_ROOT_PASSWORD`
   - `CELERY_BROKER_URL`
   - `MINIO_STORAGE_ACCESS_KEY`, `MINIO_STORAGE_SECRET_KEY`
   - `MINIO_BROWSER_REDIRECT_URL`
   - `SSL_KEY_FILE`, `SSL_CERT_FILE`
4. **Docker Compose Template Copy:**
   `docker-compose-local.template.yml` or `docker-compose-nfs.template.yml` is copied to `docker-compose.yml` based on the environment flag.
5. **Execution:**
   `run_command` executes `docker-compose --env-file .env build` followed by `docker-compose up -d`.

### Container Build Specifics
- **Client (`Dockerfile.client`):** 
  A multi-stage build. 
  1. Uses `node` (Alpine) to install dependencies and run `yarn run build`. Build arguments (`VITE_USE_HTTP`, `VITE_SERVER_URL`, etc.) are converted to `ENV` vars to be baked into the static bundle.
  2. The second stage uses `nginx:alpine`, copies the Vite `dist` folder into `/usr/share/nginx/html`, and copies the specified NGINX config.
  3. Uses `client-entrypoint.sh` which runs `envsubst` to replace SSL variables in the NGINX configuration file before starting NGINX via `nginx -g 'daemon off;'`.
  
- **Server (`Dockerfile.server`):** 
  Uses `python:3.12`. It takes a `DOCKER_ENV_FILE` arg, copies the `.env` file inside as `/app/.env`, runs `pip install -r requirements.txt`. 
  Its `server-entrypoint.sh` runs `python manage.py makemigrations api` and `migrate api` directly before executing `runserver`.
  
- **Celery (`Dockerfile.celery`):** 
  Similar setup to the server, but the `docker-compose.yml` specifies the overriding command: `celery --app celery_app worker --loglevel info ...`.

### Healthchecks & Dependencies
Docker-compose explicitly defines healthchecks to prevent startup race conditions:
- **`server`** & **`celery`** depend on:
  - `db` (MySQL): Verified by `mysqladmin ping`.
  - `redis`: Verified by `redis-cli ping`.
  - `minio`: Verified by a custom `minio-healthcheck.sh` that curls `http://minio:9000/minio/health/live`.

---

## 3. MinIO Setup Deep-Dive

MinIO is the backbone of the unstructured and processed data.
- **Base Image:** `minio/minio:latest`
- **Configuration:** 
  The environment variables `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` are mapped from `config-standard.json` -> `minioSettings` -> `minioStorageAccessKey/minioStorageSecretKey`.
  `MINIO_BROWSER_REDIRECT_URL` is configured to correctly route UI traffic without breaking URLs in different environments.
- **Storage Mounts:** 
  It takes `${MINIO_VOLUME_LOCATION}` and maps it natively to `/data`.
- **Initialization:** 
  In the `Dockerfile.minio`, `minio-healthcheck.sh` is copied in. The container boots listening on port 9000 (API) and handles all uploads and static data serving.

---

## 4. How Experiments are Loaded (`aa_index.json`)

`aa_index.json` is the single source of truth for the client to know what experiments exist in the database without needing complex API pagination or relational querying to boot.

1. **How it is Created (Server-Side):**
   - When a user uploads a new experiment via the backend (calling `ProcessDataView` to upload the raw files to MinIO), a final POST reaches `FinishExperimentView`.
   - `FinishExperimentView` takes the parsed configurations, concatenates tabular data, creates composite parquet files via `create_composite_tabular_data_file()`, and writes relational metadata to MySQL (creating `Experiment` and `Location` records).
   - Finally, it gathers a list of *all* existing experiments in the database (`Experiment.objects.values_list('name')`), appends `.json` to them, and packages them into a dictionary (`{"experiments": [...]}`).
   - It saves this file directly to the root of the MinIO default storage bucket as `aa_index.json`.

2. **How it is Found (Client-Side):**
   - The frontend (`apps/client/src/stores/misc/configStore.ts`) statically registers the entry point as `const entryPointFilename = '/aa_index.json'`.
   - A function `getFileUrl(path)` dynamically builds the URL based on the `VITE_SERVER_URL` injected during the build.
   - Typically, `VITE_SERVER_URL` resolves to `${baseUrl}/data`, which proxies through NGINX to MinIO on port 9000.
   - Upon loading, the client fetches `${baseUrl}/data/aa_index.json`, parses the array of available experiment `.json` files, and subsequently fetches each individual experiment's JSON configuration to populate the UI. 
   - This architecture completely decouples the initial "what data exists" query from Django/MySQL, offloading the bandwidth directly to the static MinIO bucket.

---

## 5. Debug Commands & Logging (Linux)

Loonar runs via Docker Compose in the background, making standard Linux/Docker commands your primary diagnostic tools.

### 1. Checking Container Statuses
To see if any containers failed to start or are in a restart loop:
- **Standard**: `docker-compose -f .build-files/docker-compose.yml ps`
- **TrueNAS**: `docker ps -a`

### 2. Viewing Live Logs (Standard Deployment)
To see the stream of standard output/errors from the containers:
```bash
docker-compose -f .build-files/docker-compose.yml logs -f [service]
```

### 3. Viewing Live Logs (TrueNAS SCALE)
On TrueNAS, the compose context is internal to the orchestrator. High-level `docker` commands are the primary tool:
- **Detailed Logs**: `docker logs -f [container-name]` (e.g., `docker logs -f server-1`)
- **Container Names**: Typically `server-1`, `db-1`, `celery-1`, `client-1`, `minio-1`, `redis-1`, `duckdb-1`.

### 4. Interactive Shells & Internal Debugging (TrueNAS Commands)
Sometimes you need to inspect the inner state of the application:
- **Enter a Container Bash Shell:**
  ```bash
  docker exec -it server-1 /bin/bash
  ```
- **Access the Django Interactive Python Shell:**
  ```bash
  docker exec -it server-1 python manage.py shell
  ```
- **Inspect the Database (MySQL):**
  ```bash
  docker exec -it db-1 mysql -u root -p
  # Provide DATABASE_ROOT_PASSWORD from your config
  ```
- **Inspect the Celery/Redis Queue:**
  ```bash
  docker exec -it redis-1 redis-cli
  ```

### 5. Rebuilding & Restarting (TrueNAS Commands)
- **Restart a single service:**
  ```bash
  docker restart server-1
  ```
- **Tear down completely (TrueNAS App UI):**
  Stop the Loonar app in the TrueNAS "Apps" tab.
- **Force Rebuild/Restart:**
  Restart the `loon` orchestrator app in TrueNAS; it will re-trigger the `build.py` sequence and update containers.

---

## 6. TrueNAS SCALE Deployment

TrueNAS SCALE is a Debian-based NAS operating system (e.g., Debian 12 Bookworm) that supports hosting containerized workloads via its "Apps" ecosystem. In the case of Loonar, the deployment leverages a "Docker-in-Docker" (or orchestration-from-within) strategy.

### The `loon` Orchestrator App
In the TrueNAS UI, Loonar is deployed as a single Custom App using the image `lukeschreiber/loon-tests:latest`. Rather than being the application itself, this container functions as the **orchestrator**. 

To do this, it requires two critical host path mounts:
1. **`/var/run/docker.sock`**: Mounted directly from the TrueNAS host. This gives the `loon` container the ability to communicate with the host's Docker daemon.
2. **`/app/data`**: Mounted from a ZFS dataset (e.g., `/mnt/NAS_RAID_1/NAS_RAID_1_DS1`).

#### Environment Variables & Current Status
The TrueNAS app configuration passes specific environment variables to the orchestrator. Below are the current settings as of the latest deployment:

| Variable | Current Value | Description |
| :--- | :--- | :--- |
| `MINIOSETTINGS_SOURCEVOLUMELOCATION` | `/mnt/NAS_RAID_1/NAS_RAID_1_DS1/data` | The ZFS host path where MinIO data is stored. Points to the actual data directory on the NAS. |
| `LOCAL_PORT_1` | `9001` | The host port mapped to the internal websocket and MinIO console services. |
| `LOCAL_PORT_2` | `80` | The primary host port for HTTP traffic, routed via the NGINX reverse proxy. |
| `VITE_SERVER_URL` | `155.98.10.25` | The static IP of the TrueNAS host, used by the frontend to locate the backend API. |
| `VITE_DATA_PORT` | `9000` | The port dedicated to MinIO S3-compatible API access. |
| `VITE_WS_PORT` | `9001` | The port used for websocket connections to the analytical processing units. |

#### Storage Configuration
Two critical host path mounts are required for the "Docker-in-Docker" orchestration to function correctly:

| Type | Host Path | Mount Path | Description |
| :--- | :--- | :--- | :--- |
| Host Path | `/mnt/NAS_RAID_1/NAS_RAID_1_DS1` | `/app/data` | The root dataset providing persistent storage for all experiment data, database files, and logs. |
| Host Path | `/var/run/docker.sock` | `/var/run/docker.sock` | The Unix socket for the host's Docker daemon, enabling the orchestrator to manage containers natively on the host. |

*(Note on Restart Policy: The orchestrator app's restart policy is typically set to "No" because once it successfully triggers `docker-compose up -d` against the host socket, its job is effectively complete).*

### How It Works
When the `loon` app container starts, it executes `build.py`, which generates the `.env` and `docker-compose.yml` natively within the container. 
Because the container has access to the host's Docker socket (which requires host `root` or `docker` group permissions given the `srw-rw---- 1 root docker` socket ownership), when `docker-compose up -d` is executed internally, the *actual* Loonar containers (`client`, `server`, `celery`, `minio`, `redis`, `db`, `duckdb`) are spun up directly on the TrueNAS host alongside the `loon` app, rather than nested inside it.

This is why examining the host directory (e.g., `/mnt/NAS_RAID_1/NAS_RAID_1_DS1`) will reveal the persistent data natively written by the `minio` container—such as `.minio.sys`, the `data` bucket, the central `aa_index.json`, and dynamically written experiment folders (`Constance`, `Rebecca`, `Sophie`, etc.). Meanwhile, the orchestrating `docker-compose.yml` and `.env` files remain hidden securely inside the ephemeral orchestrator container.

### Updating the Orchestrator Image
To update the `loon` orchestrator image (e.g., after modifying `build.py` or diagnostic scripts), build and push it to Docker Hub using `buildx` for cross-platform compatibility (required for high-performance TrueNAS systems):

```bash
docker buildx build --platform linux/amd64 -f .build-files/Dockerfile.loon.minio -t lukeschreiber/loon-tests:latest --push .
```

---

---

## 7. Deployment Diagnostics & Debugging

Getting Loonar fully operational on TrueNAS (or any Docker-based deployment) requires every layer of the stack to be healthy: Docker → MySQL → Redis → MinIO → Django → NGINX → Client. A failure at any point silently breaks the pipeline. This section documents the comprehensive diagnostic tools built into Loonar to surface every issue clearly.

### 7.1 The `loon-doctor.sh` Diagnostic Script

A single-command health report that checks every layer of the stack in sequence.

**Usage (Linux/Standard):**
```bash
bash .build-files/loon-doctor.sh
```

**Usage (TrueNAS SCALE):**
Since the script is internal to the orchestrator image, run it via a temporary container:
```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock lukeschreiber/loon-tests:latest bash .build-files/loon-doctor.sh
```

**What it checks (in order):**

| # | Check | What It Validates | Common TrueNAS Failure |
|---|-------|------------------|----------------------|
| 1 | Docker Compose | All expected containers are running | Docker socket not mounted |
| 2 | MySQL | Database is alive, `loon` DB exists | DB container crash on startup |
| 3 | Redis | Broker responds to `PING` | Redis OOM or port conflict |
| 4 | MinIO API | Health endpoint returns 200 | ZFS permissions, NFS mount failure |
| 5 | MinIO Bucket | `/data/data` directory exists | Volume not mounted, first deploy |
| 6 | `aa_index.json` | File exists, is valid JSON, lists experiments | Corrupted write, no uploads yet |
| 7 | Experiment Files | Each file in `aa_index.json` exists in MinIO | Deleted data, partial upload |
| 8 | NGINX Proxy | Client serves on port 80, `/data` proxy works | Port mapping mismatch |
| 9 | Django API | Server responds on port 8000 | Migration failure, missing `.env` |

Each check prints a timestamped `[PASS]`, `[FAIL]`, or `[WARN]` with a human-readable explanation of what went wrong and how to fix it. At the end, a summary reports total failures and warnings.

**Example output (healthy):**
```
━━━ 1. Docker Compose — Container Status ━━━
2025-03-09 10:00:01 [PASS] Container 'client' is running.
2025-03-09 10:00:01 [PASS] Container 'server' is running.
...
━━━ SUMMARY ━━━
✔ All checks passed. Loonar deployment looks healthy.
```

**Example output (failure):**
```
━━━ 4. MinIO — API Health ━━━
2025-03-09 10:00:05 [FAIL] MinIO health endpoint returned: 000
     ↳ Fix: Run 'docker-compose -f .build-files/docker-compose.yml logs minio' for details.
     ↳ Common cause on TrueNAS: ZFS dataset permissions or NFS mount failure.
```

### 7.2 Enhanced Container Logging

#### MinIO Healthcheck (`minio-healthcheck.sh`)

The Docker Compose healthcheck for MinIO now performs three validations:
1. **API liveness** — Curls `http://minio:9000/minio/health/live` with verbose error output on failure.
2. **Directory existence** — Verifies `/data` exists inside the container (catches missing volume mounts).
3. **Write access** — Attempts to create and remove a probe file in `/data` (catches ZFS/NFS permission issues).

All messages are timestamped. On failure, the healthcheck logs the specific cause and a fix suggestion, visible via:
```bash
docker-compose -f .build-files/docker-compose.yml logs minio
```

#### Server Entrypoint (`server-entrypoint.sh`)

The Django server startup now runs through four structured phases, each with `[PASS]`/`[FAIL]` output:

1. **`ENVIRONMENT CHECK`** — Verifies `/app/.env` is mounted and contains critical variables like `DATABASE_NAME`.
2. **`DATABASE CONNECTIVITY`** — Waits for the MySQL port to be reachable (up to 30 retries) before proceeding.
3. **`MIGRATIONS`** — Runs `makemigrations` and `migrate` with each line prefixed and timestamped.
4. **`STARTUP`** — Launches the Django server.

View these logs with (TrueNAS):
```bash
docker logs server-1
```

### 7.3 Post-Startup Validation in `build.py`

After all containers pass their Docker healthchecks, `build.py` automatically runs a `validate_deployment()` step that verifies the data pipeline works end-to-end:

1. **MinIO health** — Confirms the MinIO API is reachable from the host on port 9000.
2. **`aa_index.json`** — Fetches the index file through the NGINX proxy, validates it's valid JSON, and reports the experiment count.
3. **Django API** — Confirms the server responds on `/api/`.

This validation prints directly to the terminal and is also written to the log file. If any check fails, it suggests the exact `docker-compose logs` command to run.

### 7.4 Troubleshooting Quick Reference

| Symptom | TrueNAS Diagnostic | Root Cause | Fix |
|---------|-------------------|------------|-----|
| MinIO container keeps restarting | `docker logs minio-1` | ZFS permissions | `chown -R 1000:1000` on the dataset |
| MinIO health returns non-200 | `docker logs minio-1` | MinIO initializing / disk full | Wait for startup; check `df -h` |
| Server crashes on startup | `docker logs server-1` | `.env` or config missing | Restart the `loon` orchestrator app |
| Server hangs waiting for DB | `docker logs db-1` | MySQL not started / crash | Check `db-1` logs for permission errors |
| `aa_index.json` returns 404 | `docker logs client-1` | No experiments uploaded | Upload an experiment to initialize |
| Client returns 502/503 | `docker logs client-1` | Server not ready | `docker restart client-1` |
| Docker socket access denied| `docker logs loon-1` | Incorrect App permissions | Mount `/var/run/docker.sock` in App config |

### 7.5 Recommended Debugging Workflow

When Loonar isn't working on TrueNAS, follow this sequence:

1. **Run the doctor first:**
   ```bash
   bash .build-files/loon-doctor.sh
   ```

2. **Focus on the first `[FAIL]`** — failures are listed in dependency order, so the first failure is usually the root cause.

3. **Check the relevant container logs (TrueNAS):**
   ```bash
   docker logs <container-name>  # e.g., server-1, db-1, minio-1
   ```

4. **After fixing, restart the affected service:**
   ```bash
   docker restart <container-name>
   ```

5. **Re-run the doctor to confirm the fix:**
   ```bash
   bash .build-files/loon-doctor.sh
   ```

6. **For a full rebuild after config changes:**
   ```bash
   python3 build.py -osi --config-file .build-files/config-standard.json
   ```
   The post-startup validation will run automatically.
