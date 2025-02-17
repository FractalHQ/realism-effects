import type { Texture, WebGLRenderer } from 'three'

import basicVertexShader from '../../utils/shader/basic.vert.js'
import { Pass } from 'postprocessing'
import {
	EquirectangularReflectionMapping,
	LinearMipMapLinearFilter,
	ClampToEdgeWrapping,
	WebGLRenderTarget,
	ShaderMaterial,
	DataTexture,
	NoBlending,
	RGBAFormat,
	FloatType,
} from 'three'

export class CubeToEquirectEnvPass extends Pass {
	renderTarget: WebGLRenderTarget

	_fullscreenMaterial: ShaderMaterial
	set fullscreenMaterial(arg: ShaderMaterial) {
		this._fullscreenMaterial = arg
	}
	get fullscreenMaterial(): ShaderMaterial {
		return this._fullscreenMaterial
	}

	constructor() {
		super('CubeToEquirectEnvPass')

		this.renderTarget = new WebGLRenderTarget(1, 1, { depthBuffer: false, type: FloatType })

		this._fullscreenMaterial = new ShaderMaterial({
			fragmentShader: /* glsl */ `
			varying vec2 vUv;
			uniform samplerCube cubeMap;

			#define M_PI 3.1415926535897932384626433832795
			
			// source: https://github.com/spite/CubemapToEquirectangular/blob/master/src/CubemapToEquirectangular.js
			void main() {
				float longitude = vUv.x * 2. * M_PI - M_PI + M_PI / 2.;
				float latitude = vUv.y * M_PI;

				vec3 dir = vec3(
					- sin( longitude ) * sin( latitude ),
					cos( latitude ),
					- cos( longitude ) * sin( latitude )
				);

				dir.y = -dir.y;

				gl_FragColor = textureCube( cubeMap, dir );
			}
			`.trim(),
			vertexShader: basicVertexShader,
			uniforms: {
				cubeMap: { value: null },
			},
			blending: NoBlending,
			depthWrite: false,
			depthTest: false,
			toneMapped: false,
		})
	}

	dispose() {
		this.renderTarget.dispose()
	}

	generateEquirectEnvMap(
		renderer: WebGLRenderer,
		cubeMap: Texture,
		width = NaN,
		height = NaN,
		maxWidth = 4096,
	) {
		if (isNaN(width) && isNaN(height)) {
			const w = cubeMap.source.data[0].width
			const widthEquirect = 2 ** Math.ceil(Math.log2(2 * w * 3 ** 0.5))
			const heightEquirect = 2 ** Math.ceil(Math.log2(w * 3 ** 0.5))

			width = widthEquirect
			height = heightEquirect
		}

		if (width > maxWidth) {
			width = maxWidth
			height = maxWidth / 2
		}

		this.renderTarget.setSize(width, height)
		this.fullscreenMaterial.uniforms.cubeMap.value = cubeMap

		const { renderTarget } = this

		renderer.setRenderTarget(renderTarget)
		renderer.render(this.scene, this.camera)

		// Create a new Float32Array to store the pixel data
		const pixelBuffer = new Float32Array(width * height * 4)
		renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixelBuffer)

		// Create a new data texture
		const equirectEnvMap = new DataTexture(pixelBuffer, width, height, RGBAFormat, FloatType)

		// Set texture options
		equirectEnvMap.wrapS = ClampToEdgeWrapping
		equirectEnvMap.wrapT = ClampToEdgeWrapping
		equirectEnvMap.minFilter = LinearMipMapLinearFilter
		equirectEnvMap.magFilter = LinearMipMapLinearFilter
		equirectEnvMap.needsUpdate = true

		equirectEnvMap.mapping = EquirectangularReflectionMapping

		return equirectEnvMap
	}
}
