import React from "react"
import { Player } from "@remotion/player"
import { MpiDemoVideo } from "../../video/MpiDemoVideo"

export default function HomeRemotionVideo() {
  return (
    <div className="w-full aspect-[16/9] max-h-[640px] flex items-center justify-center bg-[#051F16] relative">
      <Player
        component={MpiDemoVideo}
        durationInFrames={510}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        style={{
          width: "100%",
          height: "100%",
        }}
        controls
        autoPlay
        loop
      />
    </div>
  )
}

