import {Config} from '@remotion/cli/config';

// Lets the renderer use an already-installed Chromium (e.g. in CI or a cloud box).
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
Config.setPublicDir('video/public');
Config.setVideoImageFormat('jpeg');
