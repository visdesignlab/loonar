import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Deploy Loon

**Two Loon versions** to choose from:
> 1. **Loon** 
>    - In this version, you upload microscopy data onto a **central server** where users can upload and access their data over the internet
>    - 🟩 Easier - Loon guides you through uploading data, **data is sharable**
>    - 🟥 Slower upload
> 2. **Local Loon**  
>    - In this version, your data is **not uploaded** to your server. 
>    - Instead, you link your data file (local to your computer).
>    - 🟩 **No slow data-upload required**
>    - 🟥 Harder - You must prepare your data in the expected format.
>  
**In short:**
> We recommend using the standard **Loon**.  
> If you iterate on your microscopy data frequently, and don't need to share it right away, we recommend using **Local Loon**.

--- 

## Follow Instructions To Deploy Loon
<Tabs>
<TabItem value="loon" label="Loon">

To get started, you'll need to first get Docker installed. You can visit the [official Docker website](https://www.docker.com/) for information on how to get Docker installed and ready-to-use.

## Step 1: Create a Docker Hub Account

We store our official releases of Loon in Docker Hub. In order to have access to these images, you'll need to first create a Docker Hub account. This can all be done inside the Docker Desktop UI

## Step 2: Find and Pull the Latest `loon` Image

Once you have a Docker account, you will be able to access the images in Docker Hub. In the serach bar at the top of the UI, search for `visdesignlab/loon`. Click the "Pull" button that is shown when clicking on the image. Once pulled, the image will appear in the set of "images" that can be accessed through the left-side navigation drawer.

## Step 3: Run the Image

Navigate to your images and find the `loon` image that was just pulled. Click "run" and then expand the optional settings.

In the optional settings, we'll need to specify two volume paths and one environment variable. Below is a table of what needs to be set.

The "Source" column is what needs to be entered into left column in the docker UI and the "Destination" column should be set in the right column.

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

## Step 4: Use the Application

Once the containers have all successfully started, you can visit the application at http://localhost/.
</TabItem>
<TabItem value="local-loon" label="Local Loon">
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
</TabItem>
</Tabs>