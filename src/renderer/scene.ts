import { vec3 } from 'gl-matrix'
import ObjParser from 'obj-file-parser'
import MtlParser, { type Material as MTLMaterial } from './mtl-parser'

function readObj(obj: string, mtl?: string): [vec3[], Object3D[], Material[]] {
  const objFile = new ObjParser(obj)
  const data = objFile.parse()
  let materials: MTLMaterial[] = []
  if (mtl) {
    const mtlFile = new MtlParser(mtl)
    materials = mtlFile.parse()
  }
  const allVertices = data.models
    .map((m) => m.vertices)
    .flat()
    .map((v) => vec3.fromValues(v.x, v.y, v.z))
  const objects: Object3D[] = []
  for (let model of data.models) {
    const faces = []
    for (let face of model.faces) {
      const vertices = face.vertices.map((v) => v.vertexIndex)
      const material: number = materials.findIndex((m) => m.name === face.material)
      const tri = {
        a: vertices[0] - 1,
        b: vertices[1] - 1,
        c: vertices[2] - 1,
        materialIdx: material >= 0 ? material + 1 : 0,
      }
      faces.push(tri)
    }
    objects.push(new Object3D(faces, model.name))
  }
  return [
    allVertices,
    objects,
    [
      { surfaceColor: [1, 1, 1] },
      ...materials.map((m) => ({
        surfaceColor: [m.Kd.red, m.Kd.green, m.Kd.blue],
        emissionColor: [m.Ke.red, m.Ke.green, m.Ke.blue],
      })),
    ],
  ]
}

export type Face = {
  a: number
  b: number
  c: number
  materialIdx: number
  uva?: [number, number]
  uvb?: [number, number]
  uvc?: [number, number]
}

export type Material = {
  surfaceColor: vec3 | number[]
  emissionColor?: vec3 | number[]
}

export class Object3D {
  name: string
  faces: Face[]

  constructor(faces: Face[], name?: string) {
    this.faces = faces
    this.name = name || 'Object3D'
  }
}

class Scene {
  private vertices: vec3[]
  private materials: Material[]
  private objects: Object3D[]

  constructor(vertices: vec3[], objects: Object3D[], materials: Material[]) {
    this.vertices = vertices
    this.objects = objects
    this.materials = materials
  }

  // static fromObj function
  static fromObj(obj: string, mtl?: string) {
    const [vertices, faces, materials] = readObj(obj, mtl)
    return new Scene(vertices, faces, materials)
  }

  getVertices() {
    return this.vertices
  }

  getMaterials() {
    return this.materials
  }

  getFaces() {
    return this.objects.map((o) => o.faces).flat()
  }

  getObjects() {
    return this.objects
  }
}

export default Scene
