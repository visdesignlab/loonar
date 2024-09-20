# Building and Running Loon From Source

The official Github repository for Loon has everything that is required to build any of the above docker images. Instead of building a single image, however, you can also use Docker Compose to build our multi-container application. Building the multi-container application instead of the single Docker image provides more insight when attempting to debug and allows for much more configuration. This is done through a build script with an accompanying JSON file.

## Configuration File

Below is the base configuration file that is required to build Loon.

```json
{
  "generalSettings": {
    "useHttp": false,
    "environment": "production",
    "baseUrl": "localhost"
  },
  "mySqlSettings": {
    "databaseName": "loon",
    "databaseUser": "user",
    "databasePassword": "user_pass",
    "databaseRootPassword": "root_pass"
  },
  "minioSettings": {
    "minioStorageAccessKey": "admin",
    "minioStorageSecretKey": "minioadmin",
    "sourceVolumeLocation": "path/to/data"
  }
}
```

### General Settings

| Variable      | Details                                                                                             | Possible Values  |
| ------------- | --------------------------------------------------------------------------------------------------- | ---------------- |
| "useHttp"     | Set to true if using HTTP is desired. If set to false, NGINX settings will be required.             | true/false       |
| "environment" | If set to 'production', will use MinIO features. Setting to 'local' will enable Local Loon instead. | production/local |
| "baseUrl"     | Base URL for application. Set this to "localhost" when using locally.                               | string           |

### MySQL Settings

| Variable               | Details                             | Possible Values |
| ---------------------- | ----------------------------------- | --------------- |
| "databaseName"         | Name of database in mysql to create | string          |
| "databaseUser"         | Name of standard user               | string          |
| "databasePassword"     | Password for standard user          | string          |
| "databaseRootPassword" | Password for root user              | string          |

### MinIO Settings

MinIO Settings can be removed when the `generalSettings.environment` is set to `local`.

| Variable                | Details                                                                                                              | Possible Values        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| "minioStorageAccessKey" | Username for MinIO administrator                                                                                     | string (>3 characters) |
| "minioStorageSecretKey" | Password for MinIO administrator                                                                                     | string (>7 characters) |
| "sourceVolumeLocation"  | Location for the source data to be mounted to the container. This can be any directory with appropriate permissions. | string                 |

### NGINX Settings

NGINX settings can be added by adding `"nginxSettings"` as a top level key. This is only required when `generalSettings.useHtp` is set to `false`.

| Variable               | Details                                               | Possible Values |
| ---------------------- | ----------------------------------------------------- | --------------- |
| "sourceVolumeLocation" | Location for the ssl keys to be mounted to container. | string          |
| "targetVolumeLocation" | Location inside container where to mount keys.        | string          |
| "certFileLocation"     | Name of cert file relative to source volume mount.    | string          |
| "keyFileLocation"      | Name of key file relative to source volume mount      | string          |

### Local Data Settings

Local Data settings can be added by adding `"localDataSettings"` as a top level key. This is only required when `generalSettings.environment` is set to `"local"`.

| Variable               | Details                                                 | Possible Values |
| ---------------------- | ------------------------------------------------------- | --------------- |
| "sourceVolumeLocation" | Location for the local data to be mounted to container. | string          |

The build script will do its best to validate each of these fields before starting the docker container. When running the build script, there are several inputs you can use

| Argument              | Description                                                                                                                                                                                             | Example                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| -h, --help            | Outputs this information to terminal without running script.                                                                                                                                            | -h                             |
| -v, --verbose         | All output response is sent to the terminal and main log file. If not present, limited information will be passed to the terminal.                                                                      | -v                             |
| -d, --detached        | Once all containers are started, program will exit and log in the background                                                                                                                            | -d                             |
| -e, --validate-build  | When present, the script will not build or start any containers. Only the configuration file will be validated and the environment file created.                                                        | -e                             |
| --env-file            | Name of env file to create.                                                                                                                                                                             | .--env-file .env.production    |
| --config-file         | Name of config file to use as input                                                                                                                                                                     | --config-file config-test.json |
| -D, --down            | Stops all containers and removes all containers. Note that this will not build or start containers nor validate the configuration file.                                                                 | -D                             |
| -o, --overwrite       | When set, any settings in your configuration file which are present as environment variables in the current session will be overwritten.                                                                | -o                             |
| -s, --disable-spinner | When set, disables inline spinner                                                                                                                                                                       | -s                             |
| --run-dev             | When set, will launch a separate development client server running on http://localhost:5173. A `.env` file will be generated in the apps/client directory. This cannot be set when using detached mode. | --run-dev                      |
| --prepare-dev         | When set, will create the `.env` file based on the current configuration that is required to run a separate client development server.                                                                  | --prepare-dev                  |

In the repository, you will see two docker directories: `docker` and `docker-local`. The main deployment will use the `docker` directory. The `docker-local` directory is a separate local version of Loon which we will discuss shortly. Below are some examples.

```bash
python3 build.py
```

The above script will build and then run all containers using a default of "config.json" as the configuration file and creating a ".env" file in the `.build-files` directory.

**Specifying the env file name and configuration file name**

```bash
python3 build.py --env-file .env.production --config-file config-production.json
```

This will use the "config-production.json" as the input configuration file and output a ".env.production" environment file.

**Using Detached Mode and Verbose**

```bash
python3 build.py -vd
```

This will enable verbose mode so that we can see the build process as it runs. It will also exit once all containers have begun running.

**Overwritting configuration file with environment variables**

```bash
export LOCALDATASETTINGS_SOURCEVOLUMELOCATION=/Users/MyUser/my-loon-data
python3 build -o
```

This will take your current config (in this case `config.json` in the root directory since no file name was specified) and overwrite the `localDataSettings.sourceVolumeLocation` value to be `/Users/MyUser/my-loon-data`. The original `config.json` will not be altered. Instead, a temporary file (in this case named `config.json.temp`) will be created and then used.

If you're using the script not in detached mode, then pressing "Ctrl+C" in the terminal will stop and remove all docker containers. Additionally, all logs will be outputted to a "logs" directory. For each run of the build script, a new directory called `logs_%Y-%m-%d_%H-%M-%S` will be created with logging for each individual service separated.
