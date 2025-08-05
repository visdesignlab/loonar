import { CompositeLayer, COORDINATE_SYSTEM } from '@deck.gl/core';
import GL from '@luma.gl/constants';

import {
    loadOmeTiff,
    getChannelStats,
    ImageLayer,
    XRLayer,
    AdditiveColormapExtension,
    SIGNAL_ABORTED,
} from '@hms-dbmi/viv';
import { ColorPaletteExtension } from '@vivjs/extensions';

import { isEqual } from 'lodash-es';
import { PolygonLayer } from '@deck.gl/layers/typed';
import type { TypedArray } from 'geotiff';

const defaultProps = {
    pickable: { type: 'boolean', value: true, compare: true },
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    contrastLimits: { type: 'array', value: [], compare: true },
    channelsVisible: { type: 'array', value: [], compare: true },
    selections: { type: 'array', value: [], compare: true },
    loader: {
        type: 'object',
        value: {
            getRaster: async () => ({ data: [], height: 0, width: 0 }),
            dtype: 'Uint16',
            shape: [],
        },
        compare: true,
    },
    onClick: { type: 'function', value: null, compare: true },
    interpolation: {
        type: 'number',
        value: GL.NEAREST,
        compare: true,
    },
    extensions: {
        type: 'array',
        value: [new ColorPaletteExtension()],
        compare: true,
    },
    colormap: { type: 'string', value: '', compare: true },
    // not used directly, but need to know for update logic
};

/**
 * @typedef LayerProps
 * @type {Object}
 * @property {Array.<Array.<number>>} contrastLimits List of [begin, end] values to control each channel's ramp function.
 * @property {Array.<boolean>} channelsVisible List of boolean values for each channel for whether or not it is visible.
 * @property {Object} loader PixelSource. Represents an N-dimensional image.
 * @property {Array} selections Selection to be used for fetching data.
 * @property {function=} onHover Hook function from deck.gl to handle hover objects.
 * @property {function=} onClick Hook function from deck.gl to handle clicked-on objects.
 * @property {String=} id Unique identifier for this layer.
 * @property {Array=} extensions [deck.gl extensions](https://deck.gl/docs/developer-guide/custom-layers/layer-extensions) to add to the layers.
 */

export interface Selection {
    c: number;
    t: number;
    z: number;
    snippets: Snippet[];
}

interface Snippet {
    source: BBox;
    destination: BBox;
}

type BBox = [number, number, number, number];

interface SelectionIndex {
    c: number;
    t: number;
    z: number;
}

interface SnippetData {
    index: SelectionIndex;
    source: BBox;
    destination: BBox;
    data: TypedArray;
}

interface InFlightRequest {
    snippets: Snippet[];
    stale: boolean;
}

class CellSnippetsLayer extends CompositeLayer {
    constructor(props: any) {
        super(props);
    }

    initializeState() {
        // this.state.cache = new LRUCache({
        //     max: 250,
        // });
        this.state.inFlightRequests = new Map<string, InFlightRequest>();
    }

    finalizeState() {
        // this.state.cache.clear();
    }

    getSnippetKey(c: number, t: number, z: number, source: number[]): string {
        return [this.props.id, c, t, z, ...source].toString();
    }

    getSelectionKey(selection: Selection): string {
        return [selection.c, selection.t, selection.z].toString();
    }

    matchSelectionsToData(selections: Selection[]): {
        newData: SnippetData[];
        unmatchedSelections: Selection[];
    } {
        const newData: SnippetData[] = [];
        const unmatchedSelections: Selection[] = [];

        for (const selection of selections) {
            const { c, t, z, snippets } = selection;
            const unmatchedSnippets: Snippet[] = [];
            for (const snippet of snippets) {
                const key = this.getSnippetKey(c, t, z, snippet.source);
                if (this.props.cache.has(key)) {
                    const snippetData = this.props.cache.get(key);
                    newData.push({
                        index: { c, t, z },
                        source: snippet.source,
                        destination: snippet.destination,
                        data: snippetData,
                    });
                    continue;
                }
                unmatchedSnippets.push(snippet);
            }
            if (unmatchedSnippets.length) {
                unmatchedSelections.push({
                    c,
                    t,
                    z,
                    snippets: unmatchedSnippets,
                });
            }
        }
        return { newData, unmatchedSelections };
    }

    updateState({ props, oldProps }: { props: any; oldProps: any }) {
        const loaderChanged = props.loader !== oldProps.loader;
        const selectionsChanged = !isEqual(
            props.selections,
            oldProps.selections
        );
        const colormapChanged = props.colormap !== oldProps.colormap;
        if (!loaderChanged && !selectionsChanged && !colormapChanged) return;
        const { loader } = this.props;
        if (!loader) return;

        // find selections that already have data cached in lru
        const { newData, unmatchedSelections } = this.matchSelectionsToData(
            props.selections
        );
        const loadingDestinations: BBox[] = [];

        if (unmatchedSelections.length === 0) {
            // all of the data is already here, don't need to request more
            this.setState({ data: newData, loadingDestinations });
            return;
        }

        // loading destinations will display immediately user can see
        // where snippets will load into
        for (const selection of unmatchedSelections) {
            for (const snippet of selection.snippets) {
                const destination = snippet.destination;
                loadingDestinations.push(destination);
            }
        }
        this.setState({ data: newData, loadingDestinations });
        const inFlightRequests = this.state.inFlightRequests as Map<
            string,
            InFlightRequest
        >;

        const onScreenRequests = new Set(
            unmatchedSelections.map((s) => this.getSelectionKey(s))
        );
        for (const [key, value] of inFlightRequests) {
            // set any inflight requests that are no longer
            // on screen to stale, they will still finish loading
            // data (might as well keep the effort, and aborting
            // seems to cause issues with geotiff loader)
            // BUT should not render to screen.
            if (!onScreenRequests.has(key)) {
                value.stale = true;
            }
        }
        for (const selection of unmatchedSelections) {
            const selectionKey = this.getSelectionKey(selection);
            if (inFlightRequests.has(selectionKey)) {
                // data is already being fetched, update the snippets and
                // avoid fetching again.
                inFlightRequests.get(selectionKey)!.snippets =
                    selection.snippets;
                continue;
            }
            const inFlightRequest: InFlightRequest = {
                snippets: selection.snippets,
                stale: false,
            };
            inFlightRequests.set(selectionKey, inFlightRequest);
            // actually load data asynchronously, note that we set the inFlightRequest
            // here, but it may change (by design), before the .then is called
            loader
                .getRaster({ selection })
                .then((raster: { data: any; width: any; height: any }) => {
                    const { c, t, z } = selection;
                    const request = inFlightRequests.get(selectionKey);
                    if (!request) {
                        throw 'inFlightRequest should not be null';
                    }
                    const loadedData = [];
                    for (const snippet of request.snippets) {
                        const snippetData = this.getSnippetOfByteArray(
                            raster.data,
                            raster.width,
                            raster.height,
                            snippet.source
                        );
                        const key = this.getSnippetKey(c, t, z, snippet.source);
                        this.props.cache.set(key, snippetData);

                        loadedData.push({
                            data: snippetData,
                            source: snippet.source,
                            destination: snippet.destination,
                            index: {
                                c,
                                t,
                                z,
                            },
                        });
                    }
                    inFlightRequests.delete(selectionKey);
                    if (!request.stale) {
                        this.setState({
                            data: this.state.data.concat(loadedData),
                        });
                    }
                })
                .catch((err: string) => {
                    if (err !== SIGNAL_ABORTED) {
                        throw err; // re-throws error if not our signal
                    }
                });
        }
    }

    renderLayers() {
        const layers = [];
        layers.push(this.createLoadingUnderLayer());
        layers.push(this.createImageSnippetLayers());
        return layers;
    }

    createLoadingUnderLayer() {
        const { loadingDestinations } = this.state;
        if (!loadingDestinations) return null;
        const destinations = loadingDestinations.map((d: BBox) => {
            const [l, t, r, b] = d;
            const coords = [
                [l, b],
                [l, t],
                [r, t],
                [r, b],
            ];
            return coords;
        });

        //get current time in seconds
        // const t = Date.now();


        const { id } = this.props;
        return new PolygonLayer({
            id: `${id}-snippet-loading-layer`,
            data: destinations,
            getPolygon: (d: any) => d,
            // getFillColor: [120, t % 255, 250],
            getFillColor: [120, 120, 160],
            filled: true,
            pickable: false,
            stroked: false,
            extruded: false,
        });
    }

    createImageSnippetLayers() {
        const { loader, id } = this.props;
        const { data } = this.state;
        if (!data) return null;
        const { dtype } = loader;

        if (!dtype) {
            return null;
        }

        const xrLayers = [];
        for (let i = 0; i < data.length; i++) {
            const snippet = data[i] as SnippetData;
            const [left, top, right, bottom] = snippet.destination;
            const bounds: [number, number, number, number] = [
              left,     // xMin
              bottom,   // yMin must be greater than ymax
              right,    // xMax
              top       // yMax
            ];
          
            // sanity‐check the 4 corners before pushing an XRLayer
            if (
              !Number.isFinite(bounds[0]) ||
              !Number.isFinite(bounds[1]) ||
              !Number.isFinite(bounds[2]) ||
              !Number.isFinite(bounds[3])
            ) {
              continue;
            }
            if (bounds[1] >= bounds[3]) {
              continue;
            }
          
            xrLayers.push(
              new XRLayer({
                id: `${id}-snippet-${i}`,
                contrastLimits: this.props.contrastLimits,
                channelsVisible: [true],
                // @ts-ignore
                extensions: this.props.extensions,
                colormap: this.props.colormap,
                dtype,
                bounds: snippet.destination,
                channelData: {
                  data: [snippet.data],
                  width: snippet.source[2] - snippet.source[0],
                  height: snippet.source[1] - snippet.source[3],
                }
              })
            );
          }

        return xrLayers;
    }

    getSnippetOfByteArray(
        byteArray: any[],
        width: number,
        height: number,
        bbox: BBox // left, bottom, right, top
    ) {
        const [left, bottom, right, top] = bbox;
        const outputWidth = right - left;
        const outputHeight = bottom - top;
        // create output byte array with the same type as byteArray
        const outputByteArray = this.createSameTypeArray(
            byteArray,
            outputWidth * outputHeight
        );
        // byteArray is a flattened 1D array of pixel data, the snippet should
        // extract the values from the bbox and return them in a 1D flattened pixel array
        let i = 0;
        for (let y = top; y < bottom; y++) {
            for (let x = left; x < right; x++) {
                const index = y * width + x;
                // @ts-ignore: ignore because we know the type of the array should match
                if (0 <= y && y < height && 0 <= x && x < width) {
                    outputByteArray[i++] = byteArray[index];
                } else {
                    outputByteArray[i++] = 0;
                }
            }
        }

        return outputByteArray;
    }

    createSameTypeArray(input: any[], length: number) {
        // Mapping of typed array constructors
        const typedArrayConstructors = {
            Int8Array: Int8Array,
            Uint8Array: Uint8Array,
            Uint8ClampedArray: Uint8ClampedArray,
            Int16Array: Int16Array,
            Uint16Array: Uint16Array,
            Int32Array: Int32Array,
            Uint32Array: Uint32Array,
            Float32Array: Float32Array,
            Float64Array: Float64Array,
        };

        // Determine the type of the input array
        for (const key in typedArrayConstructors) {
            if (
                input instanceof
                typedArrayConstructors[
                    key as keyof typeof typedArrayConstructors
                ]
            ) {
                // Create a new instance of the same type
                return new typedArrayConstructors[
                    key as keyof typeof typedArrayConstructors
                ](length);
            }
        }

        throw new Error('Unsupported typed array type');
    }
}
CellSnippetsLayer.layerName = 'CellSnippetsLayer';
CellSnippetsLayer.defaultProps = defaultProps;

export default CellSnippetsLayer;
