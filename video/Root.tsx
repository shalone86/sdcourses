import {Composition} from 'remotion';
import {Lesson} from './Lesson';
import {FPS} from './theme';
import type {LessonProps} from './types';

const placeholder: LessonProps = {
  courseTitle: 'Course',
  number: 1,
  title: 'Run npm run prepare-lesson first',
  headings: [],
  segments: [
    {kind: 'intro', index: 0, text: '', scenes: [{type: 'title'}], audio: null, durationInFrames: 90, audioOffsetInFrames: 0},
  ],
};

export const Root: React.FC = () => (
  <Composition
    id="Lesson"
    component={Lesson}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={placeholder}
    calculateMetadata={({props}) => ({
      durationInFrames: props.segments.reduce((sum, s) => sum + s.durationInFrames, 0),
    })}
  />
);
