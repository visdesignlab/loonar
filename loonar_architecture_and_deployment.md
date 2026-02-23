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
To see if any containers failed to start or continually restart (e.g., failing healthchecks):
```bash
docker-compose -f .build-files/docker-compose.yml ps
```
Or use native Docker commands:
```bash
docker ps -a
```

### 2. Viewing Live Logs
To see the stream of standard output/errors from the containers, use the `logs` command.
- **All containers simultaneously:**
  ```bash
  docker-compose -f .build-files/docker-compose.yml logs -f
  ```
- **Specific containers (Most common for backend/celery errors):**
  ```bash
  docker-compose -f .build-files/docker-compose.yml logs -f server
  docker-compose -f .build-files/docker-compose.yml logs -f celery
  docker-compose -f .build-files/docker-compose.yml logs -f minio
  docker-compose -f .build-files/docker-compose.yml logs -f db
  ```
  *(Press `Ctrl+C` to exit the log stream. Omit `-f` if you only want to print recent logs and exit).*

### 3. Reviewing Historical Logs (via `build.py`)
When you initialize the application via `build.py`, it automatically spins off detached log files. 
- You can find them in the `logs/` directory in the project root:
  ```bash
  ls -l logs/
  ```
- View the overall output log or specific service logs from the latest run:
  ```bash
  cat logs/logs_<TIMESTAMP>/out.log
  tail -f logs/logs_<TIMESTAMP>/server.log
  ```

### 4. Interactive Shells & Internal Debugging
Sometimes you need to inspect the inner state of the application.
- **Enter the Server (Django) Container Bash Shell:**
  ```bash
  docker-compose -f .build-files/docker-compose.yml exec server /bin/bash
  ```
- **Access the Django Interactive Python Shell:**
  ```bash
  docker-compose -f .build-files/docker-compose.yml exec server python manage.py shell
  ```
- **Inspect the Database (MySQL):**
  ```bash
  docker-compose -f .build-files/docker-compose.yml exec db mysql -u root -p
  # Provide DATABASE_ROOT_PASSWORD from your .build-files/.env file
  ```
- **Inspect the Celery/Redis Queue:**
  ```bash
  docker-compose -f .build-files/docker-compose.yml exec redis redis-cli
  ```

### 5. Rebuilding & Restarting
If a configuration gets stuck, environment variables aren't updating, or you need to force a reboot:
- **Restart a single service:**
  ```bash
  docker-compose -f .build-files/docker-compose.yml restart server
  ```
- **Tear down completely and clean up (Stops all containers):**
  ```bash
  docker-compose -f .build-files/docker-compose.yml down
  # You can also use: python3 build.py --down
  ```
- **Rebuild and restart all containers:**
  ```bash
  python3 build.py -osi --config-file .build-files/config-standard.json
  ```

---

## 6. TrueNAS SCALE Deployment

TrueNAS SCALE is a Debian-based NAS operating system (e.g., Debian 12 Bookworm) that supports hosting containerized workloads via its "Apps" ecosystem. In the case of Loonar, the deployment leverages a "Docker-in-Docker" (or orchestration-from-within) strategy.

### The `loon` Orchestrator App
In the TrueNAS UI, Loonar is deployed as a single Custom App using the image `lukeschreiber/loon-tests:latest`. Rather than being the application itself, this container functions as the **orchestrator**. 

To do this, it requires two critical host path mounts:
1. **`/var/run/docker.sock`**: Mounted directly from the TrueNAS host. This gives the `loon` container the ability to communicate with the host's Docker daemon.
2. **`/app/data`**: Mounted from a ZFS dataset (e.g., `/mnt/NAS_RAID_1/NAS_RAID_1_DS1`).

#### Crucial Environment Variables
The TrueNAS app configuration also passes heavily specific environment variables to this orchestrator container, which `build.py` intercepts to generate the final orchestration configs:
- **`MINIOSETTINGS_SOURCEVOLUMELOCATION`**: Explicitly passes the ZFS path on the TrueNAS host (e.g., `/mnt/NAS_RAID_1/NAS_RAID_1_DS1`) down to the Docker Compose template, so the spawned MinIO container knows *exactly* which host path to natively mount.
- **`VITE_SERVER_URL`**: Defines the TrueNAS machine's actual static IP (e.g., `155.98.10.25`), injecting this into the Vite build step so the React client knows where to make HTTP API requests.
- **`VITE_DATA_PORT`** & **`VITE_WS_PORT`**: Sets explicit ports for MinIO data access (e.g., `9000`) and websocket connections (`9001`).
- **`LOCAL_PORT_1`** & **`LOCAL_PORT_2`**: Provides port mapping configurations (e.g., `80` and `9001`) that get routed or managed by the NGINX reversed proxy depending on if HTTPS is enforced.

*(Note on Restart Policy: The orchestrator app's restart policy is typically set to "No" because once it successfully triggers `docker-compose up -d` against the host socket, its job is effectively complete).*

### How It Works
When the `loon` app container starts, it executes `build.py`, which generates the `.env` and `docker-compose.yml` natively within the container. 
Because the container has access to the host's Docker socket (which requires host `root` or `docker` group permissions given the `srw-rw---- 1 root docker` socket ownership), when `docker-compose up -d` is executed internally, the *actual* Loonar containers (`client`, `server`, `celery`, `minio`, `redis`, `db`, `duckdb`) are spun up directly on the TrueNAS host alongside the `loon` app, rather than nested inside it.

This is why examining the host directory (e.g., `/mnt/NAS_RAID_1/NAS_RAID_1_DS1`) will reveal the persistent data natively written by the `minio` container—such as `.minio.sys`, the `data` bucket, the central `aa_index.json`, and dynamically written experiment folders (`Constance`, `Rebecca`, `Sophie`, etc.). Meanwhile, the orchestrating `docker-compose.yml` and `.env` files remain hidden securely inside the ephemeral orchestrator container.

