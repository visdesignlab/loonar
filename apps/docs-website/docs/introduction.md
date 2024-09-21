---
sidebar_position: 1
---

# What Is Loon

_Description of loon at a high level_

## Variations and using Loon

We deploy Loon in two separate versions: one that is meant to be used locally called **Local Loon** and one that ships with a user-friendly object storage and upload process which we just call **Loon** or **Standard Loon**.

## Which Version Is Best For You?

The standard Loon application comes with everything you need to upload, store, process, and interact with your cell microscopy data. One of the large advantages to using standard Loon is that you do not need to handle any data management or conversions -- data is uploaded using the UI in with zip files. We process the data in these zip files to convert them to a data structure that Loon expects. For example, data coming from the common Livecyte uses `.roi` files for their segmentations. Standard Loon will convert each of these `.roi` files to GeoJSON files automatically. If you'd like to deploy Loon to a central server where users can upload and access their data over the internet, this would be the version for you.

One of the downfalls of standard Loon, however, is that processing these files can take some time -- especially since the segmentations and images can be so numerous. If you are using Loon in a more "CI/CD" pipeline in order to correct your own segmentation development or view many experiments quickly, it may be more appropriate to use Local Loon. In this version, you are responsible for your own data management and to ensure that the data you place in your data store is in the expected format.

Both versions are shipped as a single docker image which you can read more about [here](./loon-for-scientists/loon-wrappers.md). If you're looking to get started working with Loon, we suggest that you look into the [quickstart tutorial for scientists](./loon-for-scientists/quickstart.md).

If you are a developer or working on deploying Loon to a central server, we suggest checking out the [quickstart tutorial for developers](./loon-for-developers/quickstart.md). This section will also give you more information about building Loon from source so that you can customize its configuration.
