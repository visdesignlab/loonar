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

export default `\
#version 300 es
#define SHADER_NAME HorizonChartLayer-vertex-shader

// the instance geometry (the repeated area plot vertices)
in vec3 positions;
// the mod offset for the individual instance
in int instanceModOffsets;

uniform vec4 destination; // [bottom, left, width, height]
uniform vec2 dataXExtent;
uniform float baseline;
uniform float binSize;
uniform vec4 positiveColors[9];
uniform vec4 negativeColors[9];

uniform float placeholderThreshold;
uniform float placeholderSize;


out vec4 vFillColor;
out float yClipPosition;
out vec2 range;


float lerp(float a, float b, float t) {
  return a + (b - a) * t;
}

float norm(float value, float minValue, float maxValue) {
  return (value - minValue) / (maxValue - minValue);
}

vec3 adjust_horizon_layers(vec3 position) {
  float baselineValue = -404.123456789;

  vec3 scaledPosition = position;


  bool afterPlaceholder = scaledPosition.x > placeholderThreshold;

  scaledPosition.x = lerp(
    destination[1], destination[1] + destination[2],
    norm(scaledPosition.x, dataXExtent[0], dataXExtent[1])
  );
  if (afterPlaceholder) {
    scaledPosition.x += placeholderSize;
  }
  float bottom = destination[0];
  float top = bottom - destination[3];
  
  if (instanceModOffsets == -8) {
    if (scaledPosition.y == baselineValue) {
      scaledPosition.y = top;
    } else {
      scaledPosition.y = destination[0];
    }
    return scaledPosition;
  }

  if (scaledPosition.y == baselineValue) {
    scaledPosition.y = destination[0];
    return scaledPosition;
  }

  float scaledBaselineOffset = lerp(bottom, top, norm(baseline, 0.0, binSize));

  scaledPosition.y += baseline;
  scaledPosition.y = lerp(
    bottom, top,
    norm(position.y - float(instanceModOffsets) * binSize, 0.0, binSize)
  );
  scaledPosition.y -= scaledBaselineOffset - bottom;

  return scaledPosition;
}

vec4 zoom_and_translate(vec3 position) {
  // I would expect this to be the same as project_common_position_to_clipspace
  // but that was not working when I had a different zoomX and zoomY, this
  // approach works.
  vec3 commonPos = project_position(position);
  return project_common_position_to_clipspace(vec4(commonPos, 1.0));
  // return project_common_position_to_clipspace(outPos);
  // return vec4(outPos[0], outPos[1], outPos[2], 1.0);
}

void main(void) {

  gl_Position = zoom_and_translate(
    adjust_horizon_layers(positions)
    );
  
  vec4 clipBottom = zoom_and_translate(
    vec3(0.0, destination[0], 0.0)
  );
  
  vec4 clipTop = zoom_and_translate(
    vec3(0.0, destination[0] - destination[3], 0.0)
  );

  range = vec2(clipBottom.y, clipTop.y);
  yClipPosition = gl_Position.y;


  if (instanceModOffsets >= 0) {
    vFillColor = positiveColors[instanceModOffsets];
  } else if (instanceModOffsets == -1) {
    vFillColor = vec4(0.96, 0.96, 0.96, 1.0); // white
  } else {
    vFillColor = negativeColors[-1 * instanceModOffsets - 2];
  }
}
`;
