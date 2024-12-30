import { memo, useEffect, useRef } from 'react'
import useRenderWorker, { type RenderStatus, type RenderParams } from './useRenderWorker'
import { vec3 } from 'gl-matrix'
import { fps, frameNum } from '@/state'
import { useSignals } from '@preact/signals-react/runtime'

const Renderer = memo((props: RenderParams & { onStatus?: (status: RenderStatus) => void }) => {
  useSignals()
  const { width, height, camera } = props
  const { onStatus, ...rest } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { init, setCamera } = useRenderWorker({
    params: rest,
    onStatus: (status) => {
      fps.value = status.fps
      frameNum.value = status.frameNum
    },
  })

  const isDragging = useRef(false)

  const onCameraUpdate = () => {
    setCamera(camera)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      try {
        const offscreenCanvas = canvas.transferControlToOffscreen()
        setCamera(camera)
        init(offscreenCanvas)
      } catch (e) {
        console.error(e)
      }
    }
    camera.addEventListener('change', onCameraUpdate)

    return () => {
      camera.removeEventListener('change', onCameraUpdate)
    }
  }, [])

  useEffect(() => {
    function mouseDown() {
      isDragging.current = true
    }
    function mouseUp() {
      isDragging.current = false
    }
    function mouseMove(event: MouseEvent) {
      const { movementX, movementY } = event
      if (isDragging.current && (Math.abs(movementX) || Math.abs(movementY))) {
        const fwd = camera.getForwardDirection()
        fwd[0] += movementX * 0.01
        fwd[1] -= movementY * 0.01
        vec3.normalize(fwd, fwd)
        const pos = camera.getPosition()
        const newForward = vec3.add(vec3.create(), pos, fwd)
        camera.lookAt(newForward)
      }
    }
    function wheel(event: WheelEvent) {
      const { deltaY } = event
      const fwd = camera.getForwardDirection()
      camera.translate(vec3.scale(vec3.create(), fwd, deltaY * 0.01))
    }
    canvasRef.current?.addEventListener('mousedown', mouseDown)
    document.addEventListener('mouseup', mouseUp)
    document.addEventListener('mousemove', mouseMove)
    canvasRef.current?.addEventListener('wheel', wheel)

    return () => {
      canvasRef.current?.removeEventListener('mousedown', mouseDown)
      document.removeEventListener('mouseup', mouseUp)
      document.removeEventListener('mousemove', mouseMove)
      canvasRef.current?.removeEventListener('wheel', wheel)
    }
  }, [])

  return <canvas ref={canvasRef} width={width} height={height} className="max-w-[100%]" />
})
Renderer.displayName = 'Renderer'

export default Renderer
