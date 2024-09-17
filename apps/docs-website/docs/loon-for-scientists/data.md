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
    "Position X (\u00b5m)",
    "Position Y (\u00b5m)",
    "Pixel Position X (pixels)",
    "Pixel Position Y (pixels)",
    "Volume (\u00b5m\u00b3)",
    "Mean Thickness (\u00b5m)",
    "Radius (\u00b5m)",
    "Area (\u00b5m\u00b2)",
    "Sphericity ()",
    "Length (\u00b5m)",
    "Width (\u00b5m)",
    "Orientation (\u00b0)",
    "Dry Mass (pg)",
    "Displacement (\u00b5m)",
    "Instantaneous Velocity (\u00b5m/s)",
    "Instantaneous Velocity X (\u00b5m/s)",
    "Instantaneous Velocity Y (\u00b5m/s)",
    "Track Length (\u00b5m)"
  ],
  "headerTransforms": {
    "time": "Frame",
    "frame": "Frame",
    "id": "Tracking ID",
    "parent": "Tracking ID",
    "mass": "Dry Mass (pg)",
    "x": "Position X (\u00b5m)",
    "y": "Position Y (\u00b5m)"
  },
  "locationMetadataList": [
    {
      "id": "1",
      "tabularDataFilename": "ExperimentOne/location_0/B2_6_feature_table.csv",
      "imageDataFilename": "ExperimentOne/location_0/images/20240607_624 mel KO_pharm Inhib_B2_6_Phase.companion.ome",
      "segmentationsFolder": "ExperimentOne/location_0/segmentations"
    }
  ]
}
```

## List of Experiments

```json title="aa_index.json"
{
  "experiments": ["ExpermientOne.json"]
}
```
