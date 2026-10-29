import {Composition} from 'remotion';
import {Cover, type CoverProps} from './Cover';
import {KidsThumb, type KidsThumbProps} from './KidsThumb';
import {Lesson} from './Lesson';
import {BattleClip, battleClipFrames, type BattleClipProps} from './scenes/Battle';
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
  {/* A battle on its own (BATTLES.md, npm run battle -- <name>) */}
  <Composition id="Battle" component={BattleClip} fps={FPS} width={1920} height={1080} durationInFrames={30}
    defaultProps={{battle: {name: 'empty', view: [16, 9], map: ['g'], tiles: {}, units: [], script: []}, arts: {}} satisfies BattleClipProps}
    calculateMetadata={({props}) => ({durationInFrames: battleClipFrames(props, FPS)})} />
  {/* Course cover image for Ghost (npm run cover -- <course>) */}
  <Composition id="Cover" component={Cover} fps={30} width={1200} height={675} durationInFrames={1}
    defaultProps={{title: 'Course title', icon: 'book-open'} satisfies CoverProps} />
  {/* Thumbnail for kids.sdcason.com (scripts/kids-thumb.mjs) */}
  <Composition id="KidsThumb" component={KidsThumb} fps={30} width={1280} height={720} durationInFrames={1}
    defaultProps={{lead: 'What is', title: 'the Byzantine Rite?'} satisfies KidsThumbProps} />
  </>
);
