import React from 'react';
import { Composition } from 'remotion';
import { MpiDemoVideo } from './MpiDemoVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MpiDemo"
      component={MpiDemoVideo}
      durationInFrames={510} // 17 seconds @ 30 FPS
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

export default RemotionRoot;

