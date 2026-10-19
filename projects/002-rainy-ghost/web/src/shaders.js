import { Color, Matrix4, Vector3, Vector4 } from 'three';

// Reflector supplies the mirrored scene; this shader supplies the moving water.
export function waterShader() {
  return {
    name: 'Rainwater',
    uniforms: {
      color: { value: new Color('#0b1925') },
      tDiffuse: { value: null },
      textureMatrix: { value: new Matrix4() },
      uTime: { value: 0 },
      uRain: { value: 0.72 },
      uRainDetail: { value: 2 },
      uLamp: { value: new Vector3(1.8, 1.5, 0.3) },
      uLight: { value: 1 },
      uRipples: { value: Array.from({ length: 16 }, () => new Vector4(0, 0, -100, 0)) },
    },
    vertexShader: /* glsl */`
      uniform mat4 textureMatrix;
      varying vec4 vMirror;
      varying vec3 vWorld;
      void main() {
        vMirror = textureMatrix * vec4(position, 1.0);
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform vec3 color;
      uniform float uTime;
      uniform float uRain;
      uniform float uRainDetail;
      uniform vec3 uLamp;
      uniform float uLight;
      uniform vec4 uRipples[16];
      varying vec4 vMirror;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }
      float heightAt(vec2 p) {
        float t = uTime;
        float h = sin(p.x*2.1+t*.7)*.035 + sin(p.y*3.7-t*.9+p.x)*.024;
        h += noise(p*6.0+vec2(t*.22,-t*.3))*.034;
        h += sin(p.x*22.0+p.y*17.0+t*2.0)*.003;
        // A sparse, animated grid approximates many rain impacts without simulating fluid.
        vec2 cell = floor(p*1.6);
        for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
          if(uRainDetail<.5 && (x!=0 || y!=0)) continue;
          if(uRainDetail<1.5 && x!=0 && y!=0) continue;
          vec2 c = cell+vec2(float(x),float(y));
          float rnd = hash(c);
          vec2 center = (c+vec2(rnd,hash(c+13.7)))/1.6;
          float age = fract(t*.48+rnd*8.0);
          float d = length(p-center);
          float ring = sin((d-age*.85)*52.0)*exp(-abs(d-age*.85)*24.0);
          h += ring*(1.0-age)*.009*uRain;
        }
        for(int i=0;i<16;i++) {
          vec4 r = uRipples[i]; float age = t-r.z;
          if(age>0.0 && age<5.0) {
            float d = length(p-r.xy);
            float drip = 1.0-step(.5,r.w);
            float speed = mix(.95,.4,drip);
            float frequency = mix(16.0,32.0,drip);
            float width = mix(2.0,6.0,drip);
            float decay = mix(.8,2.2,drip);
            float phaseSpeed = mix(7.0,frequency*speed,drip);
            h += sin(d*frequency-age*phaseSpeed)*exp(-pow((d-age*speed)*width,2.0))*exp(-age*decay)*.08*r.w;
          }
        }
        return h;
      }
      void main() {
        vec2 p = vWorld.xz;
        float h = heightAt(p);
        float dx = (heightAt(p+vec2(.025,0))-h)/.025;
        float dz = (heightAt(p+vec2(0,.025))-h)/.025;
        vec3 normal = normalize(vec3(-dx,1.0,-dz));
        vec3 viewDir = normalize(cameraPosition-vWorld);
        float fresnel = .13+.87*pow(1.0-max(dot(normal,viewDir),0.0),3.0);
        vec2 uv = vMirror.xy/vMirror.w;
        vec2 distortion = normal.xz*.025/max(.8,length(cameraPosition-vWorld)*.12);
        vec3 reflected = texture2D(tDiffuse,clamp(uv+distortion,.001,.999)).rgb;
        vec3 water = mix(color*.35,reflected,.38+fresnel*.54);
        vec3 lightDir = normalize(uLamp-vWorld);
        float spec = pow(max(dot(normal,normalize(viewDir+lightDir)),0.0),95.0);
        float attenuation = 1.0/(1.0+dot(uLamp-vWorld,uLamp-vWorld)*.45);
        water += vec3(1.0,.57,.23)*spec*attenuation*2.8*uLight;
        water += vec3(.012,.021,.03)*pow(max(dot(normal,normalize(vec3(-.5,1.0,-.7))),0.0),12.0);
        float fog = 1.0-exp(-length(cameraPosition-vWorld)*.024);
        water = mix(water,vec3(.00212,.0056,.0116),fog);
        gl_FragColor = vec4(water,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  };
}

export const rainVertex = /* glsl */`
  attribute vec4 aSeed;
  attribute float aStopHeight;
  uniform float uTime;
  uniform float uRain;
  varying float vAlpha;
  varying vec3 vWorld;
  void main() {
    float fall = mod(aSeed.y-uTime*(5.0+aSeed.w*5.0),13.0);
    vec3 p = vec3(aSeed.x+sin(uTime*.3)*fall*.035, fall, aSeed.z);
    p += position*vec3(1.0,.55+aSeed.w*.6,1.0);
    vWorld = p;
    vAlpha = step(aSeed.w, uRain)*step(aStopHeight,fall)*(.16+aSeed.w*.21);
    gl_Position = projectionMatrix*viewMatrix*vec4(p,1.0);
  }
`;
export const rainFragment = /* glsl */`
  uniform vec3 uLamp;
  uniform float uLight;
  varying float vAlpha;
  varying vec3 vWorld;
  void main() {
    float nearLamp = exp(-length(vWorld-uLamp)*1.1)*uLight;
    vec3 c = mix(vec3(.32,.46,.59),vec3(1.0,.76,.42),nearLamp);
    float depthFade = exp(-length(vWorld-cameraPosition)*.045);
    gl_FragColor = vec4(c,vAlpha*depthFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
