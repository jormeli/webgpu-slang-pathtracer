struct VertexOut {
    @builtin(position) position : vec4f,
    @location(0) color : vec4f,
    @location(1) normal : vec3f,
    @location(2) texCoord : vec2f
}

@group(0) @binding(0) var<uniform> u_viewProjectionMatrix : mat4x4f;

@vertex
fn vertex_main(@location(0) position: vec4f, @location(1) color: vec4f, @location(2) normal: vec3f, @location(3) texCoord: vec2f) -> VertexOut {
    return VertexOut(
        u_viewProjectionMatrix * position,
        color,
        (u_viewProjectionMatrix * vec4f(normal, 0)).xyz,
        texCoord
    );
}

@fragment
fn fragment_main(input: VertexOut) -> @location(0) vec4f {
    let color = abs(dot(-input.normal.xyz, vec3f(0, 0, 1))) * input.color * 0.8 + input.color * 0.2;
    return vec4f(color.rgb, 1);
}
