"use client";

import { useEffect, useRef } from "react";
import { useDocumentVisible, usePowerProfile, usePrefersReducedMotion } from "@/lib/appearance";
import type { SceneVariant } from "@/lib/wmo";

const RAIN_SCENES: SceneVariant[] = ["drizzle", "rain", "heavy-rain", "thunderstorm"];
const SNOW_SCENES: SceneVariant[] = ["snow"];
const CLOUD_SCENES: SceneVariant[] = ["partly-day", "partly-night", "overcast", "fog"];
const NIGHT_SCENES: SceneVariant[] = ["clear-night", "partly-night"];

const isRainScene = (scene: SceneVariant) => RAIN_SCENES.includes(scene);
const isSnowScene = (scene: SceneVariant) => SNOW_SCENES.includes(scene);
const isCloudScene = (scene: SceneVariant) => CLOUD_SCENES.includes(scene);
const isNightScene = (scene: SceneVariant) => NIGHT_SCENES.includes(scene);

type Cloud = { x: number; y: number; scale: number; alpha: number; depth: number; speed: number };
type Drop = { x: number; y: number; length: number; speed: number; alpha: number };
type Flake = { x: number; y: number; radius: number; speed: number; phase: number };
type Star = { x: number; y: number; radius: number; phase: number };

function cloudSprite(): HTMLCanvasElement {
  const width = 256;
  const height = 128;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const puffs: Array<[number, number, number, number]> = [
    [0.5, 0.58, 0.3, 0.95],
    [0.31, 0.6, 0.22, 0.85],
    [0.69, 0.6, 0.24, 0.86],
    [0.16, 0.68, 0.16, 0.62],
    [0.84, 0.68, 0.17, 0.64],
    [0.43, 0.44, 0.2, 0.72],
    [0.62, 0.46, 0.18, 0.68],
  ];
  for (const [x, y, radius, alpha] of puffs) {
    const cx = x * width;
    const cy = y * height;
    const r = radius * height;
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, r);
    gradient.addColorStop(0, `rgba(232, 241, 255, ${alpha})`);
    gradient.addColorStop(0.55, `rgba(206, 222, 244, ${alpha * 0.5})`);
    gradient.addColorStop(1, "rgba(186, 206, 236, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.fill();
  }
  return canvas;
}

export function WeatherStage({
  scene,
  cloudCover,
  windSpeed,
  windDirection,
  intensity = 0.4,
  daylightProgress = null,
  className = "",
}: {
  scene: SceneVariant;
  cloudCover: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  intensity?: number;
  daylightProgress?: number | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const reduced = usePrefersReducedMotion();
  const power = usePowerProfile();
  const visible = useDocumentVisible();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const still = reduced || power === "reduced" || !visible;
    const rain = isRainScene(scene);
    const snow = isSnowScene(scene);
    const thunder = scene === "thunderstorm";
    const night = isNightScene(scene);
    const sprite = cloudSprite();

    let width = 0;
    let height = 0;
    let dpr = 1;
    let last = 0;
    let flashUntil = 0;
    let nextFlash = 4200;

    const cover = cloudCover === null ? (isCloudScene(scene) ? 70 : 18) : Math.max(0, Math.min(100, cloudCover));
    const cloudCount = Math.round(1 + cover / 18);
    const wind = windSpeed === null ? 12 : Math.max(0, Math.min(140, windSpeed));
    const toward = windDirection === null ? 90 : (windDirection + 180) % 360;
    const driftSign = Math.sin((toward * Math.PI) / 180) >= 0 ? 1 : -1;
    const drift = driftSign * (3 + Math.min(wind, 80) * 0.28);

    const clouds: Cloud[] = Array.from({ length: cloudCount }, (_, index) => ({
      x: (index + 0.5) / cloudCount - 0.1 + Math.random() * 0.2,
      y: 0.14 + Math.random() * 0.34,
      scale: 0.72 + Math.random() * 0.75 + cover / 260,
      alpha: 0.2 + (cover / 100) * 0.42,
      depth: 0.4 + Math.random() * 0.9,
      speed: 0.6 + Math.random() * 0.8,
    }));

    const drops: Drop[] = [];
    const flakes: Flake[] = [];
    const stars: Star[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, still ? 1 : 1.6);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      pointerRef.current.tx = 0;
      pointerRef.current.ty = 0;
      if (!stars.length && night) {
        for (let index = 0; index < 90; index += 1) {
          stars.push({
            x: Math.random(),
            y: Math.random() * 0.68,
            radius: 0.5 + Math.random() * 1.2,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    };

    const fillDrops = () => {
      const target = rain ? Math.round(46 + intensity * 90) : 0;
      while (drops.length < target) {
        drops.push({
          x: Math.random() * width,
          y: Math.random() * height,
          length: 9 + Math.random() * 18 + intensity * 10,
          speed: 420 + Math.random() * 460 + intensity * 340,
          alpha: 0.16 + Math.random() * 0.36,
        });
      }
      const flakeTarget = snow ? Math.round(38 + intensity * 54) : 0;
      while (flakes.length < flakeTarget) {
        flakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 1 + Math.random() * 2.2,
          speed: 16 + Math.random() * 34,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const drawCelestial = (time: number) => {
      const progress = daylightProgress === null ? 0.5 : Math.max(0, Math.min(1, daylightProgress));
      const x = width * (0.12 + progress * 0.76);
      const y = height * (0.78 - Math.sin(Math.PI * progress) * 0.56);
      const radius = Math.max(22, Math.min(width, height) * 0.075);
      const halo = context.createRadialGradient(x, y, radius * 0.3, x, y, radius * 4.4);
      if (night) {
        halo.addColorStop(0, "rgba(206, 226, 255, 0.3)");
        halo.addColorStop(1, "rgba(150, 180, 255, 0)");
      } else {
        halo.addColorStop(0, "rgba(255, 226, 168, 0.42)");
        halo.addColorStop(1, "rgba(246, 198, 103, 0)");
      }
      context.fillStyle = halo;
      context.beginPath();
      context.arc(x, y, radius * 4.4, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = night ? "#e6eeff" : "#ffe6ad";
      context.beginPath();
      context.arc(x, y, radius * 0.52, 0, Math.PI * 2);
      context.fill();

      if (!night) {
        context.save();
        context.translate(x, y);
        context.rotate(time / 26000);
        context.globalAlpha = 0.3;
        context.strokeStyle = "#ffe6ad";
        context.lineWidth = 1.4;
        for (let index = 0; index < 12; index += 1) {
          context.rotate(Math.PI / 6);
          context.beginPath();
          context.moveTo(radius * 0.86, 0);
          context.lineTo(radius * (1.2 + (index % 3) * 0.1), 0);
          context.stroke();
        }
        context.restore();
      }
    };

    const drawStars = (time: number) => {
      for (const star of stars) {
        const twinkle = 0.35 + Math.sin(time / 1400 + star.phase) * 0.3;
        context.globalAlpha = Math.max(0.06, twinkle);
        context.fillStyle = "#dce8ff";
        context.fillRect(star.x * width, star.y * height, star.radius * 1.5, star.radius * 1.5);
      }
      context.globalAlpha = 1;
    };

    const drawClouds = (delta: number) => {
      const parallax = pointerRef.current.x * 26;
      const lift = pointerRef.current.y * 14;
      for (const cloud of clouds) {
        cloud.x += ((drift * cloud.speed * cloud.depth) / Math.max(width, 1)) * delta;
        if (cloud.x > 1.35) cloud.x = -0.35;
        if (cloud.x < -0.35) cloud.x = 1.35;
        const scale = cloud.scale * Math.max(width, 520) * 0.62;
        const w = scale;
        const h = scale * 0.5;
        const x = cloud.x * width + parallax * cloud.depth - w / 2;
        const y = cloud.y * height + lift * cloud.depth - h / 2;
        context.globalAlpha = cloud.alpha;
        context.drawImage(sprite, x, y, w, h);
      }
      context.globalAlpha = 1;
    };

    const drawRain = (delta: number) => {
      context.lineWidth = 1.1;
      context.strokeStyle = "#a8d8ff";
      for (const drop of drops) {
        drop.y += (drop.speed + wind * 1.6) * delta;
        drop.x -= driftSign * wind * 0.5 * delta;
        if (drop.y > height + 24) {
          drop.y = -20;
          drop.x = Math.random() * width;
        }
        if (drop.x < -24) drop.x = width + 20;
        if (drop.x > width + 24) drop.x = -20;
        context.globalAlpha = drop.alpha;
        context.beginPath();
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x + driftSign * drop.length * 0.24, drop.y + drop.length);
        context.stroke();
      }
      context.globalAlpha = 1;
    };

    const drawSnow = (delta: number, time: number) => {
      context.fillStyle = "#e8f1ff";
      for (const flake of flakes) {
        flake.y += (flake.speed + wind * 0.4) * delta;
        const sway = Math.sin(time / 900 + flake.phase) * 16 * delta;
        flake.x += sway + driftSign * wind * 0.12 * delta;
        if (flake.y > height + 10) {
          flake.y = -10;
          flake.x = Math.random() * width;
        }
        if (flake.x < -12) flake.x = width + 10;
        if (flake.x > width + 12) flake.x = -10;
        context.globalAlpha = 0.35 + Math.abs(Math.sin(time / 1200 + flake.phase)) * 0.5;
        context.beginPath();
        context.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const drawLightning = (time: number) => {
      if (time > nextFlash) {
        flashUntil = time + 190;
        nextFlash = time + 6200 + Math.random() * 7400;
      }
      if (time > flashUntil) return;
      context.fillStyle = "rgba(206, 222, 255, 0.2)";
      context.fillRect(0, 0, width, height);
    };

    const frame = (time: number) => {
      const delta = last ? Math.min((time - last) / 1000, 0.05) : 0.016;
      last = time;
      const pointer = pointerRef.current;
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      context.clearRect(0, 0, width, height);
      if (night) drawStars(time);
      if ((!rain && !snow) || scene === "partly-day" || scene === "partly-night") {
        drawCelestial(time);
      }
      drawClouds(delta);
      if (rain) drawRain(delta);
      if (snow) drawSnow(delta, time);
      if (thunder) drawLightning(time);
      frameRef.current = window.requestAnimationFrame(frame);
    };

    const renderStill = () => {
      context.clearRect(0, 0, width, height);
      if (night) drawStars(0);
      if (!rain && !snow) drawCelestial(12000);
      drawClouds(0);
      if (rain) drawRain(0.016);
      if (snow) drawSnow(0.016, 0);
    };

    resize();
    fillDrops();

    const onResize = () => {
      resize();
      if (still) renderStill();
    };
    window.addEventListener("resize", onResize);

    const host = canvas.parentElement;
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerRef.current.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerRef.current.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onPointerLeave = () => {
      pointerRef.current.tx = 0;
      pointerRef.current.ty = 0;
    };
    host?.addEventListener("pointermove", onPointerMove);
    host?.addEventListener("pointerleave", onPointerLeave);

    if (still) {
      renderStill();
    } else {
      frameRef.current = window.requestAnimationFrame(frame);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      host?.removeEventListener("pointermove", onPointerMove);
      host?.removeEventListener("pointerleave", onPointerLeave);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      drops.length = 0;
      flakes.length = 0;
      stars.length = 0;
      context.clearRect(0, 0, width, height);
    };
  }, [scene, cloudCover, windSpeed, windDirection, intensity, daylightProgress, reduced, power, visible]);

  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}

export function stageSky(scene: SceneVariant): string {
  if (scene === "clear-night") {
    return "radial-gradient(120% 96% at 74% 4%, rgba(126, 150, 255, 0.34), transparent 56%), linear-gradient(178deg, #16204a 0%, #101a3a 44%, #0a1020 100%)";
  }
  if (scene === "clear-day") {
    return "radial-gradient(120% 96% at 76% 2%, rgba(246, 198, 103, 0.42), transparent 56%), linear-gradient(178deg, #1d5586 0%, #2b7fae 46%, #16405f 100%)";
  }
  if (scene === "partly-night") {
    return "radial-gradient(120% 96% at 72% 6%, rgba(138, 158, 255, 0.3), transparent 58%), linear-gradient(178deg, #1a2450 0%, #16224a 46%, #0b1226 100%)";
  }
  if (scene === "partly-day") {
    return "radial-gradient(120% 96% at 74% 4%, rgba(246, 208, 130, 0.34), transparent 58%), linear-gradient(178deg, #225f8e 0%, #338cb6 48%, #1a4a68 100%)";
  }
  if (scene === "overcast") {
    return "radial-gradient(120% 96% at 50% -6%, rgba(176, 194, 220, 0.26), transparent 60%), linear-gradient(178deg, #3d4d66 0%, #2c3a51 48%, #1d2739 100%)";
  }
  if (scene === "fog") {
    return "radial-gradient(120% 96% at 50% 30%, rgba(196, 210, 228, 0.3), transparent 62%), linear-gradient(178deg, #4a566c 0%, #374357 46%, #232d40 100%)";
  }
  if (scene === "snow") {
    return "radial-gradient(120% 96% at 50% 4%, rgba(206, 224, 246, 0.28), transparent 58%), linear-gradient(178deg, #3f5470 0%, #30435e 48%, #1f2c42 100%)";
  }
  if (scene === "thunderstorm") {
    return "radial-gradient(120% 96% at 34% -8%, rgba(150, 132, 220, 0.32), transparent 60%), linear-gradient(178deg, #2b3050 0%, #232840 46%, #14182a 100%)";
  }
  if (scene === "drizzle" || scene === "rain") {
    return "radial-gradient(120% 96% at 40% -6%, rgba(120, 176, 216, 0.26), transparent 60%), linear-gradient(178deg, #2c4a67 0%, #243b53 48%, #16222f 100%)";
  }
  if (scene === "heavy-rain") {
    return "radial-gradient(120% 96% at 40% -8%, rgba(112, 150, 200, 0.28), transparent 60%), linear-gradient(178deg, #24384f 0%, #1c2c40 48%, #111926 100%)";
  }
  return "radial-gradient(120% 96% at 50% 0%, rgba(120, 150, 190, 0.22), transparent 60%), linear-gradient(178deg, #1d2a3f 0%, #162030 48%, #0d1420 100%)";
}
