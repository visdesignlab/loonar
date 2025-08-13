# Working with MinIO

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
If the deployment of Loon is using it's default credentials, the `aws_access_key_id` and `aws_secret_access_key` will be "admin" and "minioadmin". You administrator might have provisioned a separate account for you, in which case you should use the access key (username) and secret access key (password) that they provide for you. If you're deploying Loon yourself, check out the MinIO settings configuration [here](../loon-for-developers/building-loon.md#minio-settings).
:::


Now that we have the credentials properly configured, we need to determine the endpoint url. If you're running this instance on your localhost, the endpoint is simply "http://localhost". If this is deployed on a remote server, you can directly use the base domain name for the server (i.e. for our remote server, we use "https://loonsw.sci.utah.edu" since this is our base url where we access the deployed application).

Once you've determined the endpoint url, we can run the following to list the items currently in the bucket:

```bash
aws s3 ls s3://data --endpoint-url {endpoint-url} --profile loon-user
```

Note that this will not list all files in nested directories -- it will list immediate files in the root of the bucket and the directory names.

:::warning
The AWS CLI `--dryrun` flag is extremely helpful when copying large datasets. Instead of copying the data, it will only show the final location of all data you are attempting to copy. We _highly_ suggest using this flag to ensure that your data is being copied to the correct place and then removing the flag when you've verified this.
:::

To test copying a single file in the root of the bucket, we can do the following:

```bash
aws s3 cp /path/to/my_file.txt s3://data/ --endpoint-url {endpoint-url} --profile loon-user --dryrun
```

When you're ready to copy the file over, remove the `--dryrun` flag. By default, if a file named "my_file.txt" already exists in `s3://data/`, the file will be overwritten.

If we want to copy an entire directory while maintaining it structure (a common use case), we can do the following

```bash
aws s3 cp /path/to/{name_of_directory} s3://data/{name_of_directory}/ --recursive  --endpoint-url {endpoint-url} --profile loon-user --dryrun
```

Again, here we use the `--dryrun` flag to first ensure that the data is copied to the correct directory. You may remove this once you've verified that the data is copying to the desired location.

:::info
You do not always have to let the entire `--dryrun` operation complete when copying large data. Often, you will understand if your data is being copied to the correct location long before it has completed. You can exit the command simply by using `Ctrl+C/Cmd+C` in your terminal.
:::

Note that the "name_of_directory" is present in both the source and the destination. Under the hood, this is essentially saying "copy all files that are inside my source directory into a new directory". So, when we use the same name for both the source and destination, it will essentially copy that entire directory including the original name.


## MinIO Console

MinIO comes with a sleek web UI to manage stored data. To access the MinIO WebUI, you can head to `{your_base_url}/minio/` (i.e. http://localhost/minio/). From here, you'll be prompted to log in. As stated previously, the username is the MinIO access key and the password is the MinIO secret key (i.e. if you're using the default setup, the values are "admin" and "minioadmin", respectively).

After logging in, you will see an initial bucket created for you: the "data" bucket. Once inside this bucket, you'll be able to view all files uploaded. You can download files, delete files, or upload files using this console.

:::warning
We _strongly_ suggest using the AWS CLI for uploading large datasets. The only time that the web UI may be useful for uploading is when updating single files, like the `aa_index.json` file or a single experiment JSON file. This is because using the WebUI does not come with the same verboseness and robustness that the AWS CLI S3 copy commands to -- which can lead to issues when trying to transfer large datasets.
:::