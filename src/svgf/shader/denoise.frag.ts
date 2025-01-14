﻿export default /* glsl */`
varying vec2 vUv;

uniform sampler2D depthTexture;
uniform sampler2D normalTexture;
uniform sampler2D momentTexture;
uniform vec2 invTexSize;
uniform bool horizontal;
uniform bool blurHorizontal;
uniform float denoise[textureCount];
uniform float depthPhi;
uniform float normalPhi;
uniform float roughnessPhi;
uniform float denoiseKernel;
uniform float stepSize;
uniform mat4 projectionMatrixInverse;
uniform mat4 projectionMatrix;
uniform mat4 cameraMatrixWorld;
uniform bool isFirstIteration;
uniform bool isLastIteration;

#include <packing>

#define EPSILON      0.00001
#define M_PI         3.1415926535897932384626433832795
#define PI           M_PI
#define luminance(a) dot(a, vec3(0.2125, 0.7154, 0.0721))

#include <customComposeShaderFunctions>

vec3 screenSpaceToWorldSpace(const vec2 uv, const float depth, const mat4 curMatrixWorld) {
    vec4 ndc = vec4(
        (uv.x - 0.5) * 2.0,
        (uv.y - 0.5) * 2.0,
        (depth - 0.5) * 2.0,
        1.0);

    vec4 clip = projectionMatrixInverse * ndc;
    vec4 view = curMatrixWorld * (clip / clip.w);

    return view.xyz;
}

float distToPlane(const vec3 worldPos, const vec3 neighborWorldPos, const vec3 worldNormal) {
    vec3 toCurrent = worldPos - neighborWorldPos;
    float distToPlane = abs(dot(toCurrent, worldNormal));

    return distToPlane;
}

void tap(const vec2 neighborVec, const vec2 pixelStepOffset, const vec3 normal,
         const float roughness, const vec3 worldPos,
         const float luma[textureCount], const float colorPhi[textureCount],
         inout vec3 denoisedColor[textureCount], inout float totalWeight[textureCount], inout float sumVariance[textureCount], inout float variance[textureCount]) {
    vec2 fullNeighborUv = neighborVec * pixelStepOffset;
    vec2 neighborUvNearest = vUv + fullNeighborUv;

    vec2 bilinearOffset = neighborVec.y > 0. ? invTexSize : -invTexSize;
    vec2 neighborUv = vUv + fullNeighborUv + bilinearOffset * 0.5;
    vec2 neighborUvRoughness = vUv + fullNeighborUv * (roughness < 0.15 ? roughness / 0.15 : 1.) + bilinearOffset * 0.5;

    float basicWeight = 1.0;

// depth similarity
#ifdef useDepth
    vec4 neighborDepthTexel = textureLod(depthTexture, neighborUvNearest, 0.);
    float neighborDepth = unpackRGBAToDepth(neighborDepthTexel);
    vec3 neighborWorldPos = screenSpaceToWorldSpace(neighborUvNearest, neighborDepth, cameraMatrixWorld);
    float depthDiff = (1. - distToPlane(worldPos, neighborWorldPos, normal));
    float depthSimilarity = max(depthDiff / depthPhi, 0.);

    basicWeight *= depthSimilarity;
#endif

// the normal texel saves the normal in the RGB channels and the roughness in the A channel
#if defined(useNormal) || defined(useRoughness)
    vec4 neighborNormalTexel = textureLod(normalTexture, neighborUvNearest, 0.);
#endif

// normal similarity
#ifdef useNormal
    vec3 neighborNormal = neighborNormalTexel.rgb;
    float normalDiff = dot(neighborNormal, normal);
    float normalSimilarity = pow(max(0., normalDiff), normalPhi);

    basicWeight *= normalSimilarity;
#endif

// roughness similarity
#ifdef useRoughness
    float neighborRoughness = neighborNormalTexel.a;
    neighborRoughness *= neighborRoughness;

    float roughnessDiff = abs(roughness - neighborRoughness);
    float roughnessSimilarity = exp(-roughnessDiff * roughnessPhi);

    basicWeight *= roughnessSimilarity;
#endif

    vec4 neighborInputTexel[textureCount];
    vec3 neighborColor;
    float neighborLuma, lumaDiff, lumaSimilarity, disocclusionBoost;

    float weight[textureCount];

#pragma unroll_loop_start
    for (int i = 0; i < textureCount; i++) {
        neighborInputTexel[i] = textureLod(texture[i], roughnessDependent[i] ? neighborUvRoughness : neighborUv, 0.);
        neighborColor = neighborInputTexel[i].rgb;

        neighborLuma = luminance(neighborColor);
        lumaDiff = abs(luma[i] - neighborLuma);
        lumaSimilarity = max(1.0 - lumaDiff / colorPhi[i], 0.0);

        weight[i] = min(basicWeight * lumaSimilarity, 1.0);

        disocclusionBoost = variance[i] / 1000.;
        weight[i] = mix(weight[i], 1., disocclusionBoost);

        denoisedColor[i] += neighborColor * weight[i];
        totalWeight[i] += weight[i];
    }

#pragma unroll_loop_end

#ifdef useMoment
    // moment
    if (isFirstIteration) {
        vec4 neighborMoment = textureLod(momentTexture, neighborUvNearest, 0.);

        neighborInputTexel[0].a = neighborMoment.g - neighborMoment.r * neighborMoment.r;
        sumVariance[0] += weight[0] * weight[0] * neighborInputTexel[0].a;

    #if momentTextureCount > 1
        neighborInputTexel[1].a = neighborMoment.a - neighborMoment.b * neighborMoment.b;
        sumVariance[1] += weight[1] * weight[1] * neighborInputTexel[1].a;
    #endif
    }
#endif

#pragma unroll_loop_start
    for (int i = 0; i < momentTextureCount; i++) {
#ifndef useMoment
        if (isFirstIteration) neighborInputTexel[i].a = 1.0;
#endif

        sumVariance[i] += weight[i] * weight[i] * neighborInputTexel[i].a;
    }
#pragma unroll_loop_end
}

void main() {
    vec4 depthTexel = textureLod(depthTexture, vUv, 0.);

    // skip background
    if (dot(depthTexel.rgb, depthTexel.rgb) == 0.) {
        discard;
        return;
    }

    // g-buffers
    float depth = unpackRGBAToDepth(depthTexel);
    vec3 worldPos = screenSpaceToWorldSpace(vUv, depth, cameraMatrixWorld);

    vec4 normalTexel = textureLod(normalTexture, vUv, 0.);
    vec3 normal = normalTexel.rgb;
    float roughness = normalTexel.a;
    roughness *= roughness;

    vec3 denoisedColor[textureCount];
    float sumVariance[textureCount];
    float variance[textureCount];

#ifdef doDenoise

    // color information

    vec4 texel[textureCount];
    float luma[textureCount];
    float totalWeight[textureCount];
    float colorPhi[textureCount];

    #pragma unroll_loop_start
    for (int i = 0; i < textureCount; i++) {
        totalWeight[i] = 1.0;

        texel[i] = textureLod(texture[i], vUv, 0.);
        denoisedColor[i] = texel[i].rgb;
        luma[i] = luminance(texel[i].rgb);
    }
    #pragma unroll_loop_end

    // moment
    #ifdef useMoment
    if (isFirstIteration) {
        vec4 moment = textureLod(momentTexture, vUv, 0.);
        texel[0].a = max(0.0, moment.g - moment.r * moment.r);
        variance[0] = min(1000., texel[0].a);

        #if momentTextureCount > 1
        texel[1].a = max(0.0, moment.a - moment.b * moment.b);
        variance[1] = min(1000., texel[1].a);
        #endif
    }
    #endif

    #pragma unroll_loop_start
    for (int i = 0; i < momentTextureCount; i++) {
    #ifndef useMoment
        if (isFirstIteration) texel[i].a = 1.0;
    #endif

        sumVariance[i] = texel[i].a;
        variance[i] = min(1000., texel[i].a);

        if (roughnessDependent[i]) {
            colorPhi[i] = denoise[i] * sqrt(basicVariance[i] * roughness + sumVariance[i]);
        } else {
            colorPhi[i] = denoise[i] * sqrt(basicVariance[i] + sumVariance[i]);
        }
    }
    #pragma unroll_loop_end

    vec2 pixelStepOffset = invTexSize * stepSize;

    if (blurHorizontal) {
        for (float i = -denoiseKernel; i <= denoiseKernel; i++) {
            if (i != 0.) {
                vec2 neighborVec = horizontal ? vec2(i, 0.) : vec2(0., i);

                tap(neighborVec, pixelStepOffset, normal, roughness,
                    worldPos, luma, colorPhi, denoisedColor, totalWeight, sumVariance, variance);
            }
        }

    } else {
        // diagonal (top left to bottom right) / diagonal (top right to bottom left)
        for (float i = -denoiseKernel; i <= denoiseKernel; i++) {
            if (i != 0.) {
                vec2 neighborVec = horizontal ? vec2(-i, -i) : vec2(i, -i);

                tap(neighborVec, pixelStepOffset, normal, roughness,
                    worldPos, luma, colorPhi, denoisedColor, totalWeight, sumVariance, variance);
            }
        }
    }

    #pragma unroll_loop_start
    for (int i = 0; i < textureCount; i++) {
        sumVariance[i] /= totalWeight[i] * totalWeight[i];
        denoisedColor[i] /= totalWeight[i];
    }
    #pragma unroll_loop_end

#else
    // no denoise iterations
    #pragma unroll_loop_start
    for (int i = 0; i < textureCount; i++) {
        denoisedColor[i] = textureLod(texture[i], vUv, 0.).rgb;
    }
    #pragma unroll_loop_end
#endif

    if (isLastIteration) {
#include <customComposeShader>
    }

#include <outputShader>
}`