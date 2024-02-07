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

export default `\
#version 300 es
#define SHADER_NAME scatterplot-layer-vertex-shader

in vec3 positions;

in vec3 instancePositions;
in vec3 instancePositions64Low;
in float instanceRadius;
in float instanceLineWidths;
// in vec4 instanceFillColors;
in vec4 instanceLineColors;
in vec3 instancePickingColors;

uniform float opacity;
uniform float radiusScale;
uniform float radiusMinPixels;
uniform float radiusMaxPixels;
uniform float lineWidthScale;
uniform float lineWidthMinPixels;
uniform float lineWidthMaxPixels;
uniform float stroked;
// uniform bool filled;
uniform bool antialiasing;
uniform int radiusUnits;
uniform int lineWidthUnits;

out vec4 vFillColor;
out vec4 vLineColor;
out vec2 unitPosition;
out float innerUnitRadius;
out float outerRadiusPixels;


void main(void) {
  // geometry.worldPosition = instancePositions;

  // Multiply out radius and clamp to limits
  outerRadiusPixels = clamp(
    project_size_to_pixel(radiusScale * instanceRadius, radiusUnits),
    radiusMinPixels, radiusMaxPixels
  );
  
  // Multiply out line width and clamp to limits
  float lineWidthPixels = clamp(
    project_size_to_pixel(lineWidthScale * instanceLineWidths, lineWidthUnits),
    lineWidthMinPixels, lineWidthMaxPixels
  );

  // outer radius needs to offset by half stroke width
  outerRadiusPixels += stroked * lineWidthPixels / 2.0;

  // Expand geometry to accomodate edge smoothing
  float edgePadding = antialiasing ? (outerRadiusPixels + SMOOTH_EDGE_RADIUS) / outerRadiusPixels : 1.0;

  // position on the containing square in [-1, 1] space
  unitPosition = edgePadding * positions.xy;
  // geometry.uv = unitPosition;
  // geometry.pickingColor = instancePickingColors;

  innerUnitRadius = 1.0 - stroked * lineWidthPixels / outerRadiusPixels;
  

    // vFillColor = vec4(0,1.0,0,1.0);

    // Apply opacity to instance color, or return instance picking color
    // vFillColor = vec4(instanceFillColors.rgb, instanceFillColors.a * opacity);
    vFillColor = vec4(0.6, 0.2, 0.3, 0.8);
    vec3 offset = edgePadding * positions * project_pixel_size(outerRadiusPixels);
    // DECKGL_FILTER_SIZE(offset, geometry);
    // TODO: hack and learn
    gl_Position = project_position_to_clipspace(instancePositions + vec3(100.0, 100.0, 0), instancePositions64Low, offset, geometry.position);
    // DECKGL_FILTER_GL_POSITION(gl_Position, geometry);



  // DECKGL_FILTER_COLOR(vFillColor, geometry);
  // vLineColor = vec4(instanceLineColors.rgb, instanceLineColors.a * opacity);
  // DECKGL_FILTER_COLOR(vLineColor, geometry);
}
`;
