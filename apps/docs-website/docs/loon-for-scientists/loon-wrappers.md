---
sidebar_position: 1
---

# Official Loon Docker Images

We support two official docker images for Loon -- a standard Loon version and a Local Loon version. Each of these images have Docker installed inside them and subsequently build the entire application for you. You can find the most up-to-date images below.

## Working with Loon Images

Working with the Loon Images requires very little set up. To start you should have [Docker](https://www.docker.com/) installed. Docker is a simple way to get complicated, multi-service applications up and running with little configuration. You can run any of the Loon images on your local computer using only the Docker Desktop UI.

To start, you'll need to pull one of the two officially supported images. In Docker Desktop, you can search for the official images by typing in the name of the respective image. Then, pulling the image will create the image on your local Docker instance. You can view all your images in the left-hand sidebar of Docker Desktop.

Once the image is pulled, you can run the image by clicking the "play" icon to the right of the image. This will create a container that will begin running the Loon image.

:::warning
Note that each image requires two volume paths and an environment variable to be specified in order to run properly. In Docker desktop, you can adjust these values when clicking "run" on the image and then expanding the "Optional Settings" section. Please see below for the information that is required for your respective image.
:::

## Debugging Your Loon Image

Loon comes with a robust logging system that will help you debug in the case of any issues. By default, logs are outputted to the container and can be seen in the "Logs" tab when your container is running. Additionally, each of the separate services that run inside the Loon container will be separated in Docker for you to investigate. When you start the Loon container, another set of containers (named "build-files") will also be created. Expanding this in your Docker Desktop UI will show the statuses of each service that is running. You can independently check the logs for each of these containers.

### Common Problems

**Problem:** Docker says that "Redis" and "Data/MinIO" is running, but nothing else was able to run. What happened?

**Solution:** Sometimes, when shutting down the container, the database that is used in Loon will not shutdown properly. Upon restart, the new database that is created will not have access to the proper port since it is still in use by the old database. This will prevent the rest of the applications from starting. To solve this, you can try restarting the Loon container. If that is not sufficient, deleting the containers and then re-run the base Loon image will solve the issue

**Problem:** Docker states that my "Data/MinIO" container was not able to successfully start.

**Solution:** When mounting the location of your local data to the container, Docker requires certain access to that directory in order to function. If the directory you are attempting to mount requires administrator privileges, you may not be able to mount that directory. Try using a directory that requires less privileges to access.

## Loon Images

### Local Loon

To run this image, you will need to specify the location of your Docker socket to mount, the path where your data is currently located, and an additional environment variable.

Image Name in Docker Hub: visdesignlab/local-loon

Image source: https://hub.docker.com/r/visdesignlab/local-loon

All Versions: https://hub.docker.com/r/visdesignlab/local-loon/tags

#### Volumes

| Volumes           | Source                     | Destination          | Details                                                 |
| ----------------- | -------------------------- | -------------------- | ------------------------------------------------------- |
| Docker Volume     | /var/run/docker.sock       | /var/run/docker.sock | This is required for to start nested docker containers. |
| Local Data Volume | Absolute path to your data | /app/data            | Location of where your data lives.                      |

#### Environment Variables

| Environment Variable | Key                                    | Value                      | Details                                                 |
| -------------------- | -------------------------------------- | -------------------------- | ------------------------------------------------------- |
| Local Data Volume    | LOCALDATASETTINGS_SOURCEVOLUMELOCATION | Absolute path to your data | This will be identical to your Data Volume source path. |

### Standard Loon

To run this image, you will need to specify the location of your Docker socket to mount, the path where you would like your data to be uploaded, and an additional environment variable.

Image Name in Docker Hub: visdesignlab/loon

Image source: https://hub.docker.com/r/visdesignlab/loon

All Versions: https://hub.docker.com/r/visdesignlab/loon/tags

#### Volumes

| Volumes           | Source                     | Destination          | Details                                                 |
| ----------------- | -------------------------- | -------------------- | ------------------------------------------------------- |
| Docker Volume     | /var/run/docker.sock       | /var/run/docker.sock | This is required for to start nested docker containers. |
| MinIO Data Volume | Absolute path to your data | /app/data            | Location of where your data lives.                      |

#### Environment Variables

| Environment Variable | Key                                | Value                      | Details                                                 |
| -------------------- | ---------------------------------- | -------------------------- | ------------------------------------------------------- |
| MinIO Data Volume    | MINIOSETTINGS_SOURCEVOLUMELOCATION | Absolute path to your data | This will be identical to your Data Volume source path. |
| MinIO Access Key   | MINIOSETTINGS_MINIOSTORAGEACCESSKEY | Username for MinIO storage | This will be used as the access key when accessing the MinIO bucket via AWS CLI and will be used as the username when using the web UI. Must be longer than 3 characters in length. |
| MinIO Secret Key   | MINIOSETTINGS_MINIOSTORAGESECRETKEY | Password for MinIO storage | This will be used as the secret access key when accessing the MinIO bucket via AWS CLI and will be used as the password when using the web UI. Must be longer than 7 characters in length.|


:::warning
By default, the access and secret access keys will be set to "admin" and "minioadmin", respectively. We _highly_ suggest adding these environment variables in order to override these defaults when deploying on a server. If you're just using MinIO in a local deployment, changing these defaults may not be necessary and can be left out when running the image.
:::