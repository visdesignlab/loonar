# Loon

## For Developers

The Loon involves several different architecture pieces to properly run. This includes a Vue Front end (as a single page web application with a built in router), a Django backend, a MySQL Database, Celery to execute asynchronous tasks dispatched by Django, Redis as a message broker between Celery and Django, and finally Minio as an S3-Object storage engine. There is also a Docusaurus website in this repository as well, but that is built and run separately.

### Development and Deployment Tools: Docker and Moon

Moon is a monorepo package manager that allows us to define tasks within `.yml` files so that we can easily run and/or build the server and client together with ease. However, this does not handle installation of Redis, MySQL, or Minio. These will have to be created and started separately. Additionally, Celery is not automatically ran with moon, which means that you'll have to separately start a set of workers for Django to dispatch actions to.

In addition to this, we also have a complete Docker setup. This docker container will handle Django, Vue, MySQL, Redis, and Celery automatically. However, Minio is currently not in our docker container and thus needs to be created separately.

**Minio might be packaged within our Docker image, but it is not set in stone.**

#### Installing Moon

We use [Moon](https://moonrepo.dev/) as the monorepo package for managing this repository.

For Linux/Mac you can install Moon with the following:

```bash
curl -fsSL https://moonrepo.dev/install/moon.sh | bash
```

After Moon is installed, you'll need to add Moon to your path. Copy and paste the following in your command line or add it to your profile:

```bash
export PATH="$HOME/.moon/bin:$PATH"
```

Please see [here](https://moonrepo.dev/docs/install) to view more options for installing Moon.

The basics usage of moon in our mono repo is to have central commands which run specific functions within each repository. The standard utility is `moon run <project-name>:<task-name>` or `moon <project-name>:<task-name>`. When we have multiple projects with the same task names, we can run each matching task by using `moon :<task-name>`. This allows us to run the server and client simultaneously with one command, allows us to install all necessary packages in all repository in one command, and allows us to have a central place for designing such tasks. You can find the various tasks for each repository in the `apss/<project>/moon.yml` file. Additionally, the `.moon/workspace.yml` file also indicates the project name for each application. For instance, the `apps/client` repository has the project name `client` while the `apps/docs-website` repository has the project name `docs`.

### Docker vs Moon: What's best for you?

If you're just looking to test Loon out, Docker is easily the best choice for you. If you're looking to develop and contribute to Loon, it is best that you have the Docker setup and Moon setup configured.

### Docker Setup

To create and run the docker container, first change into the `docker/` directory. Create a ".env" file with the following contents:

```bash
## Docker container for docker full docker deployment. Only "allowed_host" needs to be changed when deploying on a non-local machine.

# Client settings
VITE_ENVIRONMENT=production
VITE_USE_HTTP=True

# Docker Container Only Settings
DATABASE_ROOT_PASSWORD=root_pass

# General Django Settings
MINIO_ENABLED=True

# Docker Container and Django Settings
SECRET_KEY="django-insecure-z2^vruu347=0e-qyh%&k)%*j9(hgubj$layg&k$-vwb1u+mp93"
DEBUG=True
ALLOWED_HOST='localhost'

# MySQL
DATABASE_NAME=loon
DATABASE_USER=user
DATABASE_PASSWORD=user_pass
DATABASE_HOST=db
DATABASE_PORT=3306

# Celery and Redis
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# Minio
MINIO_STORAGE_ENDPOINT=minio:9000
MINIO_STORAGE_ACCESS_KEY=G0tdk43qnAzVLMGfY7BZ
MINIO_STORAGE_SECRET_KEY=PBHkZUmXzrBgq5yaM4dH32xwPD7W9dQgFYcyEa8d
MINIO_STORAGE_MEDIA_BUCKET_NAME=data
MINIO_STORAGE_STATIC_BUCKET_NAME=static
MINIO_STORAGE_MEDIA_URL=http://localhost/data
MINIO_STORAGE_STATIC_URL=http://localhost/data
```

### Running with Docker

Ensure that the docker application is running.

Afterwards, run the following command from the docker directory:

`docker compose up --build`

This will create and run a docker container which will have Redis, MySQL, Django, Vue, Celery, and NGINX all running together.
This also starts all the dev servers and will run indefinitely until closed.

- Loon URL: http://localhost/
- Minio URL: http://localhost:9001/
  - login/password for minio are configured in the .env MINIO_STORAGE_ACCESS_KEY and MINIO_STORAGE_SECRET_KEY.


### Setting Up Moon

#### Requirements

The following are required for each repository to work effectively:

```
Node>=20.11.1
Python>=3.11.6
MySQL>=8.3.0
Redis>=7.2.5
```

Once moon is set up, you can install all necessary packages for each of the repositories by calling this function:

```bash
moon :install
```

Note: If you run the install function, this will set up a Python virtual environment for your server. If you accidentally end up running the install function without upgrading Python, you may run into issues even after you upgrade Python because the virtual environment will be on the old version. To alleviate this, please remove the `apps/server/.venv` directory, then run the install function again.

### Running the Application

**If you are just planning to develop the front end Vue Application, the following steps may not be necessary.**

To run the application locally, you must have MySQL, Redis, Minio, and Celery installed and running. **Note that celery is installed by default inside the server when running moon :install, so you should be able to get it started within the virtual environment with no additional installation**. After these two are running, you'll need to set up an ".env" file in the `docker" directory. The file will need to consist of the following:

```
DATABASE_NAME={your_database_name}
DATABASE_USER={your_user_name}
DATABASE_PASSWORD={your_user_pass}
DATABASE_ROOT_PASSWORD={your_root_pass}
DATABASE_HOST=localhost
DATABASE_PORT={your_database_port} # usually 3306
SECRET_KEY="django-insecure-z2^vruu347=0e-qyh%&k)%*j9(hgubj$layg&k$-vwb1u+mp93"
DEBUG={True/False} # False in producition
MINIO_STORAGE_ACCESS_KEY={minio_access_key_generated}
MINIO_STORAGE_SECRET_KEY={minio_secret_access_key_generated}
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

To run the client and server simultaneously, you can do the following:

```
moon :run
```

This will run both the client and server. This sill not automatically start the documentation website. To run the documentation website, we can do this:

```
moon :run-docs
```

To build the server and client, we run `moon :build`. Similarly, `moon :build-docs` will build the documentation website.
