/// <reference types="@webgpu/types" />
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import TopMenu from "@/components/top-menu"
import Camera from './renderer/camera';
import TreeView from './components/tree-view'
import Renderer from "@/components/renderer/renderer"
import { renderMode, maxSamples, scene, width, height } from "@/state"
import { useSignals } from "@preact/signals-react/runtime";

import './App.css'
import Controls from "@/components/controls/controls"
export const camera = Camera.create([0, 0, 2], [0, 0, 0], 53, 1, 0.01, 1000);

function Main() {
  useSignals()

  return (
    <>
      <TopMenu />
      <ResizablePanelGroup direction="horizontal" style={{ width: '100vw', height: '100vh' }}>
        <ResizablePanel defaultSize={15} className="min-w-[300px]">
        <TreeView />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>
          <div className="flex h-[100%] w-[100%] items-center justify-center bg-muted relative">
          <Renderer
            width={width.value}
            height={height.value}
            camera={camera}
            scene={scene.value}
            maxSamples={maxSamples.value}
            renderMode={renderMode.value}
          />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={15} className="px-0 min-w-[300px]">
          <Controls />
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  )
}

function App() {
  return (
      <Main />
  )
}

export default App
