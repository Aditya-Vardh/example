"use client";

import type { IconVariant } from "@/lib/wmo";

type Props = {
  variant: IconVariant;
  size?: number;
  animate?: boolean;
  className?: string;
  title?: string;
};

const AMBER = "#f6c667";
const SLATE = "#a9b8d4";
const SLATE_DIM = "#7f8fab";
const BLUE = "#7fb4ff";

function Sun({ cx, cy, r, opacity = 1 }: { cx: number; cy: number; r: number; opacity?: number }) {
  return (
    <g opacity={opacity}>
      <circle cx={cx} cy={cy} r={r} fill="url(#aether-sun)" />
      <circle cx={cx} cy={cy} r={r * 0.62} fill="#ffe9b0" opacity="0.55" />
    </g>
  );
}

function Moon({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#e6eeff" opacity="0.92" />
      <circle cx={cx + r * 0.42} cy={cy - r * 0.32} r={r * 0.86} fill="#0d1524" />
    </g>
  );
}

function Cloud({
  x = 0,
  y = 0,
  scale = 1,
  shade = SLATE,
  drift = true,
  speed = 16,
}: {
  x?: number;
  y?: number;
  scale?: number;
  shade?: string;
  drift?: boolean;
  speed?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className={drift ? "wi-drift" : undefined} style={drift ? { animationDuration: `${speed}s` } : undefined}>
        <path
          d="M14 40c-6.6 0-12-5.1-12-11.4 0-6 4.7-10.9 10.7-11.4C14.6 10.4 20.6 6 27.6 6c7.4 0 13.6 4.9 15.1 11.5 1-.3 2-.4 3.1-.4C51.9 17.1 57 21.6 57 27.2c0 5.5-4.9 9.9-11.2 9.9H14Z"
          fill={shade}
          opacity="0.95"
        />
        <path d="M14 40h31.8c6.3 0 11.2-4.4 11.2-9.9 0-2.2-.8-4.2-2.1-5.8-1.4 5-6.6 8.6-13 8.6H14Z" fill="#6d7c97" opacity="0.55" />
      </g>
    </g>
  );
}

function Drops({ count, x, y, color = BLUE, length = 7 }: { count: number; x: number; y: number; color?: string; length?: number }) {
  return (
    <g>
      {Array.from({ length: count }).map((_, index) => (
        <line
          key={index}
          x1={x + index * 7}
          y1={y}
          x2={x + index * 7 - 1.4}
          y2={y + length}
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          className="wi-fall"
          style={{ animationDelay: `${index * 0.24}s` }}
        />
      ))}
    </g>
  );
}

function SnowMark({ x, y, delay = 0 }: { x: number; y: number; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="wi-fall-slow" style={{ animationDelay: `${delay}s` }}>
        {[0, 60, 120].map((angle) => (
          <line
            key={angle}
            x1={-3.6}
            y1={0}
            x2={3.6}
            y2={0}
            transform={`rotate(${angle})`}
            stroke="#cfe6ff"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        ))}
      </g>
    </g>
  );
}

function Flakes({ count, x, y }: { count: number; x: number; y: number }) {
  return (
    <g>
      {Array.from({ length: count }).map((_, index) => (
        <SnowMark key={index} x={x + index * 8} y={y + 4} delay={index * 0.5} />
      ))}
    </g>
  );
}

function Bolt({ x, y }: { x: number; y: number }) {
  return (
    <path d={`M${x} ${y}l-6 12h5l-2 9 9-13h-5l3-8z`} fill={AMBER} className="wi-flash" />
  );
}

function FogLines() {
  return (
    <g className="wi-fog-lines">
      <rect x="8" y="42" width="46" height="3" rx="1.5" fill={SLATE_DIM} opacity="0.75" />
      <rect x="14" y="50" width="38" height="3" rx="1.5" fill={SLATE_DIM} opacity="0.55" />
      <rect x="10" y="58" width="42" height="3" rx="1.5" fill={SLATE_DIM} opacity="0.4" />
    </g>
  );
}

function Shape({ variant }: { variant: IconVariant }) {
  switch (variant) {
    case "clear-day":
      return (
        <g className="wi-sun">
          <Sun cx={32} cy={34} r={13} />
          {Array.from({ length: 8 }).map((_, index) => (
            <line
              key={index}
              x1={32}
              y1={34}
              x2={32 + Math.cos((index * Math.PI) / 4) * 24}
              y2={34 + Math.sin((index * Math.PI) / 4) * 24}
              stroke={AMBER}
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity={index % 2 === 0 ? 0.9 : 0.55}
              className="wi-ray"
              style={{ animationDelay: `${index * 0.16}s` }}
            />
          ))}
        </g>
      );
    case "clear-night":
      return (
        <g>
          <Moon cx={30} cy={32} r={14} />
          <circle cx="50" cy="18" r="1.6" fill="#dfe9ff" className="wi-twinkle" />
          <circle cx="45" cy="49" r="1.2" fill="#dfe9ff" className="wi-twinkle" style={{ animationDelay: "0.7s" }} />
          <circle cx="14" cy="20" r="1.3" fill="#dfe9ff" className="wi-twinkle" style={{ animationDelay: "1.3s" }} />
        </g>
      );
    case "partly-day":
      return (
        <g>
          <g className="wi-sun" opacity="0.95">
            <Sun cx={23} cy={22} r={10} />
          </g>
          <Cloud x={6} y={18} scale={0.86} />
        </g>
      );
    case "partly-night":
      return (
        <g>
          <Moon cx={22} cy={21} r={10} />
          <Cloud x={8} y={18} scale={0.84} shade="#8c9bb8" />
        </g>
      );
    case "cloudy":
      return (
        <g>
          <Cloud x={-2} y={14} scale={0.7} shade={SLATE_DIM} speed={22} />
          <Cloud x={10} y={24} scale={0.9} />
        </g>
      );
    case "fog":
      return (
        <g>
          <Cloud x={9} y={6} scale={0.86} shade={SLATE_DIM} drift={false} />
          <FogLines />
        </g>
      );
    case "drizzle":
      return (
        <g>
          <Cloud x={6} y={8} scale={0.94} />
          <Drops count={3} x={20} y={45} length={5} />
        </g>
      );
    case "rain":
      return (
        <g>
          <Cloud x={6} y={7} scale={0.94} />
          <Drops count={4} x={18} y={45} />
        </g>
      );
    case "heavy-rain":
      return (
        <g>
          <Cloud x={6} y={5} scale={0.94} shade="#8e9db9" />
          <Drops count={5} x={14} y={44} length={10} color="#5f9ff0" />
        </g>
      );
    case "showers":
      return (
        <g>
          <g className="wi-sun" opacity="0.85">
            <Sun cx={46} cy={14} r={7} />
          </g>
          <Cloud x={4} y={8} scale={0.92} />
          <Drops count={4} x={17} y={45} />
        </g>
      );
    case "freezing-rain":
      return (
        <g>
          <Cloud x={6} y={7} scale={0.94} shade="#93a3c0" />
          <Drops count={3} x={19} y={45} color="#8fd8ff" />
          <SnowMark x={43} y={53} />
        </g>
      );
    case "snow":
      return (
        <g>
          <Cloud x={6} y={7} scale={0.94} shade="#9dadc9" />
          <Flakes count={4} x={20} y={47} />
        </g>
      );
    case "sleet":
      return (
        <g>
          <Cloud x={6} y={7} scale={0.94} shade="#95a5c2" />
          <Drops count={2} x={21} y={45} color="#8fd8ff" />
          <Flakes count={2} x={36} y={47} />
        </g>
      );
    case "thunderstorm":
      return (
        <g>
          <Cloud x={6} y={5} scale={0.94} shade="#7f8ead" />
          <Bolt x={30} y={44} />
          <Drops count={3} x={15} y={47} color="#5f9ff0" />
        </g>
      );
    case "hail":
      return (
        <g>
          <Cloud x={6} y={5} scale={0.94} shade="#838fae" />
          <circle cx="22" cy="49" r="2.6" fill="#dbeafe" className="wi-bounce" />
          <circle cx="31" cy="52" r="2.2" fill="#dbeafe" className="wi-bounce" style={{ animationDelay: "0.3s" }} />
          <circle cx="40" cy="48" r="2.4" fill="#dbeafe" className="wi-bounce" style={{ animationDelay: "0.6s" }} />
        </g>
      );
    default:
      return (
        <g>
          <circle cx="32" cy="34" r="14" fill="none" stroke={SLATE_DIM} strokeWidth="2.4" strokeDasharray="5 5" />
          <text x="32" y="39" fontSize="13" fontWeight="700" fill={SLATE} textAnchor="middle">
            ?
          </text>
        </g>
      );
  }
}

export function WeatherIcon({ variant, size = 64, animate = true, className = "", title }: Props) {
  return (
    <svg
      role="img"
      aria-label={title ?? variant.replace(/-/g, " ")}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`${animate ? "wi-anim" : ""} ${className}`}
    >
      <defs>
        <radialGradient id="aether-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff4cf" />
          <stop offset="60%" stopColor={AMBER} />
          <stop offset="100%" stopColor="#f0a73f" />
        </radialGradient>
      </defs>
      <style>{`
        .wi-anim .wi-ray{transform-box:fill-box;transform-origin:center;animation:wi-ray 3.6s ease-in-out infinite}
        .wi-anim .wi-sun{transform-box:fill-box;transform-origin:center;animation:wi-breathe 5s ease-in-out infinite}
        .wi-anim .wi-drift{animation:wi-drift 16s ease-in-out infinite}
        .wi-anim .wi-fall{animation:wi-fall 1.1s linear infinite}
        .wi-anim .wi-fall-slow{animation:wi-flake 3.2s linear infinite}
        .wi-anim .wi-flash{animation:wi-flash 3.4s ease-in-out infinite}
        .wi-anim .wi-twinkle{animation:wi-twinkle 3.6s ease-in-out infinite}
        .wi-anim .wi-fog-lines{animation:wi-fog 6s ease-in-out infinite}
        .wi-anim .wi-bounce{animation:wi-bounce 1.5s ease-in-out infinite}
        @keyframes wi-ray{0%,100%{opacity:.45}50%{opacity:.95}}
        @keyframes wi-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        @keyframes wi-drift{0%,100%{transform:translateX(-1.5px)}50%{transform:translateX(2.5px)}}
        @keyframes wi-fall{0%{opacity:0;transform:translateY(-3px)}20%{opacity:1}100%{opacity:0;transform:translateY(7px)}}
        @keyframes wi-flake{0%{opacity:0;transform:translateY(-2px)}25%{opacity:1}100%{opacity:0;transform:translateY(8px)}}
        @keyframes wi-flash{0%,86%,100%{opacity:.9}88%{opacity:.15}90%{opacity:1}92%{opacity:.3}94%{opacity:1}}
        @keyframes wi-twinkle{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes wi-fog{0%,100%{transform:translateX(-2px);opacity:.85}50%{transform:translateX(3px);opacity:.5}}
        @keyframes wi-bounce{0%,100%{transform:translateY(0);opacity:.95}50%{transform:translateY(3px);opacity:.6}}
        @media (prefers-reduced-motion: reduce){.wi-anim *{animation:none!important}}
      `}</style>
      <Shape variant={variant} />
    </svg>
  );
}
