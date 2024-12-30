import { fps } from '@/state'
import { useSignalEffect, useSignal } from '@preact/signals-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, Legend } from 'recharts'
import { useSignals } from '@preact/signals-react/runtime'

const FPSChart = (props: React.ComponentProps<'div'>) => {
  useSignals()
  const history = useSignal<number[]>([])
  useSignalEffect(() => {
    history.value = [...history.peek(), fps.value].slice(-500)
  })
  const data = history.value.map((x, i) => ({ t: i, FPS: x }))

  return (
    <div {...props}>
      <ChartContainer
        config={{ FPS: { color: 'hsl(var(--muted-foreground))' } }}
        className="min-h-[60px] max-h-[40px] w-full bg-muted"
      >
        <LineChart accessibilityLayer data={data} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
          <XAxis dataKey="t" domain={[0, 500]} hide type="number" />
          <YAxis hide domain={[0, 'dataMax']} />
          <Line dataKey="FPS" dot={false} stroke="var(--color-FPS)" />
          <Legend verticalAlign="bottom" align="right" height={10} iconSize={0} />
          <ChartTooltip content={<ChartTooltipContent hideIndicator hideLabel />} />
        </LineChart>
      </ChartContainer>
    </div>
  )
}

export default FPSChart
