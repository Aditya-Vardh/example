"use client";

import { useEffect, useRef } from "react";
import { useDocumentVisible, usePowerProfile, usePrefersReducedMotion } from "@/lib/appearance";
import type { SceneVariant } from "@/lib/wmo";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};

const RAIN_SCENES: SceneVariant[] = ["drizzle", "rain", "heavy-rain", "thunderstorm"];
const SNOW_SCENES: SceneVariant[] = ["snow"];
const CLOUD_SCENES: SceneVariant[] = ["partly-day", "partly-night", "overcast", "fog"];

const isRainScene = (scene: SceneVariant) => RAIN_SCENES.includes(scene);
const isSnowScene = (scene: SceneVariant) => SNOW_SCENES.includes(scene);
const isCloudyScene = (scene: SceneVariant) => CLOUD_SCENES.includes(scene);

export function WeatherBackground({ scene, intensity = 0.5 }: { scene: SceneVariant; intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const power = usePowerProfile();
  const visible = useDocumentVisible();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const still = reduced || power === "reduced" || !visible;
    let width = 0;
    let height = 0;
    let dpr = 1;
    const particles: Particle[] = [];
    let last = 0;

    const isRain = isRainScene(scene);
    const isSnow = isSnowScene(scene);
    const targetCount = isRain ? Math.round(90 * intensity + 40) : isSnow ? Math.round(70 * intensity + 30) : 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, still ? 1 : 1.75);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (initial: boolean): Particle => {
      if (isSnow) {
        return {
          x: Math.random() * width,
          y: initial ? Math.random() * height : -8,
          vx: (Math.random() - 0.5) * 22,
          vy: 18 + Math.random() * 34,
          size: 1.1 + Math.random() * 2.1,
        };
      }
      return {
        x: Math.random() * width,
        y: initial ? Math.random() * height : -20,
        vx: -12 - Math.random() * 18,
        vy: 380 + Math.random() * 420 + intensity * 320,
        size: 0.7 + Math.random() * 0.9,
      };
    };

    const step = (time: number) => {
      const delta = last ? Math.min((time - last) / 1000, 0.05) : 0.016;
      last = time;
      context.clearRect(0, 0, width, height);

      if (isRain || isSnow) {
        while (particles.length < targetCount) particles.push(spawn(true));
        for (let index = 0; index < particles.length; index += 1) {
          const particle = particles[index];
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;
          if (isSnow) {
            particle.x += Math.sin((particle.y + index * 13) / 42) * 14 * delta;
            context.globalAlpha = 0.5 + Math.random() * 0.4;
            context.fillStyle = "#dbeafe";
            context.beginPath();
            context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            context.fill();
          } else {
            context.globalAlpha = 0.16 + particle.size * 0.16;
            context.strokeStyle = "#9ed6ff";
            context.lineWidth = particle.size;
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(particle.x - particle.vx * 0.012, particle.y - particle.vy * 0.012);
            context.stroke();
          }
          if (particle.y > height + 20 || particle.x < -30) Object.assign(particle, spawn(false));
        }
        context.globalAlpha = 1;
      }

      frameRef.current = window.requestAnimationFrame(step);
    };

    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    if (still) {
      context.clearRect(0, 0, width, height);
    } else {
      frameRef.current = window.requestAnimationFrame(step);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      particles.length = 0;
      context.clearRect(0, 0, width, height);
    };
  }, [scene, intensity, reduced, power, visible]);

  const glow =
    scene === "clear-night"
      ? "radial-gradient(900px 520px at 78% -6%, rgba(140,160,255,0.18), transparent 62%)"
      : scene === "thunderstorm"
        ? "radial-gradient(760px 520px at 30% -10%, rgba(120,110,190,0.24), transparent 62%)"
        : scene === "clear-day"
          ? "radial-gradient(900px 520px at 74% -8%, rgba(246,198,103,0.16), transparent 60%)"
          : isCloudyScene(scene)
            ? "radial-gradient(880px 520px at 40% -10%, rgba(150,170,205,0.16), transparent 62%)"
            : "radial-gradient(820px 500px at 30% -8%, rgba(90,140,190,0.16), transparent 62%)";

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="aurora" />
      <div className="absolute inset-0 anim-drift" style={{ background: glow }} />
      {isCloudyScene(scene) ? (
        <div
          className="absolute inset-x-0 top-0 h-[42vh] opacity-[0.28] anim-drift"
          style={{
            background:
              "radial-gradient(420px 160px at 22% 34%, rgba(226,235,250,0.5), transparent 68%), radial-gradient(520px 170px at 66% 18%, rgba(200,214,238,0.42), transparent 70%), radial-gradient(360px 130px at 46% 62%, rgba(186,203,232,0.34), transparent 72%)",
            filter: "blur(6px)",
          }}
        />
      ) : null}
      {scene === "thunderstorm" && !reduced ? (
        <div
          className="absolute inset-0 opacity-0"
          style={{
            background: "linear-gradient(180deg, rgba(206,222,255,0.3), transparent 58%)",
            animation: "wi-flash 11s ease-in-out infinite",
          }}
        />
      ) : null}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
