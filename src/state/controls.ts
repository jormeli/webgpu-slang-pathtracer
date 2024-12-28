import { signal } from '@preact/signals-react'
import type { RenderMode } from '@/components/renderer/useRenderWorker'
import Scene from '@/renderer/scene'
import cornellSuzanne from '@/assets/untitled.obj?raw'
import cornellBoxMtl from '@/assets/cornell-box.mtl?raw'

export const cameraPosition = signal<[number, number, number]>([0, 0, 2])
export const renderMode = signal<RenderMode>('raster')
export const maxSamples = signal(25)
export const width = signal(640)
export const height = signal(640)
export const scene = signal(Scene.fromObj(cornellSuzanne, cornellBoxMtl))