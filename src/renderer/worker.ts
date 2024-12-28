import Scene from './scene';
import Camera from './camera';
import { Pipeline, BDPTPipeline, RasterPipeline } from './pipeline';
import type { RenderParams } from '../components/renderer/useRenderWorker';
let context: GPUCanvasContext;
let device: GPUDevice;
let frameNum = 0;
let frameStart: number;
let frameTimes: number[] = [];
let canvas: HTMLCanvasElement;
let pipelines: Pipeline[] = [];
  
let params: RenderParams = {} as RenderParams;

async function initDevice() {
    // 1: request adapter and device
    if (!navigator.gpu) {
      throw Error('WebGPU not supported.');
    }
  
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw Error('Couldn\'t request WebGPU adapter.');
    }
  
    let _device = await adapter.requestDevice({ requiredFeatures: ['bgra8unorm-storage']});
    if (!_device) {
      throw Error('Couldn\'t request WebGPU device.');
    }
    device = _device
}

function frame() {
    if (frameStart) {
        if (params.renderMode === 'raster' || frameNum < params.maxSamples) frameTimes.push(Date.now() - frameStart);
            self.postMessage({
                type: 'stats',
                frameNum,
                frameTime: frameTimes.reduce((a, b) => a + b) / frameTimes.length,
                fps: 1000 / (frameTimes.reduce((a, b) => a + b) / frameTimes.length)
            });
            if (frameTimes.length > 10) {
              frameTimes = frameTimes.slice(1);
            }
            if (params.renderMode === 'trace' && frameNum < params.maxSamples) frameNum++;
    }
    if (frameNum >= params.maxSamples && params.renderMode === 'trace') {
        requestAnimationFrame(frame);
        return;
    }
    frameStart = Date.now();
    pipelines[params.renderMode === 'raster' ? 0 : 1].execute(frameNum);

    if (params.renderMode === 'trace') frameNum++;

    requestAnimationFrame(frame);
  }

function initPipelines(device: GPUDevice, scene: Scene, camera: Camera) {
    pipelines = [
        new RasterPipeline(device, scene, camera),
        new BDPTPipeline(device, scene, camera),
    ];
    pipelines.forEach(p => p.init(context));
}

  async function init(_canvas: HTMLCanvasElement) {
    if (!params) {
        throw Error('No params provided');
        return;
    }
    await initDevice()

    canvas = _canvas;  
    let _context = canvas.getContext('webgpu');
    if (!_context) {
      throw Error('WebGPU not supported.');
    }
    context = _context;
  
    context.configure({
      device: device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      //alphaMode: 'unpremultiplied',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT
    });

    initPipelines(device, params.scene, params.camera);

    requestAnimationFrame(frame);
  }

  self.addEventListener('message', (ev) => {
    const { type, ...rest } = ev.data;
    switch (type) {
      case 'init': {
        try {
          init(ev.data.offscreenCanvas);
        } catch (err) {
          if (err instanceof Error) {
            console.error(
              `Error while initializing WebGPU in worker process: ${err.message}`
            );
          } else {
            console.error('Unknown error while initializing WebGPU in worker process');
          }
        }
        break;
      }
      case 'camera': {
        const { camera } = rest;
        params.camera = Camera.fromMatrix(camera.viewMatrix, camera.projectionMatrix);
        pipelines.forEach(p => p.camera = params.camera);
        frameNum = 0;
        break;
      }
      case 'canvas': {
        canvas.width = ev.data.width;
        canvas.height = ev.data.height;
        break;
      }
      case 'render': {
        frameNum = 0;
        requestAnimationFrame(frame);
        break;
      }
      case 'params': {
        const { params: _params } = rest;
        _params.scene = new Scene(_params.scene.vertices, _params.scene.objects, _params.scene.materials);
        _params.camera = Camera.fromMatrix(_params.camera.viewMatrix, _params.camera.projectionMatrix);
        params = _params;
        frameNum = 0;
        if (device) initPipelines(device, params.scene, params.camera);
        break;
      }
      case 'setParam': {
        const { key, value } = rest as { key: keyof RenderParams, value: any };
        (params as any)[key] = value;
        if (key !== 'maxSamples') {
          frameNum = 0;
        }
        break;
      }
    }
  });