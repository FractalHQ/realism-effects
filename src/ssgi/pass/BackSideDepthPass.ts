import type { Scene, Camera, WebGLRenderer } from 'three'

import { Pass } from 'postprocessing'
import {
	BackSide,
	Color,
	MeshDepthMaterial,
	NearestFilter,
	RGBADepthPacking,
	WebGLRenderTarget,
} from 'three'

const backgroundColor = new Color(0)
const overrideMaterial = new MeshDepthMaterial({
	depthPacking: RGBADepthPacking,
	side: BackSide,
})

export class BackSideDepthPass extends Pass {
	renderTarget: WebGLRenderTarget

	constructor(public scene: Scene, public camera: Camera) {
		super('BackSideDepthPass')

		this.renderTarget = new WebGLRenderTarget(1, 1, {
			minFilter: NearestFilter,
			magFilter: NearestFilter,
		})
	}

	setSize(width: number, height: number) {
		this.renderTarget.setSize(width, height)
	}

	dispose() {
		super.dispose()

		this.renderTarget.dispose()
	}

	render(renderer: WebGLRenderer) {
		const { background } = this.scene

		this.scene.background = backgroundColor
		this.scene.overrideMaterial = overrideMaterial

		renderer.setRenderTarget(this.renderTarget)
		renderer.render(this.scene, this.camera)

		this.scene.background = background
		this.scene.overrideMaterial = null
	}
}
