import React, { useEffect, useState, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"

export const DraggableNumberInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, 'onChange'> & { value: number; step?: number; onChange: (value: number) => void; label?: string }>(
    ({ className, label, value, step, onChange, ...props }, ref) => {
        const [isMouseDown, setIsMouseDown] = useState(false)
        const [isMoving, setIsMoving] = useState(false)
        const [isTyping, setIsTyping] = useState(false)
        const [tmpValue, setTmpValue] = useState('')
        const inputRef = useRef<HTMLInputElement>(null)
        const mouseDown = useCallback(() => {
            setIsMouseDown(true)
        }, [])
        const mouseMove = useCallback((e: MouseEvent) => {
            if (isMouseDown) {
                if (!isMoving) setIsMoving(true)
                const scale = e.shiftKey ? 1000 : 100
                const newValue = step ? Math.round(value + e.movementX * step) : value + e.movementX / scale
                onChange(newValue)
                return newValue
            }
        }, [isMouseDown, value, isMoving])
        const mouseUp = useCallback(() => {
            setIsMouseDown(false)
            setIsMoving(false)
        }, [])
        useEffect(() => {
            document.addEventListener('mouseup', mouseUp)
            document.addEventListener('mousemove', mouseMove)
            return () => {
                document.removeEventListener('mouseup', mouseUp)
                document.removeEventListener('mousemove', mouseMove)
            }
        }, [mouseMove, mouseUp])
        return (
            <div className={cn(
                "flex h-7 gap-2 rounded-sm bg-muted px-2 py-1 text-base shadow-sm transition-colors justify-between cursor-ew-resize select-none",
                className
            )}
            style={{ lineHeight: '100%'}}
            onMouseDown={mouseDown}
            >
            <div className="h-full font-bold">{label}</div>
            <input
                ref={x => {
                    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = x
                    if (typeof ref === 'function') {
                        ref(x)
                    } else if (ref) {
                        ref.current = x
                    }
                }}
                type="text"
                value={!isTyping ? value.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 3
                }): tmpValue}
                disabled={isMouseDown && isMoving}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setIsTyping(true)
                    setTmpValue(e.target.value)
                }}
                onFocus={() => {
                    // select all text on focus
                    inputRef.current?.select()
                }}
                onBlur={() => {
                    setIsTyping(false)
                    const newValue = parseFloat(tmpValue)
                    if (!isNaN(newValue)) {
                        onChange(newValue)
                    }
                    setTmpValue('')
                }}
                className={cn(
                    "w-full min-w-8 placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm disabled:pointer-events-none text-right cursor-ew-resize bg-muted",
                    className
                )}
                {...props}
            />
            </div>
        )
    })

export default function VectorInput(props: { label?: string; value: [number, number, number], onChange: (value: [number, number, number]) => void; className?: string }) {
    const { value, onChange } = props
    return (
        <div className={cn("flex flex-row gap-1", props.className)}>
            <DraggableNumberInput
                value={value[0]}
                label="x"
                onChange={(v) => onChange([v, value[1], value[2]])}
            />
            <DraggableNumberInput
                value={value[1]}
                label="y"
                onChange={(v) => onChange([value[0], v, value[2]])}
            />
            <DraggableNumberInput
                value={value[2]}
                label="z"
                onChange={(v) => onChange([value[0], value[1], v])}
            />
        </div>
    )
}