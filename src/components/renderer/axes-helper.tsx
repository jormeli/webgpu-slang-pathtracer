import React, { useState, useEffect, useCallback } from 'react'
import { mat4, vec3, vec4 } from 'gl-matrix'
import Camera from '@/renderer/camera'
import { cn } from '@/lib/utils'

export default function AxesHelper(props: { camera: Camera } & React.ComponentProps<'svg'>) {
  const { camera, className, ...rest } = props
  const [viewProjectionMatrix, setViewProjectionMatrix] = useState(
    mat4.multiply(mat4.create(), camera.projectionMatrix, camera.viewMatrix)
  )
  const [width, height] = [50, 50]
  const [mouseDown, setMouseDown] = useState(false)
  const circleRef = React.useRef<SVGCircleElement>(null)

  const onAxisClick = useCallback((axis: number) => {
    const pos = camera.getPosition()
    const newFwd = vec3.create()
    newFwd[axis] = -1
    const target = mat4.lookAt(
      mat4.create(),
      pos,
      vec3.add(vec3.create(), pos, newFwd),
      axis === 1 ? [0, 0, 1] : [0, 1, 0]
    )

    camera.animate(target, 200, (t) => {
      return 1 - Math.pow(1 - t, 3)
    })
  }, [])
  const onMouseDown = useCallback(() => {
    setMouseDown(true)
  }, [])
  const onMouseUp = useCallback(() => {
    circleRef.current?.style.setProperty('opacity', '0.0')
    setMouseDown(false)
  }, [])
  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!mouseDown) return
      circleRef.current?.style.setProperty('opacity', '1.0')
      const { movementX, movementY } = event
      const rotation = mat4.create()
      mat4.fromRotation(rotation, Math.hypot(movementX, movementY) * 0.01, [movementY, movementX, 0])
      camera.setViewMatrix(mat4.multiply(mat4.create(), rotation, camera.viewMatrix))
    },
    [mouseDown]
  )

  useEffect(() => {
    function onCameraUpdate() {
      setViewProjectionMatrix(mat4.multiply(mat4.create(), camera.projectionMatrix, camera.viewMatrix))
    }
    camera.addEventListener('change', onCameraUpdate)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mousemove', onMouseMove)

    return () => {
      camera.removeEventListener('change', onCameraUpdate)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [mouseDown])
  const pos = camera.getPosition()
  const circleRadius = 4
  const length = width / 4 - circleRadius
  const xAxis = vec4.transformMat4(vec4.create(), [pos[0] + length, pos[1], pos[2], 1], viewProjectionMatrix)
  const yAxis = vec4.transformMat4(vec4.create(), [pos[0], pos[1] + length, pos[2], 1], viewProjectionMatrix)
  const zAxis = vec4.transformMat4(vec4.create(), [pos[0], pos[1], pos[2] + length, 1], viewProjectionMatrix)
  const axes: [vec4, number][] = [xAxis, yAxis, zAxis].map((x, i) => [x, i] as [vec4, number])
  const sorted = axes.sort(([axis1], [axis2]) => axis2[3] - axis1[3])
  const colors = ['hsl(340 75% 55%)', 'hsl(160, 60%, 45%)', 'hsl(220 70% 50%)']
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      className={cn('w-[150px] h-[150px] select-none', className)}
      {...rest}
      onMouseDown={onMouseDown}
      onMouseMove={() => circleRef.current?.style.setProperty('opacity', '1.0')}
      onMouseLeave={() => circleRef.current?.style.setProperty('opacity', '0.0')}
    >
      <circle
        ref={circleRef}
        cx={width / 2}
        cy={height / 2}
        r={width / 2 - circleRadius}
        fill="rgba(255, 255, 255, 0.1)"
        opacity={0.0}
        className="cursor-move"
      />
      {sorted.map(([axis, idx]) => {
        return (
          <g
            key={`axis-${idx}`}
            className="opacity-75 hover:opacity-100 cursor-pointer"
            onClick={() => onAxisClick(idx)}
          >
            <line
              x1={width / 2}
              y1={height / 2}
              x2={width / 2 + axis[0]}
              y2={height / 2 - axis[1]}
              stroke={colors[idx]}
              strokeWidth="1"
            />
            <circle cx={width / 2 + axis[0]} cy={height / 2 - axis[1]} r={circleRadius} fill={colors[idx]} />
            <text
              x={width / 2 + axis[0]}
              y={height / 2 - axis[1]}
              textAnchor="middle"
              dy="0.3em"
              fill="white"
              fontSize="4"
            >
              {['X', 'Y', 'Z'][idx]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
