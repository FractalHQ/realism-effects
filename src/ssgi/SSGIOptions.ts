/**
 * Options of the SSGI effect
 */
export interface SSGIOptions {
	/** Maximum distance a SSGI ray can travel to find what it reflects. */
	distance?: number
	/** Maximum depth difference between a ray and the particular depth at its screen position before refining with binary search; higher values will result in better performance. */
	thickness?: number
	/** Whether to use a back-side depth buffer to approximate the actual thickness; enabling this may decrease performance; the thickness parameter will also be used as the minimum value. */
	autoThickness?: boolean
	/** Maximum roughness a texel can have to have SSGI calculated for it. */
	maxRoughness?: number
	/** A value between 0 and 1 to set how much the last frame's SSGI should be blended in; higher values will result in less noisy SSGI when moving the camera but a more smeary look. */
	blend?: number
	/** How many times the denoise filter runs, more iterations will denoise the frame better but need more performance. */
	denoiseIterations?: number
	/** The kernel (~ number of neighboring pixels) to take into account when denoising a pixel. */
	denoiseKernel?: number
	/** Diffuse luminance factor of the denoiser, higher values will denoise areas with varying luminance more aggressively. */
	denoiseDiffuse?: number
	/** Specular luminance factor of the denoiser, higher values will denoise areas with varying luminance more aggressively. */
	denoiseSpecular?: number
	/** Depth factor of the denoiser, higher values will use neighboring areas with different depth values more resulting in less noise but loss of details. */
	depthPhi?: number
	/** Normals factor of the denoiser, higher values will use neighboring areas with different normals more resulting in less noise but loss of details and sharpness. */
	normalPhi?: number
	/** Roughness factor of the denoiser setting how much the denoiser should only apply the blur to rougher surfaces, a value of 0 means the denoiser will blur mirror-like surfaces the same as rough surfaces. */
	roughnessPhi?: number
	/** How much to boost direct lighting. */
	directLightMultiplier?: number
	/** Higher values will result in lower mipmaps being sampled which will cause less noise but also less detail regarding environment lighting. */
	envBlur?: number
	/** Whether to use importance sampling for the environment map. */
	importanceSampling?: boolean
	/** Number of steps a SSGI ray can maximally do to find an object it intersected (and thus reflects). */
	steps?: number
	/** Once we had our ray intersect something, we need to find the exact point in space it intersected and thus it reflects; this can be done through binary search with the given number of maximum steps. */
	refineSteps?: number
	/** Number of samples per pixel. */
	spp?: number
	/** If there should still be SSGI for rays for which a reflecting point couldn't be found; enabling this will result in stretched looking SSGI which can look good or bad depending on the angle. */
	missedRays?: boolean
	/** Resolution of the SSGI effect, a resolution of 0.5 means the effect will be rendered at half resolution. */
	resolutionScale?: number
	/** Whether to only calculate SSR for specular reflections. */
	specularOnly?: boolean

	// todo - These were missing from the original object, but are used throughout the repo.
	// todo - This is a code smell and causing errors / confusion and should be sorted out.
	width?: number
	height?: number
	diffuseOnly?: boolean
	reprojectSpecular?: boolean
	roughnessDependent?: boolean
	basicVariance?: number
	neighborhoodClamping?: boolean
}

/**
 * The options of the SSGI effect
 */
export const defaultSSGIOptions = {
	distance: 10,
	thickness: 10,
	autoThickness: false,
	maxRoughness: 1,
	blend: 0.9,
	denoiseIterations: 1,
	denoiseKernel: 2,
	denoiseDiffuse: 10,
	denoiseSpecular: 10,
	depthPhi: 2,
	normalPhi: 50,
	roughnessPhi: 1,
	envBlur: 0.5,
	importanceSampling: true,
	directLightMultiplier: 1,
	steps: 20,
	refineSteps: 5,
	spp: 1,
	resolutionScale: 1,
	missedRays: false,
	specularOnly: false,
} satisfies SSGIOptions
