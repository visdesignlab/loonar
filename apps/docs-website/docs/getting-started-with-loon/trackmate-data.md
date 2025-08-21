# Optional: Use Data from TrackMate

#### [TrackMate](https://imagej.net/plugins/trackmate/) is a popular FIJI (Image Analysis) plugin for:

- Robust tracking of cells and other objects in microscopy time-lapse images
- Various detection and tracking algorithms
- Visualization and analysis tools
- [Cellpose](https://www.cellpose.org/) is a cell segmentation algorithm for TrackMate:
  - Enables advanced object detection directly within the TrackMate workflow

## 1:&nbsp;&nbsp;&nbsp;Export Data from [TrackMate](https://imagej.net/plugins/trackmate/)

> ### 1.1:&nbsp;&nbsp;Rename tracks in Trackmate for lineage tracking
>
> - After a cell division, identify the parent track and the two daughter tracks.
> - Rename the daughter tracks by appending "a" or "b" to the parent track's name. For example, if the parent track is named "Track_0", the daughters should be named "Track_0a" and "Track_0b".
>
> ### 1.2:&nbsp;&nbsp;Manually correct tracks if possible
>
> - Visually inspect generated tracks to ensure accuracy.
> - Correct any errors in the tracking of the small ROIs (Regions of Interest). This likely involves manually adjusting spot positions or linking/unlinking spots to fix tracking mistakes. The exact method for manual correction will depend on the TrackMate interface, but typically involves using tools to "Add Spot," "Remove Spot," "Link Spots," or "Split Track."
>
> ### 1.3:&nbsp;&nbsp;Export data from TrackMate
>
> - Once the tracks are finalized and corrected, export the data:
> - Export the "Spots" feature table: In the TrackMate interface, navigate to the export options and find the command to export the spot features. This will generate a CSV file containing information about each spot, such as its position, size, and other measurements.
> - Export ImageJ ROIs: This is an important step to get the segmented regions of cells themselves. This can be done in ImageJ after using TrackMate to generate the ROIs, and typically involves saving the ROI Manager contents as a .zip file.

## 2:&nbsp;&nbsp;&nbsp;Convert TrackMate Data into [Loon Format](./data.md)

> We currently use [our conversion script on github](https://github.com/visdesignlab/aardvark-util/blob/main/ingest_trackmate.py). Click the Download button at the top-right of the script.
>
> ### Conversion Script Info:
>
> > **Inputs:**
> >
> > - A `.csv` file from TrackMate
> >   - Must currently include `LABEL`, `FRAME`, `POSITION_X`, `POSITION_Y` columns
> > - A folder containing `.roi` files from TrackMate
> >
> > **What the script does:**
> >
> > - Reads your `.csv` file, removes unnecessary rows / columns, sorts by frame
> > - Infers / Adds a `parent` column to the `.csv` file, which includes the parents of each track
> > - Outputs that corrected `.csv`
> > - Converts that corrected `.csv` to a `.parquet` file
> > - Converts `.roi` files to `GeoJSON` format, creating a folder structure based on frames
> >
> > **Outputs:**
> >
> > - A `metadata.csv` file with metadata for Loon
> > - A `metadata.parquet` file with metadata for Loon
> > - A segmentations folder with `GeoJSON` files for each frame
>
> ### Run the script:
>
> 1. Open your terminal:
>    - **Mac:** Press `Cmd + Space`, type `Terminal`, and press `Enter`
>    - **Windows:** Press `Win + R`, type `cmd`, and press `Enter`
> 2. Change to the directory where you saved `ingest_trackmate.py`:
>    - **Mac:** `cd ~/Downloads`
>    - **Windows:** `cd %USERPROFILE%\Downloads`
> 3. Run the script:
>    - Type `ingest_trackmate.py "/path/to/your/input.csv" "/path/to/your/roi_files" "/path/to/your/output"` and press `Enter`
>
> <details>
>
> <summary>**Optional:** New Conversion Script with User Interface</summary>
> ### Download our <a href="/convert_trackmate.py" download="convert_trackmate.py">new conversion script &#8595;</a>
> ### Run the script:
> 1. Open your terminal:
>    - **Mac:** Press `Cmd + Space`, type `Terminal`, and press `Enter`
>    - **Windows:** Press `Win + R`, type `cmd`, and press `Enter`
> 2. Change to the directory where you saved `convert_trackmate.py`:
>    - **Mac:** `cd ~/Downloads`
>    - **Windows:** `cd %USERPROFILE%\Downloads`
> 3. Run the script:
>    - Type `python convert_trackmate.py` and press `Enter`
> 4. Follow the on-screen instructions to convert your TrackMate data to Loon format
> </details>

<!-- TODO: point to something that exists -->
<!-- ## 3:&nbsp;&nbsp;&nbsp;Upload Formatted Data to Loon


> ### See: [Local Loon Upload](./quickstart.md)
>
> ### Option 2: [Server Upload](./loon-wrappers.md) -->
