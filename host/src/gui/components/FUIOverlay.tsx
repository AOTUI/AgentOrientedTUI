import React from 'react';

export function FUIOverlay() {
    return (
        <div className="fixed inset-0 pointer-events-none z-[40]">
            {/* Corner Brackets - Ultra thin and subtle */}
            <div className="absolute top-8 left-8 w-4 h-4 border-t border-l border-white/10 rounded-tl-sm opacity-50" />
            <div className="absolute top-8 right-8 w-4 h-4 border-t border-r border-white/10 rounded-tr-sm opacity-50" />
            <div className="absolute bottom-8 left-8 w-4 h-4 border-b border-l border-white/10 rounded-bl-sm opacity-50" />
            <div className="absolute bottom-8 right-8 w-4 h-4 border-b border-r border-white/10 rounded-br-sm opacity-50" />
            
            {/* Minimal Crosshairs */}
            <div className="absolute top-1/2 left-8 w-2 h-[1px] bg-white/[0.05]" />
            <div className="absolute top-1/2 right-8 w-2 h-[1px] bg-white/[0.05]" />
            <div className="absolute bottom-8 left-1/2 w-[1px] h-2 bg-white/[0.05]" />
            
            {/* Status Indicators - Purely visual */}
            <div className="absolute top-8 left-16 flex gap-1">
                <div className="w-[2px] h-[2px] rounded-full bg-white/20" />
                <div className="w-[2px] h-[2px] rounded-full bg-white/10" />
                <div className="w-[2px] h-[2px] rounded-full bg-white/5" />
            </div>

            {/* Vertical Ruler Lines */}
            <div className="absolute top-32 right-8 flex flex-col gap-8 opacity-20">
                 <div className="w-[1px] h-2 bg-white/20" />
                 <div className="w-[1px] h-2 bg-white/10" />
                 <div className="w-[1px] h-2 bg-white/5" />
            </div>
        </div>
    );
}
