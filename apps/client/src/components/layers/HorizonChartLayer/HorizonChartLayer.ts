// Modified (significantly) from the ScatterPlotLayer included in deck.gl.
// the following is the orginal license for the ScatterPlotLayer:
//
// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import { Layer, project32 } from '@deck.gl/core';
import { Geometry } from '@luma.gl/engine';
import { Model } from '@luma.gl/engine';
import GL from '@luma.gl/constants';

import vs from './HorizonChartLayer-vertex.glsl';
import fs from './HorizonChartLayer-fragment.glsl';

// import { Layer } from '@deck.gl/core';
import type {
    LayerProps,
    LayerDataSource,
    UpdateParameters,
    Accessor,
    Position,
    Color,
    DefaultProps,
} from '@deck.gl/core/typed';

const DEFAULT_COLOR: [number, number, number, number] = [0, 0, 0, 255];

/** All props supported by the HorizonChartLayer */
export type HorizonChartLayerProps<DataT = unknown> =
    _HorizonChartLayerProps<DataT> & LayerProps;

/** Props added by the HorizonChartLayer */
type _HorizonChartLayerProps<DataT> = {
    data: LayerDataSource<DataT>;
    instanceData: number[];
    /**
     * TODO: document
     */
    getModOffset?: Accessor<DataT, number>;

    /**
     * Center position accessor.
     */
    getPosition?: Accessor<DataT, Position>;
    destination: [number, number, number, number]; // [bottom, left, width, height]
    dataXExtent: [number, number];
    baseline: number;
    binSize: number;
    positiveColors: number[];
    negativeColors: number[];

    /**
     * Fill color accessor.
     * @default [0, 0, 0, 255]
     */
    getFillColor?: Accessor<DataT, Color>;
};

const defaultProps: DefaultProps<HorizonChartLayerProps> = {
    getPosition: { type: 'accessor', value: (x: any) => x.position },
    getFillColor: { type: 'accessor', value: DEFAULT_COLOR },
    binSize: 100,
};

/** Render circles at given coordinates. */
export default class HorizonChartLayer<
    DataT = any,
    ExtraPropsT extends {} = {}
> extends Layer<ExtraPropsT & Required<_HorizonChartLayerProps<DataT>>> {
    static defaultProps = defaultProps;
    static layerName: string = 'HorizonChartLayer';

    constructor(props: HorizonChartLayerProps) {
        super(props);
    }

    state!: {
        model?: Model;
    };

    getShaders() {
        return super.getShaders({ vs, fs, modules: [project32] });
    }

    initializeState() {
        // console.log('initialize custom HorizonChart layer state');
        this.getAttributeManager()!.addInstanced({
            instanceModOffsets: {
                size: 1,
                type: GL.INT,
                accessor: 'getModOffset',
                defaultValue: 0,
            },
        });
        // console.log('end initialize custom HorizonChart layer state');
    }

    updateState(params: UpdateParameters<any>) {
        // console.log('update state custom HorizonChart layer');
        super.updateState(params);
        // console.log(params);

        if (
            params.changeFlags.extensionsChanged ||
            (params.changeFlags.updateTriggersChanged &&
                params.changeFlags.updateTriggersChanged.instanceData)
        ) {
            // console.log('===-=-=-=-=---=- UPDATE STATE -==-=-=-=-=---=-');
            // TODO: check if instance geometry has changed
            // this.state.model?.destroy();
            this.state.model = this._getModel();
            this.getAttributeManager()!.invalidateAll();
        }
    }

    draw({ uniforms }: { uniforms: any }) {
        // console.log('draw custom HorizonChart layer');
        const {
            destination, // [bottom, left, width, height]
            dataXExtent,
            baseline,
            binSize,
            positiveColors,
            negativeColors,
        } = this.props;
        const model = this.state.model!;

        model.setUniforms(uniforms);
        model.setUniforms({
            destination, // [bottom, left, width, height]
            dataXExtent,
            baseline,
            binSize,
            positiveColors,
            negativeColors,
        });
        model.draw(this.context.renderPass);
    }

    protected _getModel() {
        // console.log('get model custom HorizonChart layer');
        const positions = this.props.instanceData;

        const geometryPositions = new Float32Array(positions);
        const geometry = new Geometry({
            drawMode: this.context.gl.TRIANGLE_STRIP,
            attributes: {
                positions: { size: 2, value: geometryPositions },
            },
        });
        const model = new Model(this.context.gl, {
            ...this.getShaders(),
            id: this.props.id,
            geometry,
            isInstanced: true,
        });
        // console.log('end get model custom HorizonChart layer');
        return model;
    }
}

export const horizonChartScheme = [
    '#E0F7FA',
    '#B3E5FC',
    '#81D4FA',
    '#4FC3F7',
    '#29B6F6',
    '#03A9F4',
    '#039BE5',
    '#0288D1',
    '#0277BD',
    '#01579B',
    '#003366',
    '#000000',
    '#000033',
    '#000066',
    '#000099',
    '#0000CC',
    '#0000FF',
];
