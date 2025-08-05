import type { Feature } from 'geojson';

export type BBox = [
    number, // left
    number, // top
    number, // right
    number // bottom
];

// this is a better type, because the ordering is more explicit in code
// that consumes it. I also like min/max better than top/bottom
// because it is agnostic to the coordinate system.
//
// Ideally BBox should be migrated, but publications
// are more important 🤷
export type BetterBBox = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};

export function getMaxHeight(segmentations: Feature[]): number {
    let maxHeight = 0;
    for (const segmentation of segmentations) {
        if (!segmentation.bbox) continue;
        const height = getHeight(segmentation.bbox as BBox);
        if (height > maxHeight) {
            maxHeight = height;
        }
    }
    return maxHeight;
}

export function getHeight(bbox: BBox): number {
    return bbox[1] - bbox[3];
}

export function getWidth(bbox: BBox): number {
    return bbox[2] - bbox[0];
}

export function addMargin(
    bbox: BBox,
    top: number,
    bottom: number,
    left: number,
    right: number
): BBox {
    // prettier-ignore
    return [
        bbox[0] - left,
        bbox[1] + top,
        bbox[2] + right,
        bbox[3] - bottom,
    ];
}

export function expandHeight(bbox: BBox, height: number): BBox {
    const currHeight = getHeight(bbox);
    let margin = height - currHeight;
    if (margin < 0) {
        margin = 0;
        console.error('expandHeight: height is smaller than current height');
    }
    return addMargin(bbox, Math.ceil(margin / 2), Math.floor(margin / 2), 0, 0);
}

export function getBBoxAroundPoint(
    x: number,
    y: number,
    width: number,
    height: number
): BBox {
    x = Math.round(x);
    y = Math.round(y);
    return [x - width / 2, y + height / 2, x + width / 2, y - height / 2];
}

export function overlapAmount(a: BBox, b: BBox): number {
    // computed the area that overlaps between two bounding boxes
    if (!overlaps(a, b)) return 0;
    const left = Math.max(a[0], b[0]);
    const right = Math.min(a[2], b[2]);
    const bottom = Math.max(a[3], b[3]);
    const top = Math.min(a[1], b[1]);
    return (right - left) * (top - bottom);
}

export function pointInBBox(x: number, y: number, bbox: BBox): boolean {
    const singularBBox: BBox = [x, y, x, y];
    return overlaps(bbox, singularBBox);
}

export function scaleLengthForConstantVisualSize(
    size: number,
    zoom: number
): number {
    // scale the size based on the inverse of the zoom so the visual is consistent
    return size * 2 ** -zoom;
}

export function overlaps(
    a: BBox,
    b: BBox,
    betweenSpaceX?: number,
    betweenSpaceY?: number
): boolean {
    // to overlap the x dimension and y dimension must both overlap
    return (
        overlaps1D(a[0], a[2], b[0], b[2], betweenSpaceX) && // left and right
        overlaps1D(a[3], a[1], b[3], b[1], betweenSpaceY) // bottom and top
    );
}

export function overlaps1D(
    aMin: number,
    aMax: number,
    bMin: number,
    bMax: number,
    betweenSpace?: number
): boolean {
    if (betweenSpace !== undefined) {
        aMin -= betweenSpace;
        aMax += betweenSpace;
    }
    return aMax >= bMin && aMin <= bMax;
}

export function outerBBox(a: BBox, b: BBox): BBox {
    return [
        Math.min(a[0], b[0]),
        Math.max(a[1], b[1]),
        Math.max(a[2], b[2]),
        Math.min(a[3], b[3]),
    ];
}
