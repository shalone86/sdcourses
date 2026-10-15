// Mirrors lesson.yml after scripts/prepare.mjs adds timing and audio paths.
// `from`: start frame within the segment; `cues`: named frames within the scene.
export type Scene = {type: string; from?: number; cues?: Record<string, number>; [key: string]: any};

export type Segment = {
  kind: 'intro' | 'point' | 'outro';
  index: number; // point number (1-based) for points, 0 otherwise
  heading?: string;
  text: string;
  scenes: Scene[];
  audio: string | null; // path relative to video/public
  durationInFrames: number;
  audioOffsetInFrames: number;
};

export type LessonProps = {
  courseTitle: string;
  number: number;
  title: string;
  headings: string[];
  credit?: string;
  author?: string;
  hostPhoto?: string | null; // path relative to video/public
  music?: {src: string; underVoice: number; between: number; credit?: string} | null;
  segments: Segment[];
};
