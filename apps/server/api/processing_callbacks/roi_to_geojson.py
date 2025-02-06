from roifile import ImagejRoi
from geojson import Feature, Polygon, dumps
from typing import Tuple

'''
Author: Devin Lange
Description: Converts .roi files to geojson for use in Loon
-- Converted for single file entry by Brian Bollen

-- Writing Transformations:
The callback must always have the file contents as bytes and the file namne (as a string). It will
then return a tuple of the modified data (as bytes) and the new file name (if changed.)
'''


def roi_to_geojson(file_contents: bytes, file_name: str) -> Tuple[bytes, str]:
    frame = parse_frame(file_name)
    cell_id = parse_id(file_name)
    roi = ImagejRoi.frombytes(file_contents)
    outer_polygon_coords = roi.coordinates().tolist()
    outer_polygon_coords.append(outer_polygon_coords[0])  # add beginning to end to close loop
    feature = Feature(
        geometry=Polygon([outer_polygon_coords]),
        properties={"id": cell_id, 'frame': frame},
        bbox=[roi.left, roi.bottom, roi.right, roi.top]
    )

    data = feature_to_json(feature)
    if file_name.endswith('.roi'):
        file_name = file_name[:-4] + ".json"

    data_bytes = data.encode('utf-8')

    return data_bytes, file_name


def parse_frame(filename: str) -> int:
    return int(filename.split('-')[0])


def parse_id(filename: str) -> int:
    return filename.split('-')[1].split('.')[0]


def feature_to_json(feature: Feature) -> str:
    return dumps(feature)


if __name__ == "__main__":
    # For testing purposes.
    with open('INSERT_FILE_PATH_WITH_FILE_NAME', 'rb') as f:
        data = f.read()
        data_bytes, new_file_name = roi_to_geojson(data, 'FILE_NAME')
        print(type(data_bytes))
        print(data_bytes.decode('utf-8'))
        print(new_file_name)
