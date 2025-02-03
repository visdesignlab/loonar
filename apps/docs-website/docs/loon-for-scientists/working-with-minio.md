# Working With MinIO

When using MinIO, you have several different ways to upload and view data in your storage engine. The main way to upload data is using Loon's upload feature in the dashboard. With this, you can upload the raw image, segmentations, and tabular data file coming from a LiveCyte workflow without the need to pre-process the data yourself.

However, there are several situations where this additional processing is not necessary. For example, suppose you have a local version on Loon on your machine. If you're able to view this data, then your data is already compatible with Loon and does not need further processing. You may be using the local version of Loon in order to bypass long wait times associated with uploading data to a server and because you already have a unique workflow for processing such data to obtain quicker feedback.

Now suppose your team also has a "live" version of Loon deployed on a server which is using MinIO. Once you've completed your task and want to share this dataset with your colleagues, the only true way to handle this would be to upload the data to your live deployment. 

Since your data is already processed, there is no need to use Loon's upload feature. Instead we can copy data directly to the MinIO storage backend using the [AWS CLI](https://aws.amazon.com/cli/).


## AWS CLI Installation and Usage

The AWS CLI is a command line interface to transfer data to and from S3 buckets. Under the hood, MinIO acts as one of these S3 buckets, so most S3-compatible interfaces are also compatible with MinIO.

You should start by following the installation instructions for AWS CLI [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

Once the AWS CLI is installed, we need to configure the credentials file for use with our MinIO storage.

The simplest way to handle this is to first find the `credentials` file in our AWS setup. This is usually located in the `.aws` directory on your machine. Add the following lines to your setup:

```
[loon-user]
aws_access_key_id = theMinioStorageAccessKey
aws_secret_access_key = theMinioSecretAccessKey
```

:::info
If the deployment of Loon is using it's default credentials, the `aws_access_key_id` and `aws_secret_access_key` will be "admin" and "minioadmin". Reach out to your system administrator to see what these keys are. If you're deploying Loon yourself, check out the MinIO settings configuration [here](../loon-for-developers/building-loon.md#minio-settings).
:::

:::warning
If you are 
:::



If you wanted to share this local version, however, there is no simple way to do this. The 

Since your working with local Loon, however, there is no direct way to share your datasets with others. Suppose