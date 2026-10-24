import {AbsoluteFill} from 'remotion';
import type {LessonProps, Scene} from '../types';
import {Chain} from './Chain';
import {College} from './College';
import {Compare} from './Compare';
import {Host} from './Host';
import {Iconostasis} from './Iconostasis';
import {ImageView} from './Image';
import {Keys} from './Keys';
import {Partners} from './Partners';
import {Union} from './Union';
import {MapView} from './Map';
import {Quote} from './Quote';
import {Recap} from './Recap';
import {Sprite} from './Sprite';
import {Puppet} from './Puppet';
import {IconsView} from './Icons';
import {Timeline} from './Timeline';
import {Term} from './Term';
import {Title} from './Title';
import {Titles} from './Titles';
import {Trinity} from './Trinity';

export type SceneProps<T = Scene> = {scene: T; lesson: LessonProps; duration: number};

const registry: Record<string, React.FC<SceneProps<any>>> = {
  title: Title,
  term: Term,
  compare: Compare,
  keys: Keys,
  timeline: Timeline,
  quote: Quote,
  college: College,
  titles: Titles,
  chain: Chain,
  recap: Recap,
  host: Host,
  map: MapView,
  image: ImageView,
  union: Union,
  partners: Partners,
  iconostasis: Iconostasis,
  trinity: Trinity,
  sprite: Sprite,
  puppet: Puppet,
  icons: IconsView,
};

export const sceneTypes = Object.keys(registry);

export const SceneView: React.FC<SceneProps> = (props) => {
  const View = registry[props.scene.type];
  if (!View) throw new Error(`Unknown scene type "${props.scene.type}". Known: ${sceneTypes.join(', ')}`);
  // Nudged in the Timing tab (timing.yml `nudge`): moved by x/y pixels (of 1920×1080) and resized.
  const n = (props.scene as {nudge?: {x?: number; y?: number; size?: number}}).nudge;
  if (!n || (!n.x && !n.y && (n.size ?? 100) === 100)) return <View {...props} />;
  return (
    <AbsoluteFill style={{transform: `translate(${n.x ?? 0}px, ${n.y ?? 0}px) scale(${(n.size ?? 100) / 100})`}}>
      <View {...props} />
    </AbsoluteFill>
  );
};
