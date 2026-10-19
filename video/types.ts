// Mirrors lesson.yml after scripts/prepare.mjs adds timing and audio paths.
// `from`: start frame within the segment; `cues`: named frames within the scene.
// `until`: a picture trimmed to end early (frame within the segment), else it lasts until the next.
export type Scene = {type: string; from?: number; until?: number; cues?: Record<string, number>; [key: string]: any};

export type Segment = {
  kind: 'intro' | 'point' | 'outro';
  index: number; // point number (1-based) for points, 0 otherwise
  heading?: string;
  text: string;
  scenes: Scene[];
  audio: string | null; // path relative to video/public
  // Her camera clip (starts with the voice): a bubble over the pictures, full screen with the
  // pictures in a floating card, or off.
  camera?: {src: string; from: number; frames: number; side?: 'left' | 'right'; layout: 'off' | 'bubble' | 'card' | 'side' | 'lower' | 'only'} | null;
  durationInFrames: number;
  audioOffsetInFrames: number;
  headingFrames?: number; // points: when the heading settles and the first scene starts
};

export type LessonProps = {
  courseTitle: string;
  number: number;
  title: string;
  headings: string[];
  credit?: string;
  author?: string;
  hostPhoto?: string | null; // path relative to video/public
  music?: {src: string; underVoice: number; between: number; credit?: string; bpm?: number; beats?: number[]} | null;
  motion?: 'calm' | 'dance'; // kids style: calm (explainers: only the background shapes dance) or dance (music videos)
  style?: 'classic' | 'kids'; // kids: bright colors, rounded font, motion on the music's beat (beats: frames)
  segments: Segment[];
};
