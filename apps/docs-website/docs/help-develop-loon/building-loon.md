# Building and Getting Started with Loon from Source

The official Github repository for Loon has everything that is required to build any of the above docker images. Instead of building a single image, however, you can also use Docker Compose to build our multi-container application. Building the multi-container application instead of the single Docker image provides more insight when attempting to debug and allows for much more configuration. This is done through a build script with an accompanying JSON file.

The build script takes in the configuration file, generates an `.env` file, and then builds and runs the multi-container application.

## The Build Script

In order to simplify the process of building the application while also allowing for more custom setups, we provide a python script called `build.py` in the root of the repository. When building loon, you should _always_ use this build script.

The simplest use case of the build script is as follows:

```bash
python3 build.py
```

:::info
Be sure to replace `python3` with `python` if that is the appropriate python executable on your local machine.
:::

By default, the build script searches for a `config.json` file in the same location as where the build script is called. If none exists, an error will be thrown. You can specify the location and name of the config file with the following:

```bash
python3 build.py --config-file path/to/other-config.json
```

The build script will do its best to validate the config before starting the docker container. When running the build script, here are the list of other inputs that may be helpful.

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
| --prepare-dev         | When set, will create the `.env` file based on the current configuration that is required to run a separate client development server.                                                                  | --prepare-dev                  |

In the repository, you will see two docker directories: `docker` and `docker-local`. The main deployment will use the `docker` directory. The `docker-local` directory is a separate local version of Loon which we will discuss shortly. Below are some examples.

```bash
python3 build.py
```


**Running Development Server**

If you'd like to have access to all the development server functionality when working with Loon, you can run a separate development server that connects to the running Docker container. We start by building and running the docker container with the additional flag `--prepare-dev`. This will generate the necessary `.env` file in the `apps/client` directory that will be used by the client.

```bash
python3 build.py --prepare-dev
```
Once that has started, navigate to the `apps/client` directory and run the development server.

```bash
cd apps/client
yarn run dev
```

This will start a separate development server at `http://localhost:5173`. The standard client will still be available as well. 

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
python3 build.py -o
```

This will take your current config (in this case `config.json` in the root directory since no file name was specified) and overwrite the `localDataSettings.sourceVolumeLocation` value to be `/Users/MyUser/my-loon-data`. The original `config.json` will not be altered. Instead, a temporary file (in this case named `config.json.temp`) will be created and then used.

If you're using the script not in detached mode, then pressing "Ctrl+C" in the terminal will stop and remove all docker containers. Additionally, all logs will be outputted to a "logs" directory. For each run of the build script, a new directory called `logs_%Y-%m-%d_%H-%M-%S` will be created with logging for each individual service separated.

## The Configuration File

The configuration file is a JSON document with `generalSettings`, `mySqlSettings`, `localDataSettings`, `nginxSettings`, and `minioSettings` as top level keys. 

Below is a simple example of using an HTTP server with a MinIO storage backend.

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

The build script will validate this configuration file before attempting to build in order to avoid any potential issues with the setup.

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

:::warning
When `generalSettings.environment` is set to `local`, the `minioSettings` key should be removed from your configuration file. 
:::

The MinIO settings are used to configure your MinIO storage backend. You do _not_ need to install or set-up MinIO prior to launching the container -- the docker application will handle the set up for you. 

The basic settings are the `minioStorageAccessKey`, the `minioStorageSecretKey`, and the volume location (i.e. where the data should be located). The `minioStorageAccessKey` and `minioStorageSecretKey` serve as the username and password for your MinIO storage, respectively. See [here](../getting-started-with-loon/working-with-minio.md) for more information on working with MinIO as a storage engine.

If you're deploying this application on a remote server where you'd like your data to be stored on an NFS volume, you must also specify that it is an NFS mount using `volumeType`, specify the nfs version using `nfsVersion`, the ip address of the volume using `ipAddress` and the user and group permissions that MinIO will need to write to this directory using `userGroupPermissions`

| Variable                | Details                                                                                                              | Possible Values        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| "minioStorageAccessKey" | Username for MinIO administrator                                                                                     | string (>3 characters) |
| "minioStorageSecretKey" | Password for MinIO administrator                                                                                     | string (>7 characters) |
| "sourceVolumeLocation"  | Location for the source data to be mounted to the container. This can be any directory with appropriate permissions. If `"volumeType"` is `"nfs"`, this path needs to be the _true_ NFS location. You can find this by running `df -h` in the NFS directory. | string                 |
| "volumeType" | Specifies if the volume to mount is an NFS volume. If not, this key can be removed. | "nfs", "" |
| "nfsVersion" | Specifies the NFS version of the mount. If `"volumeType"` is not `"nfs"`, then this can be removed. | int |
| "ipAddress" | Specifies the IP address of the NFS mount. You can find this in the output of `df -h` when inside your NFS directory. If `"volumeType"` is not `"nfs"`, then this can be removed. | string |
| "userGroupPermissions" | The user and group permissions necessary for the MinIO storage engine to have full access to the directory. The syntax must be "\{UID\}:\{GID\}". If `"volumeType"` is not `"nfs"`, then this can be removed. | string |


Once MinIO is deployed, you will be able to log into the web console using your provided access key and secret access key as the username and password. After you have logged in, you will be able to add additional users with restricted access if necessary using the "Identity" > "Users" tab. See [here](https://min.io/docs/minio/linux/administration/console/security-and-access.html#minio-console-security-access) for more information on identity management.

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


