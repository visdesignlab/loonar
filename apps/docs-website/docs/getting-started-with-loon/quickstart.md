# Local Loon Quick Start Guide

To get started, you'll need to first get Docker installed. You can visit the [official Docker website](https://www.docker.com/) for information on how to get Docker installed and ready-to-use.

## Step 1: Create a Docker Hub Account

We store our official releases of Loon in Docker Hub. In order to have access to these images, you'll need to first create a Docker Hub account. This can all be done inside the Docker Desktop UI

## Step 2: Find and Pull the Latest `local-loon` Image

Once you have a Docker account, you will be able to access the images in Docker Hub. In the serach bar at the top of the UI, search for `visdesignlab/local-loon`. Click the "Pull" button that is shown when clicking on the image. Once pulled, the image will appear in the set of "images" that can be accessed through the left-side navigation drawer.

## Step 3: Run the Image

Navigate to your images and find the `local-loon` image that was just pulled. Click "run" and then expand the optional settings.

In the optional settings, we'll need to specify two volume paths and one environment variable. Below is a table of what needs to be set.

The "Source" column is what needs to be entered into left column in the docker UI and the "Destination" column should be set in the right column.

#### Volumes

| Volumes           | Source                     | Destination          | Details                                                 |
| ----------------- | -------------------------- | -------------------- | ------------------------------------------------------- |
| Docker Volume     | /var/run/docker.sock       | /var/run/docker.sock | This is required for to start nested docker containers. |
| Local Data Volume | Absolute path to your data | /app/data            | Location of where your data lives.                      |

The "Key" column is what needs to be entered into left column in the docker UI and the "Value" column should be set in the right column.

#### Environment Variables

| Environment Variable | Key                                    | Value                      | Details                                                 |
| -------------------- | -------------------------------------- | -------------------------- | ------------------------------------------------------- |
| Local Data Volume    | LOCALDATASETTINGS_SOURCEVOLUMELOCATION | Absolute path to your data | This will be identical to your Data Volume source path. |

Once these are set, you can optionally specify the name of the container and then click "Run". This will kick off several "Containers" which you can view in the left-hand drawer.

## Step 4: Use the Application

Once the containers have all successfully started, you can visit the application at http://localhost/.
