"use client";

import React, { useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { formatTime } from "../lib/utils";

export interface VideoPlayerRef {
  seekTo: (seconds: number) => void;
}

interface VideoPlayerProps {
  src: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ src, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = seconds;
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      },
    }));

    const togglePlay = () => {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };

    const handleSpeedChange = (speed: number) => {
      setPlaybackRate(speed);
      if (videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
    };

    const toggleMute = () => {
      if (!videoRef.current) return;
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    };

    return (
      <div className="newspaper-box overflow-hidden flex flex-col sticky top-6">
        {/* Newspaper Picture Caption Bar */}
        <div className="bg-[#111111] text-white px-3 py-2 flex items-center justify-between border-b-2 border-[#111111]">
          <span className="font-wire text-xs uppercase font-bold tracking-widest">
            PLATE I: THE MOVING PICTURE
          </span>
          <span className="font-wire text-[10px] uppercase tracking-wider text-[#cccccc]">
            CINETEL RECORD
          </span>
        </div>

        {/* Video Screen */}
        <div className="relative aspect-[9/16] sm:aspect-[4/5] bg-black flex items-center justify-center max-h-[520px] border-b-2 border-[#111111]">
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlay}
            onTimeUpdate={() => {
              if (videoRef.current) {
                const cur = videoRef.current.currentTime;
                setCurrentTime(cur);
                onTimeUpdate?.(cur);
              }
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration || 0);
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            playsInline
          />

          {/* Big Vintage Play Overlay */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 m-auto w-16 h-16 bg-[#111111] text-white border-2 border-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              aria-label="Play moving picture"
            >
              <Play className="w-8 h-8 fill-current ml-1" />
            </button>
          )}
        </div>

        {/* Newspaper Player Controls */}
        <div className="p-4 bg-[#fbf9f4] space-y-3">
          {/* Scrubber Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between font-wire text-xs font-bold text-[#111111]">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (videoRef.current) {
                  videoRef.current.currentTime = val;
                  setCurrentTime(val);
                }
              }}
              className="w-full h-2 bg-[#dddddd] accent-[#111111] cursor-pointer border border-[#111111]"
            />
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="newspaper-btn-primary p-2 font-wire text-xs font-bold uppercase cursor-pointer"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="newspaper-btn-outline p-2 font-wire text-xs font-bold uppercase cursor-pointer"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Playback Speed Toggles */}
            <div className="flex items-center gap-1 border border-[#111111] p-0.5 bg-white">
              {[1, 1.25, 1.5, 2].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => handleSpeedChange(speed)}
                  className={`px-2 py-0.5 font-wire text-[10px] font-bold uppercase transition-colors ${
                    playbackRate === speed
                      ? "bg-[#111111] text-white"
                      : "text-[#333333] hover:text-[#111111] hover:bg-[#eeeeee]"
                  }`}
                >
                  {speed}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vintage Frame Footnote */}
        <div className="px-3 py-1.5 bg-[#f6f4ee] border-t border-[#111111] text-[10px] font-serif italic text-[#666666] text-center">
          Fig 1. Synchronized Reel Dispatch with Verbatim Margins.
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";
