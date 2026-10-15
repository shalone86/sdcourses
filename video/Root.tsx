import {Composition} from 'remotion';
import {Cover, type CoverProps} from './Cover';
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
  <>
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
  {/* Course cover image for Ghost (npm run cover -- <course>) */}
  <Composition id="Cover" component={Cover} fps={30} width={1200} height={675} durationInFrames={1}
    defaultProps={{title: 'Course title', icon: 'book-open'} satisfies CoverProps} />
  </>
);
