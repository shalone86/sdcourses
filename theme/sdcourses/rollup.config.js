import { defineConfig } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';
import postcssPresetEnv from 'postcss-preset-env';
import postcssImport from 'postcss-import';
import { resolve } from 'path';
import livereload from 'rollup-plugin-livereload';

export default defineConfig({
  input: "assets/js/app.js",
  output: {
    dir: 'assets/built',
    sourcemap: true,
    format: 'iife',
    name: 'App',
    preserveModules: false,
    plugins: [terser()],
  },
  plugins: [
    commonjs(),
    nodeResolve(),
    babel({ babelHelpers: 'bundled' }),
    postcss({
      extract: "app.css",
      sourceMap: true,
      plugins: [
        postcssImport(),
        postcssPresetEnv({})
      ],
      minimize: true,
    }),
    process.env.BUILD !== 'production' &&
    livereload({
      watch: resolve('.'),
      extraExts: ['hbs'],
      exclusions: [resolve('node_modules')],
    }),
  ],
});
