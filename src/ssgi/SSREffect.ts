import type { OrthographicCamera, PerspectiveCamera, Scene } from 'three'
import type { SSGIOptions } from './SSGIOptions'
import type { Pass } from 'postprocessing'

import { defaultSSGIOptions } from './SSGIOptions'
import { SSGIEffect } from './SSGIEffect'

export class SSREffect extends SSGIEffect {
	constructor(
		scene: Scene,
		camera: PerspectiveCamera | OrthographicCamera,
		velocityDepthNormalPass: Pass,
		options?: SSGIOptions,
	) {
		options = { ...defaultSSGIOptions, ...options }
		options.specularOnly = true

		super(scene, camera, velocityDepthNormalPass, options)
	}
}
