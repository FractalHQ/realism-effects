﻿import { GLSL3, Matrix4, NoBlending, ShaderMaterial, Uniform, Vector2, Vector3 } from 'three'
import vertexShader from '../../utils/shader/basic.vert'
import fragmentShader from '../shader/ssgi.frag'

import { EquirectHdrInfoUniform } from '../utils/EquirectHdrInfoUniform'
import ssgi_utils from '../shader/ssgi_utils.frag'

export class SSGIMaterial extends ShaderMaterial {
	constructor() {
		super({
			/**
			 * `type` isn't a valid option according to Typescript. I checked,
			 * and it's right (it isn't read from `params` and is set to `ShaderMaterial`).
			 * I added it below the super call so that it actually gets set.
			 */
			// type: 'SSGIMaterial',

			uniforms: {
				directLightTexture: new Uniform(null),
				accumulatedTexture: new Uniform(null),
				normalTexture: new Uniform(null),
				depthTexture: new Uniform(null),
				diffuseTexture: new Uniform(null),
				emissiveTexture: new Uniform(null),
				velocityTexture: new Uniform(null),
				blueNoiseTexture: new Uniform(null),
				backSideDepthTexture: new Uniform(null),
				projectionMatrix: new Uniform(new Matrix4()),
				inverseProjectionMatrix: new Uniform(new Matrix4()),
				cameraMatrixWorld: new Uniform(new Matrix4()),
				viewMatrix: new Uniform(new Matrix4()),
				cameraNear: new Uniform(0),
				cameraFar: new Uniform(0),
				rayDistance: new Uniform(0),
				thickness: new Uniform(0),
				frame: new Uniform(0),
				envBlur: new Uniform(0),
				maxRoughness: new Uniform(0),
				maxEnvMapMipLevel: new Uniform(0),
				envMapInfo: { value: new EquirectHdrInfoUniform() },
				envMapPosition: new Uniform(new Vector3()),
				envMapSize: new Uniform(new Vector3()),
				texSize: new Uniform(new Vector2()),
				blueNoiseRepeat: new Uniform(new Vector2()),
			},

			defines: {
				steps: 20,
				refineSteps: 5,
				spp: 1,
				directLightMultiplier: 1,
				CUBEUV_TEXEL_WIDTH: 0,
				CUBEUV_TEXEL_HEIGHT: 0,
				CUBEUV_MAX_MIP: 0,
				vWorldPosition: 'worldPos',
			},

			fragmentShader: fragmentShader.replace('#include <utils>', ssgi_utils),
			vertexShader,

			blending: NoBlending,
			depthWrite: false,
			depthTest: false,
			toneMapped: false,

			glslVersion: GLSL3,
		})

		this.type = 'SSGIMaterial'
	}
}
