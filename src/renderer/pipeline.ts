import bdptShader from './shaders/bdpt';
import rasterShader from './shaders/raster.wgsl?raw';
import { makeShaderDataDefinitions, makeStructuredView, getSizeAndAlignmentOfUnsizedArrayElement, createBuffersAndAttributesFromArrays } from 'webgpu-utils';
import Scene from './scene';
import Camera from './camera';
import { mat4, vec3 } from 'gl-matrix';

export abstract class Pipeline {
    camera!: Camera;
    abstract init(context: GPUCanvasContext): void;
    abstract execute(frameNum: number): void;
}

export class BDPTPipeline extends Pipeline {
    private buffers: { [key: string]: GPUBuffer } = {};
    private bindGroups: { [key: number]: GPUBindGroup } = {};
    private device: GPUDevice;
    private scene: Scene;
    camera: Camera;
    private pipeline!: GPUComputePipeline;
    private context!: GPUCanvasContext;

    constructor(device: GPUDevice, scene: Scene, camera: Camera) {
        super();
        this.device = device;
        this.scene = scene;
        this.camera = camera;
    }

    init(context: GPUCanvasContext): void {
        this.context = context;
        const shaderModule = this.device.createShaderModule({
            code: bdptShader
        });
      
        const shaderDefs = makeShaderDataDefinitions(bdptShader);
      
        this.buffers.uniformBuffer = this.device.createBuffer({
          size: new Uint32Array([0]).byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        const faces = this.scene.getFaces();
        const vertices = this.scene.getVertices();
        const materials = this.scene.getMaterials();
    
        const { size: trianglesSize } = getSizeAndAlignmentOfUnsizedArrayElement(shaderDefs.storages.triangles);
        const trianglesView = makeStructuredView(shaderDefs.storages.triangles, new ArrayBuffer(faces.length * trianglesSize));
        const triangleBuffer = this.device.createBuffer({
          size: trianglesView.arrayBuffer.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        trianglesView.set(faces);
        const { size: verticesSize } = getSizeAndAlignmentOfUnsizedArrayElement(shaderDefs.storages.vertices);
        const verticesView = makeStructuredView(shaderDefs.storages.vertices, new ArrayBuffer(vertices.length * verticesSize));
        const verticesBuffer = this.device.createBuffer({
          size: verticesView.arrayBuffer.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        verticesView.set(vertices);
        const { size: materialsSize } = getSizeAndAlignmentOfUnsizedArrayElement(shaderDefs.storages.materials);
        const materialsView = makeStructuredView(shaderDefs.storages.materials, new ArrayBuffer(materials.length * materialsSize));
        const materialsBuffer = this.device.createBuffer({
          size: materialsView.arrayBuffer.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        materialsView.set(materials);
        this.device.queue.writeBuffer(triangleBuffer, 0, trianglesView.arrayBuffer);
        this.device.queue.writeBuffer(verticesBuffer, 0, verticesView.arrayBuffer);
        this.device.queue.writeBuffer(materialsBuffer, 0, materialsView.arrayBuffer);

        const imageBuffer = this.device.createBuffer({
          size: Float32Array.BYTES_PER_ELEMENT * 4 * context.canvas.width * context.canvas.height,
          usage: GPUBufferUsage.STORAGE,
        });
    
        this.buffers.viewProjectionMatrixBuffer = this.device.createBuffer({
          size: Float32Array.BYTES_PER_ELEMENT * 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    
        const pipelineDescriptor = {
          compute: { module: shaderModule },
          layout: 'auto' as const
        };
        this.pipeline = this.device.createComputePipeline(pipelineDescriptor);
    
        this.bindGroups[0] = this.device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.buffers.uniformBuffer }},
            { binding: 1, resource: { buffer: this.buffers.viewProjectionMatrixBuffer }},
          ],
        });
        this.bindGroups[1] = this.device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(1),
          entries: [
            { binding: 0, resource: { buffer: triangleBuffer }},
            { binding: 1, resource: { buffer: verticesBuffer }},
            { binding: 2, resource: { buffer: materialsBuffer }},
          ],
        });
        this.bindGroups[1].label = 'geometry';
        this.bindGroups[3] = this.device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(3),
          entries: [
            { binding: 0, resource: { buffer: imageBuffer }},
          ],
        });
    }

    execute(frameNum: number): void {
        const texture = this.context.getCurrentTexture();

        this.device.queue.writeBuffer(this.buffers.viewProjectionMatrixBuffer, 0, new Float32Array(this.camera.inverseViewMatrix));

        this.bindGroups[2] = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(2),
        entries: [
            { binding: 0, resource: texture.createView() },
        ],
        });
        this.device.queue.writeBuffer(this.buffers.uniformBuffer, 0, new Uint32Array([frameNum]), 0, 1);    

        const commandEncoder = this.device.createCommandEncoder();
        
        const passEncoder = commandEncoder.beginComputePass();

        passEncoder.setPipeline(this.pipeline);
        Object.entries(this.bindGroups).forEach(([key, value]) => {
            passEncoder.setBindGroup(Number(key), value);
        });
        passEncoder.dispatchWorkgroups(texture.width, texture.height);

        // End the render pass
        passEncoder.end();

        // 10: End frame by passing array of command buffers to command queue for execution
        this.device.queue.submit([commandEncoder.finish()]);
    }
}

export class RasterPipeline extends Pipeline {
    private device: GPUDevice;
    private context!: GPUCanvasContext;
    private pipeline!: GPURenderPipeline;
    private bindGroups: { [key: number]: GPUBindGroup } = {};
    private buffers: { [key: string]: GPUBuffer } = {};
    private scene: Scene;
    camera: Camera;
    private indexFormat!: GPUIndexFormat;
    private numElements!: number;
    private depthTexture!: GPUTexture;

    constructor(device: GPUDevice, scene: Scene, camera: Camera) {
        super();
        this.device = device;
        this.scene = scene;
        this.camera = camera;
    }

    init(context: GPUCanvasContext): void {
        this.context = context;
        const shaderModule = this.device.createShaderModule({
            code: rasterShader
        });
            
        this.buffers.viewProjectionMatrixBuffer = this.device.createBuffer({
            size: Float32Array.BYTES_PER_ELEMENT * 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        const faces = this.scene.getFaces();
        const vertices = this.scene.getVertices();
        const materials = this.scene.getMaterials();

        const colors = vertices.map(() => [1, 0, 0, 1.0]);
        faces.forEach(f => {
            const mat = materials[f.materialIdx];
            colors[f.a] = [...mat.surfaceColor, 1.0];
            colors[f.b] = [...mat.surfaceColor, 1.0];
            colors[f.c] = [...mat.surfaceColor, 1.0];
        })

        const normals = vertices.map(() => [0, 0, 0]);
        const uvs = vertices.map(() => [-1, -1]);
        faces.forEach(f => {
            const a = vertices[f.a];
            const b = vertices[f.b];
            const c = vertices[f.c];
            const normal = vec3.create();
            vec3.cross(normal, vec3.subtract(vec3.create(), b, a), vec3.subtract(vec3.create(), c, a));
            vec3.normalize(normal, normal);
            normals[f.a] = [normal[0], normal[1], normal[2]];
            normals[f.b] = [normal[0], normal[1], normal[2]];
            normals[f.c] = [normal[0], normal[1], normal[2]];
            uvs[f.a] = f.uva || [-1, -1];
            uvs[f.b] = f.uvb || [-1, -1];
            uvs[f.c] = f.uvc || [-1, -1];
        })

    
        const bi = createBuffersAndAttributesFromArrays(this.device,
            {
                position: vertices.map(v => [v[0], v[1], v[2]]).flat(),
                color: colors.flat(),
                normal: normals.flat(),
                indices: faces.map(f => [f.a, f.b, f.c]).flat(),
                texcoord: uvs.flat()
            }
        )

        this.buffers.vertexBuffer = bi.buffers[0];
        this.buffers.indexBuffer = bi.indexBuffer!;
        this.indexFormat = bi.indexFormat!;
        this.numElements = bi.numElements;

        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
              module: shaderModule,
              entryPoint: 'vertex_main',
              buffers: bi.bufferLayouts,
            },
            fragment: {
              module: shaderModule,
              entryPoint: 'fragment_main',
              targets: [
                {format: navigator.gpu.getPreferredCanvasFormat()},
              ],
            },
            primitive: {
              topology: 'triangle-list',
              cullMode: 'back',
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });

        this.bindGroups[0] = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.buffers.viewProjectionMatrixBuffer }},
            ],
        });
    }

    execute(): void {
        const viewProjectionMatrix = mat4.create()
        mat4.multiply(viewProjectionMatrix, this.camera.projectionMatrix, this.camera.viewMatrix);

        this.device.queue.writeBuffer(this.buffers.viewProjectionMatrixBuffer, 0, new Float32Array(viewProjectionMatrix));

        if (!this.depthTexture) {
            this.depthTexture = this.device.createTexture({
                size: [this.context.canvas.width, this.context.canvas.height],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
              });
        }
        const renderPassDescriptor = {
            colorAttachments: [
              {
                view: this.context.getCurrentTexture().createView(),
                clearValue: [ 0.2, 0.2, 0.2, 1.0 ],
                loadOp: 'clear' as const,
                storeOp: 'store' as const,
              },
            ],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1,
                depthLoadOp: 'clear' as const,
                depthStoreOp: 'store' as const,
            },
        };
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroups[0]);
        passEncoder.setVertexBuffer(0, this.buffers.vertexBuffer);
        passEncoder.setIndexBuffer(this.buffers.indexBuffer, this.indexFormat);
        passEncoder.drawIndexed(this.numElements);
        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }
}
