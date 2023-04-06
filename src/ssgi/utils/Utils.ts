import type {
	MeshStandardMaterial,
	ShaderMaterial,
	SkinnedMesh,
	Object3D,
	Texture,
	Camera,
	Mesh,
} from 'three'
import type { SSGIMaterial } from '../material/SSGIMaterial.js'

import { GroundProjectedSkybox } from 'three/examples/jsm/objects/GroundProjectedSkybox.js'
import {
	DataTexture,
	FloatType,
	RGBAFormat,
	ShaderChunk,
	ShaderLib,
	UniformsUtils,
	Vector4,
} from 'three'
import type { MRTMaterial } from '../material/MRTMaterial.js'

/**
 * @todo This should be less hand-wavy.
 */
function hasMaterial(
	object?: Object3D,
): object is Mesh<any, MeshStandardMaterial> | SkinnedMesh<any, MeshStandardMaterial> {
	return !!object && 'material' in object && typeof object.material !== 'undefined'
}

export const getVisibleChildren = (object: Object3D) => {
	const queue = [object]
	const objects = [] as Array<
		Mesh<any, MeshStandardMaterial> | SkinnedMesh<any, MeshStandardMaterial>
	>

	while (queue.length !== 0) {
		const mesh = queue.shift()
		if (!mesh) continue

		if (hasMaterial(mesh)) objects.push(mesh)

		for (const c of mesh.children) {
			if (c.visible) queue.push(c)
		}
	}

	return objects
}

export const generateCubeUVSize = (
	parameters: Record<string, any> & { envMapCubeUVHeight: number },
) => {
	const imageHeight = parameters.envMapCubeUVHeight

	if (imageHeight === null) return null

	const maxMip = Math.log2(imageHeight) - 2

	const texelHeight = 1.0 / imageHeight

	const texelWidth = 1.0 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16))

	return { texelWidth, texelHeight, maxMip }
}

export const setupEnvMap = (
	ssgiMaterial: SSGIMaterial,
	envMap: Texture,
	envMapCubeUVHeight: number,
) => {
	ssgiMaterial.uniforms.envMap.value = envMap

	const envMapCubeUVSize = generateCubeUVSize({ envMapCubeUVHeight })

	if (!envMapCubeUVSize) return

	ssgiMaterial.defines.ENVMAP_TYPE_CUBE_UV = ''
	ssgiMaterial.defines.CUBEUV_TEXEL_WIDTH = envMapCubeUVSize.texelWidth
	ssgiMaterial.defines.CUBEUV_TEXEL_HEIGHT = envMapCubeUVSize.texelHeight
	ssgiMaterial.defines.CUBEUV_MAX_MIP = envMapCubeUVSize.maxMip + '.0'

	ssgiMaterial.needsUpdate = true
}

/**
 * @todo 'map' is not a valid key, but it's used here for some reason..
 */
export const keepMaterialMapUpdated = (
	mrtMaterial: MRTMaterial,
	originalMaterial: MeshStandardMaterial,
	prop: 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'map' | 'emissiveMap' | 'alphaMap',
	define:
		| 'USE_NORMALMAP'
		| 'USE_ROUGHNESSMAP'
		| 'USE_METALNESSMAP'
		| 'USE_MAP'
		| 'USE_EMISSIVEMAP'
		| 'USE_ALPHAMAP',
	useKey: boolean,
) => {
	if (useKey) {
		if (originalMaterial[prop] !== mrtMaterial[prop]) {
			mrtMaterial[prop] = originalMaterial[prop]
			mrtMaterial.uniforms[prop].value = originalMaterial[prop]

			if (originalMaterial[prop]) {
				mrtMaterial.defines[define] = ''

				if (define === 'USE_NORMALMAP') {
					mrtMaterial.defines.TANGENTSPACE_NORMALMAP = ''
				}
			} else {
				delete mrtMaterial.defines[define]
			}

			mrtMaterial.needsUpdate = true
		}
	} else if (mrtMaterial[prop] !== undefined) {
		mrtMaterial[prop] = undefined
		mrtMaterial.uniforms[prop].value = undefined
		delete mrtMaterial.defines[define]
		mrtMaterial.needsUpdate = true
	}
}

export const getMaxMipLevel = (texture: Texture) => {
	const { width, height } = texture.image

	return Math.floor(Math.log2(Math.max(width, height))) + 1
}

export const saveBoneTexture = (object: SkinnedMesh<any, ShaderMaterial>) => {
	let boneTexture = object.material.uniforms.prevBoneTexture.value

	if (boneTexture && boneTexture.image.width === object.skeleton.boneTexture?.image.width) {
		boneTexture = object.material.uniforms.prevBoneTexture.value
		boneTexture.image.data.set(object.skeleton.boneTexture?.image.data)
	} else {
		boneTexture?.dispose()

		const boneMatrices = object.skeleton.boneTexture?.image.data.slice()
		const size = object.skeleton.boneTexture?.image.width

		boneTexture = new DataTexture(boneMatrices, size, size, RGBAFormat, FloatType)
		object.material.uniforms.prevBoneTexture.value = boneTexture

		boneTexture.needsUpdate = true
	}
}

export const updateVelocityDepthNormalMaterialBeforeRender = (c: any, camera: Camera) => {
	if (c.skeleton?.boneTexture) {
		c.material.uniforms.boneTexture.value = c.skeleton.boneTexture

		if (!('USE_SKINNING' in c.material.defines)) {
			c.material.defines.USE_SKINNING = ''
			c.material.defines.BONE_TEXTURE = ''

			c.material.needsUpdate = true
		}
	}

	c.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, c.matrixWorld)

	c.material.uniforms.velocityMatrix.value.multiplyMatrices(
		camera.projectionMatrix,
		c.modelViewMatrix,
	)
}

export const updateVelocityDepthNormalMaterialAfterRender = (c: any, camera: Camera) => {
	c.material.uniforms.prevVelocityMatrix.value.multiplyMatrices(
		camera.projectionMatrix,
		c.modelViewMatrix,
	)

	if (c.skeleton?.boneTexture) saveBoneTexture(c)
}

export const createGlobalDisableIblRadianceUniform = () => {
	if (!ShaderChunk.envmap_physical_pars_fragment.includes('iblRadianceDisabled')) {
		ShaderChunk.envmap_physical_pars_fragment =
			ShaderChunk.envmap_physical_pars_fragment.replace(
				'vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {',
				/* glsl */ `
		uniform bool iblRadianceDisabled;
	
		vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		 if(iblRadianceDisabled) return vec3(0.);
		`,
			)
	}

	if ('iblRadianceDisabled' in ShaderLib.physical.uniforms)
		return ShaderLib.physical.uniforms['iblRadianceDisabled']

	const globalIblRadianceDisabledUniform = {
		value: false,
	}

	ShaderLib.physical.uniforms.iblRadianceDisabled = globalIblRadianceDisabledUniform

	const { clone } = UniformsUtils
	UniformsUtils.clone = (uniforms) => {
		const result = clone(uniforms)

		if ('iblRadianceDisabled' in uniforms) {
			result.iblRadianceDisabled = globalIblRadianceDisabledUniform
		}

		return result
	}

	return globalIblRadianceDisabledUniform
}

export const createGlobalDisableIblIradianceUniform = () => {
	if (!ShaderChunk.envmap_physical_pars_fragment.includes('iblIrradianceDisabled')) {
		ShaderChunk.envmap_physical_pars_fragment =
			ShaderChunk.envmap_physical_pars_fragment.replace(
				'vec3 getIBLIrradiance( const in vec3 normal ) {',
				/* glsl */ `
			uniform bool iblIrradianceDisabled;
		
			vec3 getIBLIrradiance( const in vec3 normal ) {
			 if(iblIrradianceDisabled) return vec3(0.);
			`,
			)
	}

	if ('iblIrradianceDisabled' in ShaderLib.physical.uniforms)
		return ShaderLib.physical.uniforms['iblIrradianceDisabled']

	const globalIblIrradianceDisabledUniform = {
		value: false,
	}

	ShaderLib.physical.uniforms.iblIrradianceDisabled = globalIblIrradianceDisabledUniform

	const { clone } = UniformsUtils
	UniformsUtils.clone = (uniforms) => {
		const result = clone(uniforms)

		if ('iblIrradianceDisabled' in uniforms) {
			result.iblIrradianceDisabled = globalIblIrradianceDisabledUniform
		}

		return result
	}

	return globalIblIrradianceDisabledUniform
}

// source: https://github.com/mrdoob/three.js/blob/b9bc47ab1978022ab0947a9bce1b1209769b8d91/src/renderers/webgl/WebGLProgram.js#L228
// Unroll Loops

const unrollLoopPattern =
	/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g

export function unrollLoops(string: string) {
	return string.replace(unrollLoopPattern, loopReplacer)
}

function loopReplacer(_match: string, start: string, end: string, snippet: string) {
	let string = ''

	for (let i = parseInt(start); i < parseInt(end); i++) {
		string += snippet
			.replace(/\[\s*i\s*\]/g, '[ ' + i + ' ]')
			.replace(/UNROLLED_LOOP_INDEX/g, String(i))
	}

	return string
}

//

export const splitIntoGroupsOfVector4 = (arr: []) => {
	const result = []
	for (let i = 0; i < arr.length; i += 4) {
		result.push(new Vector4(...arr.slice(i, i + 4)))
	}
	return result
}

export const isGroundProjectedSkybox = (c: any): c is GroundProjectedSkybox => {
	return c instanceof GroundProjectedSkybox
}

export const isChildMaterialRenderable = (c: Mesh, material = c.material) => {
	if (Array.isArray(material)) return false
	return (
		material.visible &&
		material.depthWrite &&
		material.depthTest &&
		(!material.transparent || material.opacity > 0) &&
		!isGroundProjectedSkybox(c)
	)
}

/**
 * A function that copies values that may or may not exist because reasons.
 *
 * @param originalMaterial - some material with a bunch of random keys maybe
 * @param newMaterial  - same as original maybe
 *
 * @todo - What material is this supposed to be?  The author is passing in
 * {@link MRTMaterial} but the not all of the keys listed here exist on it...??
 */
export const copyNecessaryProps = (
	originalMaterial: Record<string, any>,
	newMaterial: Record<string, any>,
) => {
	const keys = [
		'vertexTangent',
		'vertexColors',
		'vertexAlphas',
		'vertexUvs',
		'uvsVertexOnly',
		'supportsVertexTextures',
		'instancing',
		'instancingColor',
		'side',
		'flatShading',
		'skinning',
		'doubleSided',
		'flipSided',
	] as const

	for (const key of keys) newMaterial[key] = originalMaterial[key]
}

/** A typesafe {@link Object.keys} that preserves the input types without widening them. */
export const objectKeys = <T extends Record<string, any>>(obj: T) => {
	return Object.keys(obj) as (keyof T)[]
}
