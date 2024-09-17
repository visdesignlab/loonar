# Loon Data

## Experiment Data

Each experiment has a corresponding configuration file which specifies the locations of the segmentations, the metadata table, and the images. It also contains other important information such as the header names and which columns map to which Loon attribute. Below is an example of a configuration file.

```json title="ExperimentOne.json"
{
  "name": "ExperimentOne",
  "headers": [
    "Frame",
    "Tracking ID",
    "Lineage ID",
    "Position X (µm)",
    "Position Y (µm)",
    "Pixel Position X (pixels)",
    "Pixel Position Y (pixels)",
    "Volume (µm³)",
    "Radius (µm)",
    "Area (µm²)",
    "Sphericity ()",
    "Dry Mass (pg)",
    "Track Length (µm)",
    "Parent ID"
  ],
  "headerTransforms": {
    "time": "Frame",
    "frame": "Frame",
    "id": "Tracking ID",
    "parent": "Parent ID",
    "mass": "Dry Mass (pg)",
    "x": "Pixel Position X (pixels)",
    "y": "Pixel Position Y (pixels)"
  },
  "locationMetadataList": [
    {
      "id": "Condition A",
      "tabularDataFilename": "experiment1/Table_A.csv",
      "imageDataFilename": "experiment1/images_A.companion.ome",
      "segmentationsFolder": "experiment1/segmentations_A/"
    },
    {
      "id": "Condition B",
      "tabularDataFilename": "experiment1/Table_B.csv",
      "imageDataFilename": "experiment1/images_B.companion.ome",
      "segmentationsFolder": "experiment1/segmentations_B/"
    },
    {
      "id": "Condition C",
      "tabularDataFilename": "experiment1/Table_C.csv",
      "imageDataFilename": "experiment1/images_C.companion.ome",
      "segmentationsFolder": "experiment1/segmentations_C/"
    }
  ]
}
```

## `Segmentations Folder`

Each imaging location should have a corresponding folder that contains all of the segmentation files. The names of the files must correspond to the imaging frame. That is `1.json` will contain all of the cell segmentations for the first frame., `2.json` will contain the second frame, and so on. Each json file must follow the GeoJSON specification. In addition to the standard geometry attribute, the `bbox` attribute must be defined. To link the segmentations with the corresponding metadata the cell `id` defined in the feature table must be included as an `ID` in the GeoJSON properties object.

:::info
Often, segmentations are instead generated as `*.roi` files. When uploading using MinIO, Loon will automatically convert the `.roi` files to proper GeoJSON format. If you are instead using Loon without MinIO (i.e. using Local Loon), you will have to convert the `.roi` files to GeoJSON yourself. [Here](https://github.com/visdesignlab/aardvark-util/blob/main/roi_to_geojson.py) is a Python script which can convert `.roi` to GeoJSON from on of our accompanying repositories.
:::
