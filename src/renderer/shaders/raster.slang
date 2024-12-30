struct Vertex
{
    float4 position;
    float4 color;
    float3 normal;
    float2 texCoord;
}

struct Camera
{
    float4x4 mvp;
}

ConstantBuffer<Camera> camera;
struct VOut
{
    float4 position : SV_Position;
    float3 normal;
    float4 color;
    float2 texCoord;
}

[shader("vertex")]
VOut vertexMain(Vertex input)
{
    VOut output;
    output.position = mul(camera.mvp, input.position);
    output.normal = mul(camera.mvp, float4(input.normal, 0.0)).xyz;
    output.texCoord = input.texCoord;
    output.color = input.color;
    return output;
}

[shader("fragment")]
float4 fragmentMain(VOut input) : SV_Target
{
    let color = (dot(-input.normal.xyz, float3(0, 0, 1)) * 0.5 + 0.5) * input.color;
    return color;
}
