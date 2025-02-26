'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { PMREMGenerator } from 'three';
import { CarControls } from '../lib/CarControls.js';

import {
  createThirdwebClient,
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
  defineChain,
} from 'thirdweb';
import { useAddress } from "@thirdweb-dev/react";

export default function CarAnimation() {
  // Refs and state
  const containerRef = useRef(null);
  const requestRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());

  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const statsRef = useRef(null);
  const carModelRef = useRef(null);
  const envMapRef = useRef(null);
  const carControlsRef = useRef(null);

  const [riskPercentage, setRiskPercentage] = useState(0);
  const [engineRpm, setEngineRpm] = useState(0);
  const [gear, setGear] = useState(1);
  const [throttlePos, setThrottlePos] = useState(0);
  const [gForces, setGForces] = useState({ Gx: 0, Gy: 0, Gz: 0 });

  const engineRpmRef = useRef(engineRpm);
  const throttlePosRef = useRef(throttlePos);
  const gForcesRef = useRef(gForces);

  useEffect(() => {
    engineRpmRef.current = engineRpm;
  }, [engineRpm]);

  useEffect(() => {
    throttlePosRef.current = throttlePos;
  }, [throttlePos]);

  useEffect(() => {
    gForcesRef.current = gForces;
  }, [gForces]);

  const address = useAddress();
  console.log("Connected address:", address);

  // Setup Thirdweb (if needed)
  useEffect(() => {
    async function initThirdweb() {
      try {
        const client = createThirdwebClient({
          clientId: 'ee409b501b4b5ebbdd046e4f90f9f4ce',
        });
        const chain = defineChain({
          id: 1,
          rpc: 'https://rpc.sepolia-api.lisk.com/',
          chainId: 4202,
          nativeCurrency: {
            name: 'Lisk Sepolia Testnet',
            symbol: 'ETH',
            decimals: 18,
          },
        });
        const contract = getContract({
          client,
          chain: defineChain(4202),
          address: '0x936F59DA9c4E8961E128771FCCF4c015A9256911',
        });
        console.log('Active account address:', address);
      } catch (err) {
        console.error('Error setting up Thirdweb or contract:', err);
      }
    }
    initThirdweb();
  }, [address]);

  // Main Three.js setup and animation
  useEffect(() => {
    if (!containerRef.current) return;

    let camera, scene, renderer, stats;
    let carModel = null;
    let envMap = null;

    // Create car controls
    const carControls = new CarControls();
    carControls.turningRadius = 75;

    // Engine simulation class
    class EngineSimulation {
      constructor() {
        this.idleRPM = 800;
        this.maxRPM = 8500;
        this.redlineRPM = 8000;
        this.currentRPM = this.idleRPM;
        this.throttlePosition = 0;
        this.throttleMap = {
          initial: 0.25,
          mid: 0.5,
          top: 0.75
        };
        this.throttleInertia = 0.15;
        this.rpmThrottleInfluence = {
          low: 1.2,
          mid: 1.0,
          high: 0.8
        };
        this.engineInertia = 0.2;
        this.engineBraking = 0.1;
        this.gearRatios = [3.82, 2.15, 1.56, 1.21, 0.97, 0.85];
        this.currentGear = 1;
        this.finalDriveRatio = 3.44;
        this.clutchEngaged = false;
        this.powerBand = {
          start: 2500,
          peak: 6800,
          end: 8000
        };
        this.engineTemp = 20;
        this.optimalTemp = 90;
        this.maxTemp = 120;
      }
      getThrottleResponse(rpm, throttleInput) {
        let responseRate;
        if (throttleInput <= 0.2) {
          responseRate = this.throttleMap.initial;
        } else if (throttleInput <= 0.8) {
          responseRate = this.throttleMap.mid;
        } else {
          responseRate = this.throttleMap.top;
        }
        let rpmMultiplier;
        if (rpm < 3000) {
          rpmMultiplier = this.rpmThrottleInfluence.low;
        } else if (rpm < 6000) {
          rpmMultiplier = this.rpmThrottleInfluence.mid;
        } else {
          rpmMultiplier = this.rpmThrottleInfluence.high;
        }
        const tempInfluence = this.getTemperatureInfluence();
        return responseRate * rpmMultiplier * tempInfluence;
      }
      getTemperatureInfluence() {
        if (this.engineTemp < this.optimalTemp) {
          return 0.8 + (0.2 * (this.engineTemp / this.optimalTemp));
        } else if (this.engineTemp > this.maxTemp) {
          return Math.max(0.6, 1 - ((this.engineTemp - this.maxTemp) / 50));
        }
        return 1.0;
      }
      updateTemperature(delta, throttlePosition) {
        const heatGeneration = (this.currentRPM / this.maxRPM) * throttlePosition * 10;
        const cooling = 5 * delta;
        this.engineTemp += (heatGeneration - cooling) * delta;
        this.engineTemp = Math.max(20, Math.min(this.engineTemp, 130));
      }
       updateEngine(delta, speed, throttleInput) {
  // Log input values
  console.log("updateEngine input:", { delta, speed, throttleInput });

  // Ensure delta is not too small
  let dt = delta < 0.001 ? 0.016 : delta;
  
  // Use the absolute throttle for response calculation
  const absThrottle = Math.abs(throttleInput);
  const throttleResponse = this.getThrottleResponse(this.currentRPM, absThrottle);
  
  // Clamp throttleInput between 0 and 1 (if negative values are not desired)
  const targetThrottle = Math.max(0, Math.min(1, throttleInput));
  
  // Log computed intermediate values
  console.log("Computed values:", { 
    absThrottle, 
    throttleResponse, 
    targetThrottle, 
    previousThrottle: this.throttlePosition 
  });
  
  // Update throttlePosition with smoothing
  this.throttlePosition += (targetThrottle - this.throttlePosition) * throttleResponse * dt;

  this.throttlePosition = Math.max(0, Math.min(1, this.throttlePosition));

  
  // Check for NaN
  if (isNaN(this.throttlePosition)) {
    console.error('Throttle position is NaN:', {
      targetThrottle,
      throttleResponse,
      dt,
      previousThrottle: this.throttlePosition
    });
    this.throttlePosition = 0; // Reset to 0 if NaN is detected
  }
  
  // (Update engine temperature, RPM, etc.)
  this.updateTemperature(dt, this.throttlePosition);
  
  let targetRPM = this.idleRPM;
  if (speed > 0.1 || (this.throttlePosition > 0 && !this.clutchEngaged)) {
    if (speed > 0.1) {
      const wheelRPM = (speed * 60) / (2 * Math.PI * 0.33);
      const currentGearRatio = this.gearRatios[this.currentGear - 1];
      const baseRPM = wheelRPM * currentGearRatio * this.finalDriveRatio;
      targetRPM = Math.max(baseRPM, this.idleRPM);
      if (this.throttlePosition > 0) {
        const tempInfluence = this.getTemperatureInfluence();
        const rpmEfficiency = this.getRPMEfficiency();
        targetRPM += (this.maxRPM - targetRPM) * this.throttlePosition * tempInfluence * rpmEfficiency;
      }
    } else {
      targetRPM = this.idleRPM + (this.maxRPM - this.idleRPM) * this.throttlePosition * this.getTemperatureInfluence();
    }
  } else {
    targetRPM = this.idleRPM;
  }
  
  targetRPM = Math.min(targetRPM, this.maxRPM);
  const rpmDifference = targetRPM - this.currentRPM;
  const inertiaFactor = this.throttlePosition > 0 ? this.engineInertia : this.engineInertia + this.engineBraking;
  
  this.currentRPM += rpmDifference * (1 - inertiaFactor) * dt;

  this.currentRPM = Math.max(this.currentRPM, this.idleRPM);
  
  if (speed < 0.1 && this.currentRPM < this.idleRPM + 200) {
    const tempFactor = Math.max(0.5, 1 - (this.engineTemp / this.optimalTemp));
    this.currentRPM += (Math.random() - 0.5) * 20 * tempFactor;
  }
  
  const powerOutput = this.calculatePowerOutput();
  
  // Log final computed values before returning
  console.log("Engine state:", {
    currentRPM: this.currentRPM,
    throttlePosition: this.throttlePosition,
    powerOutput,
    currentGear: this.currentGear,
    engineTemp: this.engineTemp
  });
  
  return {
    rpm: Math.round(this.currentRPM),
    throttle: this.throttlePosition,
    power: powerOutput,
    gear: this.currentGear,
    temperature: Math.round(this.engineTemp)
  };
}

      getRPMEfficiency() {
        if (this.currentRPM < this.powerBand.start) {
          return 0.7 + (0.3 * (this.currentRPM / this.powerBand.start));
        } else if (this.currentRPM <= this.powerBand.peak) {
          return 1.0;
        } else {
          return 1.0 - (0.3 * ((this.currentRPM - this.powerBand.peak) / (this.maxRPM - this.powerBand.peak)));
        }
      }
      calculatePowerOutput() {
        let powerOutput = 0;
        if (this.currentRPM >= this.powerBand.start) {
          if (this.currentRPM <= this.powerBand.peak) {
            powerOutput = (this.currentRPM - this.powerBand.start) / (this.powerBand.peak - this.powerBand.start);
          } else {
            powerOutput = 1 - (this.currentRPM - this.powerBand.peak) / (this.powerBand.end - this.powerBand.peak);
          }
          powerOutput = Math.max(0, Math.min(1, powerOutput));
          powerOutput *= this.getTemperatureInfluence() * this.throttlePosition;
        }
        return powerOutput;
      }
      updateGear(speed) {
        const prevGear = this.currentGear;
        if (speed < 5 && this.currentGear > 1) {
          this.currentGear = 1;
          this.clutchEngaged = true;
        } else if (this.currentRPM > 7000 && this.currentGear < 6) {
          this.currentGear++;
          this.clutchEngaged = true;
        } else if (this.currentRPM < 2000 && this.currentGear > 1) {
          this.currentGear--;
          this.clutchEngaged = true;
        } else {
          this.clutchEngaged = false;
        }
        if (prevGear !== this.currentGear) {
          this.currentRPM *= 0.85;
        }
      }
    }

    const engineSim = new EngineSimulation();

    let currentGForces = { Gx: 0, Gy: 0, Gz: 0 };

    // Set up camera and scene
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(3.25, 2.0, -5);
    camera.lookAt(0, 0.5, 0);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd7cbb1, 1, 80);

    // Create lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);

    stats = new Stats();
    containerRef.current.appendChild(stats.dom);

    cameraRef.current = camera;
    sceneRef.current = scene;
    rendererRef.current = renderer;
    statsRef.current = stats;
    carControlsRef.current = carControls;

    // Load environment (skybox and environment map)
    const skyboxLoader = new THREE.CubeTextureLoader().setPath('textures/cube/skyboxsun25deg/');
    const skyboxUrls = ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'];
    skyboxLoader.load(skyboxUrls, (cubeTexture) => {
      scene.background = cubeTexture;
      const pmremGenerator = new PMREMGenerator(renderer);
      pmremGenerator.compileCubemapShader();
      const envMap = pmremGenerator.fromCubemap(cubeTexture).texture;
      pmremGenerator.dispose();
      envMapRef.current = envMap;
      scene.environment = envMap;  // for physically-based materials

      initCar();
    });

    // Ground and grid
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.15, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.renderOrder = 1;
    scene.add(ground);

    const grid = new THREE.GridHelper(400, 40, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.depthWrite = false;
    grid.material.transparent = true;
    scene.add(grid);

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onWindowResize, false);

    // Car loader (GLTF + DRACO)
    function initCar() {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
      const gltfLoader = new GLTFLoader();
      gltfLoader.setDRACOLoader(dracoLoader);
      gltfLoader.load('/models/ferrari.glb', (gltf) => {
        carModel = gltf.scene.children[0];
        carModelRef.current = carModel;
        carControls.setModel(carModel);
        carModel.traverse((child) => {
          if (child.isMesh) {
            child.material.envMap = envMap;
          }
        });
        const texture = new THREE.TextureLoader().load('/models/ferrari_ao.png');
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ map: texture, opacity: 0.8, transparent: true })
        );
        shadow.renderOrder = 2;
        carModel.add(shadow);
        scene.add(carModel);
      });
    }

    // Follow camera logic setup
    const cameraTarget = new THREE.Vector3();

    function calculateGForces(accX, accY, accZ) {
      const gravity = 9.81;
      return {
        Gx: (accX || 0) / gravity,
        Gy: (accY || 0) / gravity,
        Gz: (accZ || 0) / gravity,
      };
    }

    function update() {
      let delta = clockRef.current.getDelta();
      if (delta < 0.001) delta = 0.016;
      if (carModel) {
        carControls.update(delta / 3);
        const speed = carControls.speed || 0;
        const throttleInput = carControls.moveForward ? 1 : carControls.moveBackward ? -1 : 0;
        const acceleration = carControls.getAcceleration();

        const engineState = engineSim.updateEngine(delta, Math.abs(speed), Math.abs(throttleInput));
        engineSim.updateGear(Math.abs(speed));

        setEngineRpm(engineState.rpm);
        setThrottlePos(engineState.throttle);
        setGear(engineState.gear);

        const forces = calculateGForces(acceleration.x, acceleration.y, acceleration.z);
        setGForces({
          Gx: +forces.Gx.toFixed(2),
          Gy: +forces.Gy.toFixed(2),
          Gz: +forces.Gz.toFixed(2),
        });

        if (carModel.position.length() > 200) {
          carModel.position.set(0, 0, 0);
          carControls.speed = 0;
          engineSim.currentRPM = engineSim.idleRPM;
        }

        // Follow camera logic: get the car's position and set camera behind & above it
        carModel.getWorldPosition(cameraTarget);
        cameraTarget.y += 2;  // Raise the target a bit
        cameraTarget.z += 5;  // Pull the target back
        camera.position.lerp(cameraTarget, 0.1);
        camera.lookAt(carModel.position);
      }
      stats.update();
    }

    function animate() {
      requestRef.current = requestAnimationFrame(animate);
      update();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', onWindowResize);
      if (renderer && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      stats.dom.remove();
    };
  }, []);
  useEffect(() => {
    const API_URL = 'https://carriskinsurancemodel-production.up.railway.app/riskmodel/predict/';
    
    function formatValue(num) {
      // Ensure num is a valid number before formatting
      return isNaN(num) ? 0 : parseFloat(parseFloat(num).toFixed(2));
    }
  
    function gatherAndSendData() {
      const data = {
        engine_rpm: engineRpmRef.current,
        g_x: formatValue(gForcesRef.current.Gx),
        g_y: formatValue(gForcesRef.current.Gy),
        g_z: formatValue(gForcesRef.current.Gz),
        throttle_position: formatValue(throttlePosRef.current * 100),
      };
      console.log("Sending risk data:", data);
      sendDataToAPI(data);
    }
  
    async function sendDataToAPI(data) {
      console.log("Calling API at:", API_URL);
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        console.log("API response status:", response.status);
        const result = await response.json();
        console.log("Risk API result:", result);
        const risk = result?.risk ? parseFloat(result.risk.toFixed(2)) : 0;
        setRiskPercentage(risk);
      } catch (error) {
        console.error('Error sending data:', error);
      }
    }
  
    console.log("Setting up risk data interval.");
    const intervalId = setInterval(gatherAndSendData, 5000);
    return () => {
      clearInterval(intervalId);
      console.log("Cleared risk data interval.");
    };
  }, []);
  

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', fontFamily: 'Arial, sans-serif' }}>
        <div>Engine RPM: {engineRpm} | Gear: {gear}</div>
        <div>G-forces: X={gForces.Gx}, Y={gForces.Gy}, Z={gForces.Gz}</div>
        <div>Throttle: {(throttlePos * 100).toFixed(1)}%</div>
        <div>Risk: {riskPercentage}%</div>
      </div>
    </div>
  );
}
