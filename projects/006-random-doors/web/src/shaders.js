import * as THREE from 'three';

const noise = `
float hash21(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise21(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) { return noise21(p)*0.55+noise21(p*2.03)*0.28+noise21(p*4.11)*0.12; }
`;

const skyLight = `
vec3 skyColor(vec3 direction) {
  vec3 d=normalize(direction);
  float h=max(d.y,0.0);
  vec3 color=mix(uHorizon,uTop,clamp(pow(h,0.5)*1.42,0.0,1.0));
  vec2 uv=vec2(atan(d.x,-d.z)*1.55,h*5.0)+vec2(uTime*0.006,0.0);
  float cloud=smoothstep(0.25,0.68,fbm(uv*vec2(1.2,1.9)));
  vec3 cloudColor=mix(uTop*0.55+uHorizon*0.08,uHorizon*0.76,exp(-h*7.0));
  color=mix(color,cloudColor,cloud*0.72*smoothstep(0.008,0.14,h));
  float halo=pow(max(dot(d,normalize(vec3(-0.55,0.14,-1.0))),0.0),22.0);
  color+=vec3(0.16,0.075,0.024)*halo*(1.0-uNight)*(0.5+0.5*(1.0-cloud));
  if(uNight>0.5 && h>0.12) {
    vec2 uvStars=d.xz/(h+0.02)*150.0;
    float star=step(0.998,hash21(floor(uvStars)))*pow(max(0.0,1.0-length(fract(uvStars)-0.5)*2.0),3.0);
    color+=star*smoothstep(0.12,0.65,h)*(1.0-cloud)*0.45;
  }
  return color;
}
`;

const waves = `
float waveHeight(vec2 p) {
  return sin(dot(p,vec2(0.91,0.41))*0.24+uTime*0.72)*0.085
    +sin(dot(p,vec2(-0.32,0.95))*0.46-uTime*0.93)*0.045
    +sin(dot(p,vec2(0.6,-0.8))*1.15+uTime*1.24)*0.022;
}
vec2 waveGradient(vec2 p) {
  return cos(dot(p,vec2(0.91,0.41))*0.24+uTime*0.72)*0.085*0.24*vec2(0.91,0.41)
    +cos(dot(p,vec2(-0.32,0.95))*0.46-uTime*0.93)*0.045*0.46*vec2(-0.32,0.95)
    +cos(dot(p,vec2(0.6,-0.8))*1.15+uTime*1.24)*0.022*1.15*vec2(0.6,-0.8);
}
`;

export function createSky(weather) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uTop: { value: new THREE.Color(weather.top) }, uHorizon: { value: new THREE.Color(weather.horizon) }, uNight: { value: weather.id === 'night-rain' ? 1 : 0 } },
    vertexShader: `varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform float uTime, uNight; uniform vec3 uTop,uHorizon; varying vec3 vWorld;
      ${noise}
      ${skyLight}
      void main() {
        vec3 color=skyColor(vWorld-cameraPosition);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(430, 36, 20), material);
  sky.renderOrder = -10;
  return sky;
}

export function createSea(weather) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uColor: { value: new THREE.Color(weather.sea) }, uHorizon: { value: new THREE.Color(weather.horizon) },
      uTop: { value: new THREE.Color(weather.top) }, uNight: { value: weather.id === 'night-rain' ? 1 : 0 }, uRain: { value: weather.rain },
      uFog: { value: new THREE.Color(weather.fog) }, uFogDensity: { value: weather.fogDensity },
      uBoat: { value: new THREE.Vector3(0, 0, -70) }, uBoatLight: { value: 0 }, uWind: { value: weather.wind },
    },
    vertexShader: `
      uniform float uTime, uWind; varying vec3 vWorld; varying float vWave;
      ${waves}
      void main() {
        vWorld=(modelMatrix*vec4(position,1.0)).xyz;
        vWave=waveHeight(vWorld.xz); vWorld.y+=vWave*(0.8+uWind);
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);
      }`,
    fragmentShader: `
      uniform float uTime,uFogDensity,uBoatLight,uWind,uNight,uRain; uniform vec3 uColor,uTop,uHorizon,uFog,uBoat;
      varying vec3 vWorld; varying float vWave;
      ${noise}
      ${skyLight}
      ${waves}
      void main() {
        vec3 view=normalize(cameraPosition-vWorld);
        vec2 gradient=waveGradient(vWorld.xz)*(0.8+uWind);
        float small=noise21(vWorld.xz*2.1+vec2(uTime*0.08,-uTime*0.13));
        float fine=noise21(vWorld.xz*4.3-vec2(uTime*0.15,uTime*0.06));
        vec3 normal=normalize(vec3(-gradient.x+(small-0.5)*0.025,1.0,-gradient.y+(fine-0.5)*0.025));
        float fresnel=pow(1.0-max(dot(normal,view),0.0),4.0);
        vec3 reflection=skyColor(reflect(-view,normal));
        vec3 color=mix(uColor*0.23,reflection*0.72,0.16+fresnel*0.76);
        float shine=pow(max(dot(reflect(-normalize(vec3(-0.55,0.14,-1.0)),normal),view),0.0),100.0);
        color+=mix(vec3(0.28,0.18,0.075),vec3(0.045,0.075,0.1),uNight)*shine;
        float crest=smoothstep(0.1,0.14,vWave)*smoothstep(0.64,0.85,fine);
        color+=vec3(0.025,0.04,0.037)*crest;
        vec2 rainUV=vWorld.xz*1.7;
        float age=fract(uTime*1.1+hash21(floor(rainUV)));
        float ring=exp(-abs(length(fract(rainUV)-0.5)-age*0.28)*75.0)*(1.0-age);
        color+=vec3(0.015,0.023,0.023)*ring*uRain*exp(-length(vWorld-cameraPosition)*0.065);
        float zDistance=vWorld.z-uBoat.z;
        float streak=exp(-pow((vWorld.x-uBoat.x)/(0.45+max(zDistance,0.0)*0.025),2.0));
        streak*=smoothstep(0.0,1.0,zDistance)*exp(-max(zDistance,0.0)*0.08);
        streak*=0.35+0.65*pow(sin(vWorld.z*14.0+small*12.0+uTime*2.0)*0.5+0.5,3.0);
        color+=vec3(1.5,0.68,0.21)*streak*uBoatLight;
        float fog=1.0-exp(-length(vWorld-cameraPosition)*uFogDensity);
        color=mix(color,uFog*0.71,fog);
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.PlaneGeometry(420, 340, 230, 180);
  geometry.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(geometry, material);
  sea.position.set(0, -0.34, -140);
  return sea;
}

export function setWorldWeather(sky, sea, weather) {
  sky.material.uniforms.uTop.value.set(weather.top);
  sky.material.uniforms.uHorizon.value.set(weather.horizon);
  sky.material.uniforms.uNight.value = weather.id === 'night-rain' ? 1 : 0;
  const u = sea.material.uniforms;
  u.uColor.value.set(weather.sea); u.uHorizon.value.set(weather.horizon); u.uFog.value.set(weather.fog);
  u.uTop.value.set(weather.top); u.uNight.value = weather.id === 'night-rain' ? 1 : 0; u.uRain.value = weather.rain;
  u.uFogDensity.value = weather.fogDensity; u.uWind.value = weather.wind;
}
