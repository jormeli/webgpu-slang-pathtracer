import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar'
import Scene from '@/renderer/scene'
import { scene } from '@/state'
import { useSignals } from '@preact/signals-react/runtime'

export default function TopMenu() {
  useSignals()
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem
            onSelect={async () => {
              console.log('kissa')
              // open file dialog
              const input = document.createElement('input')
              input.type = 'file'
              // accept .obj and .mtl files
              input.accept = '.obj,.mtl'
              input.multiple = true
              input.onchange = () => {
                const files = input.files
                if (!files) return
                const obj = files[0]
                const mtl = files[1]
                const objReader = new FileReader()
                const mtlReader = new FileReader()
                objReader.onload = () => {
                  mtlReader.onload = () => {
                    scene.value = Scene.fromObj(objReader.result as string, mtlReader.result as string)
                    console.log(scene.value)
                  }
                  mtlReader.readAsText(mtl)
                }
                objReader.readAsText(obj)
              }
              input.click()
            }}
          >
            Import scene
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}
