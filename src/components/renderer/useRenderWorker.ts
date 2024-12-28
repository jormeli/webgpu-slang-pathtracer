import { useEffect, useRef, useCallback } from 'react';
import Scene from "@/renderer/scene"
import Camera from "@/renderer/camera"

export type RenderMode = 'raster' | 'trace'

export type RenderParams = {
    width: number
    height: number
    scene: Scene
    camera: Camera
    maxSamples: number
    renderMode: RenderMode
}

export type RenderStatus = {
    frameNum: number
    frameTime: number
    fps: number
    isWorking: boolean
}

export default function useRenderWorker(props: { params: RenderParams, onStatus?: (status: RenderStatus) => void }) {
    const { onStatus, params } = props
    const workerRef = useRef<Worker | null>(null)
    const stats = useRef<RenderStatus>({
        frameNum: 0,
        frameTime: 0,
        fps: 0,
        isWorking: false
    })

    const onMessage = useCallback((event: MessageEvent) => {
        const { type, ...rest } = event.data
        if (type === 'stats') {
            Object.assign(stats.current, rest, { isWorking: true })
            onStatus?.(stats.current)
        }
    }, [])

    useEffect(() => {
        workerRef.current = new Worker(new URL('../../renderer/worker.ts', import.meta.url), {
            type: 'module'
        })
        workerRef.current.onmessage = onMessage

        return () => {
            workerRef.current?.terminate()
        }
    }, [])

    useEffect(() => {
        workerRef.current?.postMessage({ type: 'params', params: {...params, camera: params.camera.serialize() }})
    }, [params])

    const init = useCallback((offscreenCanvas: OffscreenCanvas) => {
        workerRef.current?.postMessage({ type: 'init', offscreenCanvas }, [offscreenCanvas])
    }, [])

    const setCamera = useCallback((camera: Camera) => {
        workerRef.current?.postMessage({type: 'camera', camera: camera.serialize() })
    }, [])

    const setParam = useCallback((key: keyof RenderParams, value: any) => {
        workerRef.current?.postMessage({ type: 'setParam', key, value })
    }, [])

    return { stats: stats.current!, init, setCamera, setParam }
}