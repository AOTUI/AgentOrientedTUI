import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

export const IconSun = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
export const IconMoon = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
export const IconNewChat = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M12 4v16m8-8H4" /></svg>;
export const IconMenu = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-5 h-5 ${props.className || ''}`}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
export const IconPlay = (props: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M8 5v14l11-7z" /></svg>;
export const IconPause = (props: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>;
export const IconStop = (props: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M6 6h12v12H6z" /></svg>;
export const IconSend = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
export const IconDelete = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
export const IconFolder = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
export const IconModel = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
export const IconTheme = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" /></svg>;
export const IconSettings = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
export const IconPlug = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></svg>;
export const IconEllipsis = (props: IconProps) => <svg viewBox="0 0 24 24" fill="currentColor" {...props} className={`w-4 h-4 ${props.className || ''}`}><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>;
export const IconPin = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M12 17v5" /><path d="M9 10.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6.5l2 3H7l2-3z" /></svg>;
export const IconPencil = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
export const IconChat = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
export const IconTerminal = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>;
export const IconToolbox = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" /><path d="M9 7V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" /><path d="M3 13h18" /></svg>;
// Apps: Four rounded squares — macOS 26 superellipse grid
// Design: Pure 2×2 grid. No hierarchy between cells; a deliberate
// choice — the app launcher is a democracy. The rx=2.5 radius sits
// exactly between SF Symbols' "app.badge.fill" and a plain rect,
// giving it warmth without being playful. 2px gutters create
// optical breathing room that holds at 16px.
export const IconApps = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </svg>
);

// Skills: Precision wrench — macOS 26 production-quality tool icon
// Design: SF Symbols "wrench" is a single compound path — one stroke
// traces the hex jaw, the circular head with its adjustment slot,
// and the ergonomic taper of the handle without lifting the pen.
// This is the canonical form used across Apple's own icon system.
// The 2.12-unit fillet on the handle tip echoes the squircle radius.
export const IconSkills = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

// MCP: Vertical blade plug — macOS 26 precision connector
// Design: Two flat-blade pins (rects, not lines — physicality matters)
// sit above a well-proportioned housing body. The rx=3 housing radius
// is concentric with the rx=1 pin radius at this scale, maintaining
// the squircle-nesting relationship that defines macOS 26 geometry.
// Two recessed contact-slot indicators (filled, 35% opacity) on the
// housing face add depth without introducing noise — they read as
// "structured protocol" at a glance and cleanly distinguish this
// from the simpler IconPlug. Cable exits from the bottom center.
export const IconMCP = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props} className={`w-4 h-4 ${props.className || ''}`}>
    {/* Left blade pin */}
    <rect x="8.25" y="1.5" width="2.5" height="6" rx="1.25" />
    {/* Right blade pin */}
    <rect x="13.25" y="1.5" width="2.5" height="6" rx="1.25" />
    {/* Plug housing */}
    <rect x="4" y="7.5" width="16" height="14" rx="3" />
    {/* Recessed contact slots — structural face detail */}
    <rect x="8.75" y="11" width="2.5" height="5.5" rx="1.25" fill="currentColor" fillOpacity={0.35} stroke="none" />
    <rect x="12.75" y="11" width="2.5" height="5.5" rx="1.25" fill="currentColor" fillOpacity={0.35} stroke="none" />
    {/* Cable exit */}
    <line x1="12" y1="21.5" x2="12" y2="23.5" />
  </svg>
);

// --- Agent State Icons (Refined Cartoon Bot) ---

export const IconAgentSleeping = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props} className={`w-5 h-5 ${props.className || ''}`}>
    <style>{`
      @keyframes bot-sleep-z {
        0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
        50% { opacity: 1; transform: translate(2px, -3px) scale(1); }
        100% { opacity: 0; transform: translate(4px, -6px) scale(1.5); }
      }
      @keyframes bot-breathe {
        0%, 100% { transform: scaleY(1); }
        50% { transform: scaleY(0.95) translateY(1px); }
      }
      @keyframes bot-antenna-glow {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.8; }
      }
      .bot-z1 { animation: bot-sleep-z 3s infinite; }
      .bot-z2 { animation: bot-sleep-z 3s infinite 1.5s; }
      .bot-body { animation: bot-breathe 3s infinite; transform-origin: bottom; }
      .bot-antenna-light { animation: bot-antenna-glow 3s infinite; }
    `}</style>
    <g className="bot-body">
      {/* Head Base */}
      <rect x="4" y="8" width="16" height="11" rx="4" fill="currentColor" opacity="0.15" />
      <rect x="4" y="8" width="16" height="11" rx="4" stroke="currentColor" strokeWidth="1.5" />
      {/* Screen/Face Area */}
      <rect x="6" y="10" width="12" height="7" rx="2" fill="currentColor" opacity="0.1" />
      {/* Antenna */}
      <path d="M12 8V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="3" r="1.5" fill="currentColor" className="bot-antenna-light" />
      {/* Sleeping Eyes (Closed curves) */}
      <path d="M7.5 13.5C8.5 14.5 9.5 14.5 10.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.5 13.5C14.5 14.5 15.5 14.5 16.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </g>
    {/* Zzz */}
    <text x="16" y="7" fontSize="4" fill="currentColor" className="bot-z1" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>z</text>
    <text x="19" y="4" fontSize="3" fill="currentColor" className="bot-z2" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>z</text>
  </svg>
);

export const IconAgentIdle = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props} className={`w-5 h-5 ${props.className || ''}`}>
    <style>{`
      @keyframes bot-look-around {
        0%, 100% { transform: translateX(0); }
        20%, 30% { transform: translateX(-2px); }
        70%, 80% { transform: translateX(2px); }
      }
      @keyframes bot-blink {
        0%, 48%, 52%, 100% { transform: scaleY(1); }
        50% { transform: scaleY(0.1); }
      }
      @keyframes bot-hover {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
      }
      .bot-eyes { animation: bot-look-around 5s infinite ease-in-out; }
      .bot-blink { animation: bot-blink 4s infinite; transform-origin: center; }
      .bot-hover { animation: bot-hover 3s infinite ease-in-out; }
    `}</style>
    <g className="bot-hover">
      {/* Head Base */}
      <rect x="4" y="8" width="16" height="11" rx="4" fill="currentColor" opacity="0.15" />
      <rect x="4" y="8" width="16" height="11" rx="4" stroke="currentColor" strokeWidth="1.5" />
      {/* Screen/Face Area */}
      <rect x="6" y="10" width="12" height="7" rx="2" fill="currentColor" opacity="0.1" />
      {/* Antenna */}
      <path d="M12 8V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="3" r="1.5" fill="currentColor" opacity="0.8" />
      {/* Eyes */}
      <g className="bot-eyes">
        <g className="bot-blink">
          <circle cx="9" cy="13.5" r="1.5" fill="currentColor" />
          <circle cx="15" cy="13.5" r="1.5" fill="currentColor" />
        </g>
      </g>
    </g>
  </svg>
);

export const IconAgentWorking = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props} className={`w-5 h-5 ${props.className || ''}`}>
    <style>{`
      @keyframes bot-work-shake {
        0%, 100% { transform: translate(0, 0); }
        25% { transform: translate(-0.5px, 0.5px); }
        50% { transform: translate(0.5px, -0.5px); }
        75% { transform: translate(-0.5px, -0.5px); }
      }
      @keyframes bot-type-fast-l {
        0%, 100% { transform: rotate(0deg) translateY(0); }
        50% { transform: rotate(35deg) translateY(3px); }
      }
      @keyframes bot-type-fast-r {
        0%, 100% { transform: rotate(0deg) translateY(0); }
        50% { transform: rotate(-35deg) translateY(3px); }
      }
      @keyframes bot-sweat {
        0% { transform: translateY(0) scale(0); opacity: 0; }
        20% { transform: translateY(0) scale(1); opacity: 1; }
        80% { transform: translateY(4px) scale(1); opacity: 1; }
        100% { transform: translateY(6px) scale(0.5); opacity: 0; }
      }
      @keyframes bot-signal {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(2.5); opacity: 0; }
      }
      .bot-shake { animation: bot-work-shake 0.6s infinite; }
      .bot-arm-l { animation: bot-type-fast-l 0.24s infinite; transform-origin: 6px 14px; }
      .bot-arm-r { animation: bot-type-fast-r 0.24s infinite 0.12s; transform-origin: 18px 14px; }
      .bot-sweat { animation: bot-sweat 2s infinite; transform-origin: 18.5px 9px; }
      .bot-signal-1 { animation: bot-signal 1s infinite; transform-origin: 12px 2px; }
      .bot-signal-2 { animation: bot-signal 1s infinite 0.5s; transform-origin: 12px 2px; }
    `}</style>
    <g className="bot-shake">
      {/* Head Base */}
      <rect x="4" y="5" width="16" height="11" rx="4" fill="currentColor" opacity="0.15" />
      <rect x="4" y="5" width="16" height="11" rx="4" stroke="currentColor" strokeWidth="1.5" />
      {/* Screen/Face Area */}
      <rect x="6" y="7" width="12" height="7" rx="2" fill="currentColor" opacity="0.1" />
      
      {/* Antenna */}
      <path d="M12 5V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="2" r="1.5" fill="currentColor" />
      {/* Signal Waves */}
      <circle cx="12" cy="2" r="2" stroke="currentColor" strokeWidth="0.5" fill="none" className="bot-signal-1" />
      <circle cx="12" cy="2" r="2" stroke="currentColor" strokeWidth="0.5" fill="none" className="bot-signal-2" />

      {/* Intense Eyes (> <) */}
      <path d="M7.5 9L9.5 10.5L7.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 9L14.5 10.5L16.5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Sweat Drop */}
      <path d="M18.5 6C18.5 6 17 8 17 9C17 9.82843 17.6716 10.5 18.5 10.5C19.3284 10.5 20 9.82843 20 9C20 8 18.5 6 18.5 6Z" fill="currentColor" opacity="0.8" className="bot-sweat" />
    </g>

    {/* Keyboard Base (More visible) */}
    <path d="M3 21L6 16H18L21 21H3Z" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    {/* Keyboard Keys (Added details) */}
    <path d="M7 17.5H17M6 19H18" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    
    {/* Arms typing furiously */}
    <path d="M4 14C2 14 2 17 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className="bot-arm-l" />
    <path d="M20 14C22 14 22 17 18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className="bot-arm-r" />
  </svg>
);

export const IconAgentPaused = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props} className={`w-5 h-5 ${props.className || ''}`}>
    <style>{`
      @keyframes bot-pause-pulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
      @keyframes bot-float-slow {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-1px); }
      }
      .bot-pause-indicator { animation: bot-pause-pulse 2s infinite; }
      .bot-float-slow { animation: bot-float-slow 4s infinite ease-in-out; }
    `}</style>
    <g className="bot-float-slow">
      {/* Head Base */}
      <rect x="4" y="8" width="16" height="11" rx="4" fill="currentColor" opacity="0.15" />
      <rect x="4" y="8" width="16" height="11" rx="4" stroke="currentColor" strokeWidth="1.5" />
      {/* Screen/Face Area */}
      <rect x="6" y="10" width="12" height="7" rx="2" fill="currentColor" opacity="0.1" />
      {/* Antenna */}
      <path d="M12 8V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="3" r="1.5" fill="currentColor" opacity="0.3" />
      {/* Paused Eyes (Straight lines) */}
      <path d="M8 13.5H10M14 13.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Pause Symbol Overlay */}
      <g className="bot-pause-indicator">
        <rect x="10.5" y="11.5" width="1" height="4" rx="0.5" fill="currentColor" />
        <rect x="12.5" y="11.5" width="1" height="4" rx="0.5" fill="currentColor" />
      </g>
    </g>
  </svg>
);

