import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Developer Quickstart Guide

The easiest way to get started with Loon for developing purposes is by following the instructions below.

:::warning
This guide requires that Docker has been installed and is currently running. See [here](https://www.docker.com/) for downloading and installing Docker.
:::

## Step 1: Clone or Update Your Repository

Start by cloning the repository located [here](https://github.com/visdesignlab/loonar) or by pulling in the latest changes.

## Step 2: Create a Config File

In the root of the Loonar repository, create a new file named `config.json` with the following contents:

```json
{
  "generalSettings": {
    "useHttp": true,
    "environment": "local",
    "baseUrl": "localhost"
  },
  "mySqlSettings": {
    "databaseName": "loon",
    "databaseUser": "user",
    "databasePassword": "user_pass",
    "databaseRootPassword": "root_pass"
  },
  "localDataSettings": {
    "sourceVolumeLocation": "path/to/data"
  }
}
```

Replace the value `"path/to/data"` with the absolute path to any data you may have. If you don't yet have any data, you can just point this to an empty directory. You can also add data to that directory once the application is already running.

## Step 3: Run the Build Script

In the root of the repository, run the following command:

```bash
python3 build.py --prepare-dev
```

This will generate the necessary environment file in the client directory while still running the rest of the container. Then, the development server can be started separately by the following:

```bash
cd apps/client
yarn dev
```

## Shutting Down The Containers

To shut down the containers, you can press `Ctrl+C` in the terminal in which you started the containers. If you no longer have access to that session, navigate to the root of the repository and run the following:

```
python3 build.py -D
```
