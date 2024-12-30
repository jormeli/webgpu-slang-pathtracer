declare class MTLFile {
  constructor(file: string)
  parse(defaultMaterialName?: string): Material[]
}

declare namespace MTLFile {
  interface MTLFile {}
  interface ColorValue {
    method: string
    red: number
    green: number
    blue: number
  }
  interface Material {
    name: string
    illum: number
    Ka: ColorValue
    Kd: ColorValue
    Ks: ColorValue
    Ke: ColorValue
  }
}

export = MTLFile
