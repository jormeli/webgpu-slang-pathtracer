import { mat4, vec3 } from 'gl-matrix'

const lerp = function (from: mat4, to: mat4, t: number) {
  const result = mat4.create()
  for (let i = 0; i < 16; i++) {
    result[i] = from[i] + t * (to[i] - from[i])
  }
  return result
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

export function saturate(x: number): number {
  return clamp(x, 0.0, 1.0)
}

class Camera extends EventTarget {
  viewMatrix: mat4
  inverseViewMatrix: mat4
  projectionMatrix: mat4

  constructor() {
    super()
    this.viewMatrix = mat4.create()
    this.inverseViewMatrix = mat4.create()
    this.projectionMatrix = mat4.create()
  }

  lookAt(target: vec3, up?: vec3) {
    const position = this.getPosition()
    this.viewMatrix = mat4.lookAt(this.viewMatrix, position, target, up || [0, 1, 0])
    this.inverseViewMatrix = mat4.invert(this.inverseViewMatrix, this.viewMatrix)
    this.dispatchEvent(new Event('change'))
  }

  translate(delta: vec3) {
    this.viewMatrix = mat4.translate(this.viewMatrix, this.viewMatrix, delta)
    this.inverseViewMatrix = mat4.invert(this.inverseViewMatrix, this.viewMatrix)
    this.dispatchEvent(new Event('change'))
  }

  getForwardDirection() {
    return vec3.fromValues(-this.viewMatrix[2], -this.viewMatrix[6], -this.viewMatrix[10])
  }

  getPosition() {
    return vec3.fromValues(this.inverseViewMatrix[12], this.inverseViewMatrix[13], this.inverseViewMatrix[14])
  }

  setPosition(position: vec3) {
    this.inverseViewMatrix[12] = position[0]
    this.inverseViewMatrix[13] = position[1]
    this.inverseViewMatrix[14] = position[2]
    this.viewMatrix = mat4.invert(this.viewMatrix, this.inverseViewMatrix)
    this.dispatchEvent(new Event('change'))
  }

  setViewMatrix(viewMatrix: mat4) {
    this.viewMatrix = viewMatrix
    this.inverseViewMatrix = mat4.invert(this.inverseViewMatrix, viewMatrix)
    this.dispatchEvent(new Event('change'))
  }

  serialize() {
    return {
      viewMatrix: this.viewMatrix,
      inverseViewMatrix: this.inverseViewMatrix,
      projectionMatrix: this.projectionMatrix,
    }
  }
  animate(to: mat4, duration: number, easing = (t: number) => t) {
    const from = this.viewMatrix
    const start = performance.now()
    const self = this
    function step() {
      const t = (performance.now() - start) / duration
      const viewMatrix = lerp(from, to, easing(t))
      self.setViewMatrix(viewMatrix)
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  static create(position: vec3, lookAt: vec3, fov = 53, aspect = 1, near = 0.01, far = 1000) {
    const camera = new Camera()
    camera.viewMatrix = mat4.lookAt(camera.viewMatrix, position, lookAt, [0, 1, 0])
    camera.inverseViewMatrix = mat4.invert(camera.inverseViewMatrix, camera.viewMatrix)
    camera.projectionMatrix = mat4.perspective(camera.projectionMatrix, (fov * Math.PI) / 180, aspect, near, far)
    return camera
  }

  static fromMatrix(viewMatrix: mat4, projectionMatrix: mat4) {
    const camera = new Camera()
    camera.viewMatrix = viewMatrix
    camera.inverseViewMatrix = mat4.invert(camera.inverseViewMatrix, viewMatrix)
    camera.projectionMatrix = projectionMatrix
    return camera
  }
}

export default Camera
