struct Ray {
  origin : vec3f,
  direction : vec3f
}

struct Sphere {
  center : vec3f,
  radius : f32,
  color : vec3f
}

struct Triangle {
  a : u32,
  b : u32,
  c : u32,
  materialIdx : u32
}

struct Hit {
    t : f32,
    position : vec3f,
    normal : vec3f,
    valid : bool,
    materialIdx : u32,
}

struct PointLight {
  position : vec3f,
  color : vec3f
}
