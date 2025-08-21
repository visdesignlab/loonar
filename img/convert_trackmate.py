# - special steps are required to name the branches of lineages in a way that makes it possible to reconstruct the lineage
# - this exports appends an a/b to the end of the label.
# - they don't export a parent column, but we can fairly easily infer this now. This is what `infer_parent_from_id.py` does.
# - this complicates the link to the roi. (without the special steps the label matches the roi filename exactly) with this, the roi file
#   is in the form {label}-{index}.roi. Where `label` is from the `LABEL` column. Since there are multiple rows with the same label, it includes
#   an index for which one it refers to. This index is zero-indexed, and when index=0 the roi file is simply {label}.roi.
# 👆  🍻🍻🍻 DONE 🍻🍻🍻  👆
# - The TrackMate table also zero-indices the frame column. This needs to be adjusted to one-indexed for things to line up correctly
# - The table should also be sorted by frame before import.
# - `roi_to_geojson_trackmate.py` currently assumes the frame has been sorted and one-indexed (we did this manually for the first import)
#   then will generate the geojson files from the rois correctly.


# - updates with new naming convention
# add a new column for the track ID that strips the spot ID from the label column.
# Actually, simplify the logic for matching the roi files. This looks like it has a 1:1 mapping between label and roi filename.

"""
Convert TrackMate outputs into a format compatable for Loon software.

Inputs: 
- A CSV file from TrackMate
    - Must currently include 'LABEL', 'FRAME', 'POSITION_X', 'POSITION_Y' columns
- A folder containing ROI files from TrackMate

Process:
- Read the CSV file, remove unnecessary rows / columns, sort by frame
- Infer/Add a 'parent' column to the csv file, which includes the parents of each track
- Output that corrected csv
- Convert the that corrected csv to a Parquet file
- Convert ROI files to GeoJSON format, creating a folder structure based on frames

Outputs:
- A metadata.csv file with metadata for Loon
- A metadata.parquet file with metadata for Loon
- A segmentations folder with geojson files for each frame

"""

import os
import tkinter as tk
from tkinter import filedialog, messagebox
import fnmatch
from matlab_to_all import QUIET_MODE
import util_common as util
from roifile import ImagejRoi
from geojson import Feature, Polygon, FeatureCollection, dumps
from typing import Union, List
import pandas as pd
import re
import sys
import threading


QUIET_MODE = False
OVERWRITE = True

# Column names from file
frame = "FRAME"
position_x = "POSITION_X"
position_y = "POSITION_Y"
inputLabel = "LABEL"
label = "LOC-LABEL"
location = "location"

# New track ID column
loon_track = "loon_track"

def main(csv_filename, roi_folder, output_folder, metadata_csv=None, metadata_parquet=None, segmentations_folder=None):
    # load csv into df
    df = pd.read_csv(csv_filename)

    # delete extra rows with metadata
    df = df.drop([0, 1, 2])
    # df = df.infer_objects() # this made everything an object, but I would've expected this to work

    # reload and clean up temporary file.
    temp_csv = os.path.join(output_folder, "temp.csv")
    df.to_csv(temp_csv, index=False)
    df = pd.read_csv(temp_csv)
    os.remove(temp_csv)  # Clean up the temporary file

    # sort by frame
    # convert frame to int
    df[frame] = df[frame] + 1
    df = df.sort_values(by=[frame])

    df = df.rename(columns={"LOC": location})

    # check if the required columns are present
    required_columns = [frame, position_x, position_y]
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' is missing from the CSV file.")
        
    # If location column does not exist, create it
    if location not in df.columns:
        # create a location column with the same value as the label column
        df[location] = 0

    # If LOC-LABEL column does not exist, create it
    if label not in df.columns:
        # create a LOC-LABEL column with the same value as the label column
        df[label] = df[location].astype(str) + "_" + df[inputLabel].astype(str)
    # Scaling factor assumes positions rescaled from pixels to microns
    scaling_factor = 1.0
    df[position_x] = df[position_x] * scaling_factor
    df[position_y] = df[position_y] * scaling_factor

    # remove MANUAL_SPOT_COLOR column since it is all empty and is causing problems.
    if "MANUAL_SPOT_COLOR" in df.columns:
        df = df.drop(columns=["MANUAL_SPOT_COLOR"])

    # create new column for the track ID by dropping the spot ID from the label column
    df[loon_track] = df[label].apply(lambda x: os.path.splitext(x)[0])

    # move new column to first position
    cols = list(df.columns)
    cols.insert(0, cols.pop(cols.index(loon_track)))
    df = df[cols]

    # infer parent from the label.
    # Use custom output names if provided
    output_csv_filename = metadata_csv if metadata_csv else os.path.join(output_folder, "metadata.csv")
    df = infer_parent_from_id(df, output_csv_filename)

    geojson_output_folder = segmentations_folder if segmentations_folder else os.path.join(output_folder, "segmentations")
    roi_to_geojson(df, roi_folder, geojson_output_folder)

    parquet_path = metadata_parquet if metadata_parquet else os.path.join(output_folder, "metadata.parquet")
    df.to_parquet(parquet_path, index=False)

    return

# Given a dataframe with a track label column, create a parent column by infering parent values from labels.
def infer_parent_from_id(df, output_csv):
    # Add a new column 'parent' based on the 'LABEL' column
    def calculate_parent(child_label):
        if isinstance(child_label, str):
            if "." not in child_label:
                return child_label
            parent = child_label[:-1].rstrip(".")
            # check if parent exists in the LABEL column
            if parent not in df[label].values:
                # If parent does not exist, return the original label
                return child_label
        return parent

    df["parent"] = df[label].apply(calculate_parent)
    # Reorder columns so 'parent' is the second column
    cols = list(df.columns)
    cols.insert(1, cols.pop(cols.index("parent")))
    df = df[cols]

    util.ensure_directory_exists(output_csv)
    # Save the updated DataFrame to a new CSV file
    df.to_csv(output_csv, index=False)
    return df


######################

# Given a folder of ROI files and a dataframe, outputs a folder of GeoJson files
def roi_to_geojson(df, roi_folder, output_folder):
    util.ensure_directory_exists(output_folder)
    util.msg_header("Finding ROI files", QUIET_MODE)

    pattern = "Track_*.roi"
    filename_list = []
    # Recursively searches for roi files matching 'pattern'
    for root, _, files in os.walk(roi_folder):
        path = root.replace(roi_folder, "", 1)
        for name in fnmatch.filter(files, pattern):
            filename_list.append((path, name))

    # Sort the ROI filenames by folder, frame number, and track ID.
    filename_list.sort(key=lambda f: (f[0], parse_frame(f[1], df), parse_id(f[1])))

    # Log the number of files found
    filename_stats = get_filename_stats(filename_list, df)
    # Only print high-level status
    util.msg(
        "        ████████████████████ 100.00%, {} of {} files. {} of {} frames.".format(
            len(filename_list), len(filename_list), filename_stats[list(filename_stats.keys())[0]]["frames"] if filename_stats else 0, sum([v["frames"] for v in filename_stats.values()])
        ),
        QUIET_MODE,
        True,
    )


    feature_list = []
    last_frame = -1
    last_path = ""
    file_count = 0
    folder_count = 0

    # For each ROI file ... 
    for path, name in filename_list:

        # 
        frame = parse_frame(name, df)

        # Check if we're in a new folder; if so, update folder count and print a header.
        if path != last_path:
            folder_count += 1
            util.return_carriage(QUIET_MODE)
            util.return_carriage(QUIET_MODE)
            util.msg_header(
                "Converting folder [{}/{}]: {}".format(
                    folder_count, len(filename_stats), path
                ),
                QUIET_MODE,
            )
            file_count = 0
        file_count += 1

        # When a new frame is encountered, export the collected features for the previous frame.
        if last_frame != frame and last_frame != -1:
            export(
                feature_list,
                os.path.join(output_folder, last_path, "frames"),
                str(last_frame),
            )
            feature_list = []

        # Update the last processed frame and folder path trackers.
        last_frame = frame
        last_path = path

        # Construct the full path to the ROI file and parse its cell ID.
        filename = os.path.join(roi_folder, path, name)
        cell_id = parse_id(name)
        # Read the ROI file and convert its coordinates into a polygon feature.
        roi = ImagejRoi.fromfile(filename)
        outer_polygon_coords = roi.coordinates().tolist()
        outer_polygon_coords.append(
            outer_polygon_coords[0]
        )  # add beginning to end to close loop
        feature = Feature(
            geometry=Polygon([outer_polygon_coords]),
            properties={"id": cell_id, "frame": frame},
            bbox=[roi.left, roi.bottom, roi.right, roi.top],
        )
        # Export the individual cell feature into the corresponding folder.
        # Export in format frame-cell_id
        # Example: 26-73_Track_965.b.json
        export(
            feature,
            os.path.join(output_folder, last_path, "cells"),
            "{}-{}".format(str(frame), cell_id),
        )
        feature_list.append(feature)
    # Export any remaining features for the last processed frame.
    export(
        feature_list, os.path.join(output_folder, last_path, "frames"), str(last_frame)
    )

    # Finalize the output by returning carriage and printing the completion message.
    util.return_carriage(QUIET_MODE)
    util.return_carriage(QUIET_MODE)
    util.msg_header("Done 🥂", QUIET_MODE)
    return


# Returns the count and frames of filenames.
def get_filename_stats(filename_list: List, df) -> dict:
    filename_stats = {}
    for path, name in filename_list:
        frame = parse_frame(name, df)
        if path not in filename_stats:
            filename_stats[path] = {"count": 0, "frames": 0}
        filename_stats[path]["count"] += 1
        filename_stats[path]["frames"] = max(filename_stats[path]["frames"], frame)
    return filename_stats


def feature_list_to_json(feature_list: List) -> str:
    feature_collection = FeatureCollection(feature_list)
    return dumps(feature_collection)


def feature_to_json(feature: Feature) -> str:
    return dumps(feature)

# Export ROI data
def export(data: Union[Feature, List], full_path: str, name: str):
    # If data is a single feature, convert to JSON
    if isinstance(data, Feature):
        data = feature_to_json(data)
    # Otherwise convert feature list to FeatureCollection JSON
    else:
        data = feature_list_to_json(data)
    util.export_file(data, full_path, name, OVERWRITE)
    return

# Given a filename and df, extract unique frame number.
def parse_frame(filename: str, df) -> int:
    # Remove file extension from filename
    name_base = os.path.splitext(filename)[0]
    # Get the track ID and cell index from the name_base
    if "-" not in name_base:
        name_base = name_base + "-0" 
    track_id, cell_index = name_base.split("-")

    # Find the track based on track id, sort by frame
    track = df.loc[df[inputLabel] == track_id]
    track = track.sort_values(by=[frame])
    # Find the nth (cell_index) frame for this track
    track_frame = track.iloc[int(cell_index)][frame]
    
    return int(track_frame)

# Given a filename, returns the track_id
def parse_id(filename: str) -> int:
    track_id = os.path.splitext(filename)[0]
    # Remove -number suffix if it exists (e.g., "Track_618.abb-62" -> "Track_618.abb")
    track_id = re.sub(r'-\d+$', '', track_id)

    # Get value of the location column for this cell
    # Todo acutal location value
    cell_location = 73

    final_cell_id = f"{cell_location}_{track_id}"
    return final_cell_id


######################
def run_gui():
    root = tk.Tk()
    root.title("Convert Trackmate Data to Loon Data")
    root.geometry("900x600")
    root.configure(bg="white")

    # Fonts
    title_font = ("Arial", 22, "italic")
    label_font = ("Arial", 14, "italic")
    entry_font = ("Arial", 14)
    button_font = ("Arial", 14, "bold")
    text_font = ("Consolas", 13)

    # Step 1: Format your data
    step1_frame = tk.Frame(root, bg="white")
    step1_frame.pack(pady=16, fill=tk.X, padx=16)

    # Center the title label
    tk.Label(step1_frame, text="Step 1: Format your data", font=title_font, bg="white", fg="#222").pack(anchor="center", pady=(0, 8))
    tk.Label(step1_frame, text="Input folder structure:", font=("Arial", 16, "bold"), bg="white", fg="#222").pack(anchor="center", pady=(0, 8))

    instructions = (
        "    Each sub-folder should represent a location and contain:\n"
        "       - A CSV file exported from TrackMate\n"
        "       - A folder containing ROI files (name contains 'roi')\n"
        "\n"
        "    Example:\n"
        "       input /\n"
        "           --- Location1 /\n"
        "               --- data.csv\n"
        "               --- rois /\n"
        "           --- Location2 /\n"
        "               --- data.csv\n"
        "               --- rois/\n"
    )

    # Add a frame to hold the instructions and align them to the left
    instructions_frame = tk.Frame(step1_frame, bg="white")
    instructions_frame.pack(anchor="center")  # Center the entire Step 1 section

    # Left-align the instructions within the frame
    tk.Label(instructions_frame, text=instructions, font=("Consolas", 12), bg="white", fg="#222", justify="left", anchor="w").pack(fill=tk.X)

    # Step 2: Specify input and output folders
    tk.Label(root, text="Step 2: Specify input folder and output folder", font=title_font, bg="white", fg="#222").pack(pady=(16, 8))

    input_var = tk.StringVar()
    output_var = tk.StringVar()
    frame = tk.Frame(root, bg="white")
    frame.pack(pady=16)

    tk.Label(frame, text="Input Folder:", font=label_font, bg="white", fg="#222").grid(row=0, column=0, sticky="e", padx=6, pady=8)
    tk.Entry(frame, textvariable=input_var, width=44, font=entry_font, bg="#f8f8f8", fg="#222").grid(row=0, column=1, padx=6, pady=8)
    tk.Button(frame, text="Browse", command=lambda: input_var.set(filedialog.askdirectory(title="Select Input Folder")), font=button_font, bg="white", fg="#222", activebackground="#f5f5f5", activeforeground="#111", bd=0, highlightthickness=0, highlightbackground="white").grid(row=0, column=2, padx=6, pady=8)

    tk.Label(frame, text="Output Folder:", font=label_font, bg="white", fg="#222").grid(row=1, column=0, sticky="e", padx=6, pady=8)
    tk.Entry(frame, textvariable=output_var, width=44, font=entry_font, bg="#f8f8f8", fg="#222").grid(row=1, column=1, padx=6, pady=8)
    tk.Button(frame, text="Browse", command=lambda: output_var.set(filedialog.askdirectory(title="Select Output Folder")), font=button_font, bg="white", fg="#222", activebackground="#f5f5f5", activeforeground="#111", bd=0, highlightthickness=0, highlightbackground="white").grid(row=1, column=2, padx=6, pady=8)

    # Output section (hidden until Convert is clicked)
    output_frame = tk.Frame(root, bg="white")
    text_box = tk.Text(output_frame, wrap=tk.NONE, height=14, state=tk.DISABLED, font=text_font, bg="white", fg="#222", insertbackground="#222")
    y_scroll = tk.Scrollbar(output_frame, orient=tk.VERTICAL, command=text_box.yview)
    x_scroll = tk.Scrollbar(output_frame, orient=tk.HORIZONTAL, command=text_box.xview)
    text_box.config(yscrollcommand=y_scroll.set, xscrollcommand=x_scroll.set)

    # Show the console output box when Convert is clicked
    def show_output_box():
        output_frame.pack(fill=tk.BOTH, expand=True, padx=16, pady=(0, 16))
        text_box.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        # Scrolling
        y_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        x_scroll.pack(fill=tk.X)

    # Redirect stdout (console output) to the text box
    class StdoutRedirector:
        def __init__(self, widget):
            self.widget = widget
        def write(self, s):
            self.widget.config(state=tk.NORMAL)
            self.widget.insert(tk.END, s)
            self.widget.see(tk.END)
            self.widget.config(state=tk.DISABLED)
        def flush(self):
            pass
    # Utility messages go to the GUI output box
    def gui_msg(*args, **kwargs):
        msg = args[0] if args else ""
        print(msg)
    # Print a header message in the GUI output box
    def gui_msg_header(*args, **kwargs):
        msg = args[0] if args else ""
        print(msg)
    util.msg = gui_msg
    util.msg_header = gui_msg_header

    # Function to run batch conversion in a separate thread
    def run_batch_conversion_thread(input_folder, output_folder):
        try:
            # From the input, get each location (subfolder) and process each one
            subfolders = [f for f in os.listdir(input_folder) if os.path.isdir(os.path.join(input_folder, f))]
            parquet_paths = []
            # For this location ...
            for sub in subfolders:
                sub_path = os.path.join(input_folder, sub)
                # Find CSV file and ROI folder in sub_path
                csv_files = [f for f in os.listdir(sub_path) if f.lower().endswith('.csv')]
                roi_folders = [f for f in os.listdir(sub_path) if os.path.isdir(os.path.join(sub_path, f)) and 'roi' in f.lower()]
                if not csv_files or not roi_folders:
                    print(f"Skipping '{sub}': missing CSV or ROI folder\n")
                    continue
                csv_file = os.path.join(sub_path, csv_files[0])
                roi_folder = os.path.join(sub_path, roi_folders[0])
                # Create output folder for this location
                out_location_folder = os.path.join(output_folder, sub)
                os.makedirs(out_location_folder, exist_ok=True)
                out_metadata_csv = os.path.join(out_location_folder, "metadata.csv")
                out_segmentations = os.path.join(out_location_folder, "segmentations")
                # Parquet goes to temp file to save memory and then combined later
                out_metadata_parquet = os.path.join(output_folder, f"_tmp_{sub}.parquet")

                # Finally, process the CSV and ROI files for this location
                print(f"Processing '{sub}'...\n")
                try:
                    main(csv_file, roi_folder, out_location_folder, out_metadata_csv, out_metadata_parquet, out_segmentations)
                    parquet_paths.append(out_metadata_parquet)
                    print(f"Done: {sub}\n")
                except Exception as e:
                    print(f"Error in '{sub}': {e}\n")
            # Combine all temp parquet files into master metadata.parquet
            if parquet_paths:
                dfs = [pd.read_parquet(p) for p in parquet_paths]
                combined = pd.concat(dfs, ignore_index=True)
                master_parquet = os.path.join(output_folder, "metadata.parquet")
                combined.to_parquet(master_parquet)
                print(f"✅ Combined {len(parquet_paths)} files → {master_parquet}")
                # Remove temp parquet files
                for p in parquet_paths:
                    try:
                        os.remove(p)
                    except Exception:
                        pass
            print("\nBatch conversion complete!\n")
            root.after(0, lambda: messagebox.showinfo("Success", "Batch conversion complete!"))
        except Exception as e:
            print(f"An error occurred:\n{e}\n")
            error_message = f"An error occurred:\n{e}"
            root.after(0, lambda msg=error_message: messagebox.showerror("Error", msg))

    # Function to run the batch conversion when Convert button is clicked
    def run_batch_conversion():
        # Initialize
        input_folder = input_var.get()
        output_folder = output_var.get()
        if not input_folder or not output_folder:
            messagebox.showerror("Missing Input", "Please select both input and output folders.")
            return
        # Show and initialize the console output box
        show_output_box()
        sys.stdout = StdoutRedirector(text_box)
        sys.stderr = StdoutRedirector(text_box)
        text_box.config(state=tk.NORMAL)
        text_box.delete(1.0, tk.END)
        text_box.config(state=tk.DISABLED)
        # Finally start the batch conversion in a separate thread
        threading.Thread(target=run_batch_conversion_thread, args=(input_folder, output_folder), daemon=True).start()

    # Convert button clicked
    tk.Button(root, text="Convert", command=run_batch_conversion, font=button_font, bg="white", fg="#222", activebackground="#f5f5f5", activeforeground="#111", bd=0, highlightthickness=0, highlightbackground="white").pack(pady=24)
    root.mainloop()

######################
if __name__ == "__main__":
    run_gui()
