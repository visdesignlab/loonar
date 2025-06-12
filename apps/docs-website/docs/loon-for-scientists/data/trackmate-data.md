# Importing From Trackmate

[TrackMate](https://imagej.net/plugins/trackmate/) is a popular Fiji plugin for robust tracking of cells and other objects in microscopy time-lapse images, offering various detection and tracking algorithms, as well as visualization and analysis tools. 

Recent versions of TrackMate have integrated deep-learning based segmentation algorithms like [Cellpose](https://www.cellpose.org/), allowing users to leverage Cellpose's advanced object detection directly within the TrackMate workflow. 

## Step 1: Export Data From Trackmate

## Step 2: Converting Trackmate Data into Loon Format

### Loon Data

### Converting Trackmate Data

We currently use a [custom python script](https://github.com/visdesignlab/aardvark-util) for conversion:


- **Input:**
  - Folder of ROI files
  - CSV of Trackmate cell data
- **Output:**
  - Folder of cell segmentations
  - CSV and Parquet file of cell metadata


Soon, we will simplify this conversion with a python script or library.

## Step 3: Upload

### Local Loon Upload

### Server Upload
