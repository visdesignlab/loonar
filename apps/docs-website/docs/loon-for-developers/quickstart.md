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

In the root of the repository, run the following following command:

### Option 1: Automatically Run Dev Environment

```bash
python3 build.py --run-dev
```

This sill begin building and running the multi-service application. Once all containers have begun running, you will be able to use the application at http://localhost/. Additionally, a development client will be started at http://localhost:5173/. The difference between the standard client and the development client is that the development client is the non-built version of the client. This will allow you to debug much easier than using the build version of the client.

:::warning
Note that starting the development server without the rest of the container (i.e. navigating to `apps/client` and running `yarn dev`) will inevitably lead to issues due to the resources that the client needs to have access to. We always advise starting the development server this way.
:::

### Option 2: Prepare Development Environment and Run Separately

If you would like to start the development server separately, you can prepare the dev environment first and then use a different terminal session to start the development server. This may be useful for those that want additional log outputs directly inside the terminal. In the root of the repository, run the following:

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
