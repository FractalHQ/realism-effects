import type { PerspectiveCamera, Scene } from 'three'
import type { SSGIOptions } from './SSGIOptions'
import type { Pass } from 'postprocessing'

import { defaultSSGIOptions } from './SSGIOptions'
import { SSGIEffect } from './SSGIEffect'

/**
 * The SSDGIEffect is a simplified version of the {@link SSGIEffect} for
 * calculating diffused lighting only.
 *
 * @example
 *
 * @todo I can't find an example of how to use this anywhere, so
 * you'll have to just try random stuff until something works.
 */
export class SSDGIEffect extends SSGIEffect {
	constructor(
		scene: Scene,
		camera: PerspectiveCamera,
		velocityDepthNormalPass: Pass,
		options: SSGIOptions,
	) {
		options = { ...defaultSSGIOptions, ...options }
		options.diffuseOnly = true

		super(scene, camera, velocityDepthNormalPass, options)
	}
}
