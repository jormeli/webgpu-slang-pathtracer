import React, { useEffect, useState } from 'react'
import { useSignals } from '@preact/signals-react/runtime'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { maxSamples, renderMode } from '@/state'
import { vec3 } from 'gl-matrix'
import { cn } from '@/lib/utils'
import FPSChart from '@/components/status/fps-chart'
import VectorInput, { DraggableNumberInput } from '@/components/ui/vector-input'
import { camera } from '@/App'
import type { RenderMode } from '@/components/renderer/useRenderWorker'
import { frameNum } from '@/state'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "@/components/ui/collapsible"
  import AxesHelper from "@/components/renderer/axes-helper"
  

const Label = (props : React.ComponentProps<'span'>) => {
    return (
      <span {...props} title={props.children?.toString()} className={cn("align-middle text-sm text-muted-foreground text-left truncate", props.className)} />
    )
}

const ReadOnly = (props : React.ComponentProps<'span'>) => {
    return (
      <span {...props} className={cn(
          "flex h-7 w-full rounded-sm bg-muted px-2 py-1 text-base transition-colors md:text-sm",
          props.className
        )} />
    )
}

const Section = (props : React.ComponentProps<'div'>) => {
    return (
        <div className={cn("flex flex-col gap-2 border-left border-l-4 border-muted", props.className)}>
            <Collapsible className="flex flex-col gap-2" defaultOpen>
                <CollapsibleTrigger className="w-full">
                    <div className="w-full text-md text-foreground bg-muted text-left pl-2">{props.title}</div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    {props.children}
                </CollapsibleContent>
            </Collapsible>
        </div>
    )
}
  
const Controls = () => {
    useSignals()
    const [pos, setPos] = useState<[number, number, number]>([...camera.getPosition()] as [number, number, number])
    const [fwd, setFwd] = useState([...camera.getForwardDirection()] as [number, number, number])
    useEffect(() => {
        const update = () => {
            const pos = camera.getPosition()
            setPos([pos[0], pos[1], pos[2]])
            const fwd = camera.getForwardDirection()
            setFwd([fwd[0], fwd[1], fwd[2]])
        }
        camera.addEventListener('change', update)
        return () => {
        camera.removeEventListener('change', update)
        }
    }, [])

    return (
    <div className="flex flex-col">
        <Section title="Status" className="pb-2">
            <div className="px-2 w-full">
                <div className="grid grid-cols-[minmax(40px,_1fr)_210px] gap-2">
                    <Label>Frame</Label>
                    <ReadOnly className="justify-self-end">{frameNum.value}</ReadOnly>
                    <FPSChart style={{gridColumn: 'span 2'}} />
                </div>
            </div>
        </Section>
        <Section title="Camera" className="pb-2">
            <div className="px-2 w-full">
                <div className="grid grid-cols-[minmax(40px,_1fr)_210px] gap-2">
                    <Label>Position</Label>
                    <VectorInput value={pos} onChange={(v) => camera.setPosition(v)} className="justify-self-end"/>
                    <Label>Forward</Label>
                    <VectorInput value={fwd} onChange={(v) => {
                        const pos = camera.getPosition()
                        camera.lookAt(vec3.add(vec3.create(), pos, v))
                    }} className="justify-self-end"/>
                    <AxesHelper camera={camera} style={{ gridColumn: 'span 2' }} className="w-full h-[150px] bg-muted" />
                </div>
            </div>
        </Section>
        <Section title="Renderer" className="pb-2">
            <div className="px-2 w-full">
                <div className="grid grid-cols-[minmax(40px,_1fr)_210px] gap-2">
                    <Label>Mode</Label>
                    <ToggleGroup type="single" value={renderMode.value} className="justify-self-end w-full" onValueChange={(v) => { if (v) renderMode.value = v as RenderMode}}>
                        <ToggleGroupItem value="raster" className="rounded-l-sm grow">Raster</ToggleGroupItem>
                        <ToggleGroupItem value="trace" className="rounded-r-sm grow">Trace</ToggleGroupItem>
                    </ToggleGroup>
                    <Label>Max Samples</Label>
                    <DraggableNumberInput value={maxSamples.value} step={1} onChange={(v) => maxSamples.value = v} className="justify-self-end w-full" />
                </div>
            </div>
        </Section>
    </div>
    )
}

export default Controls