/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import {terser} from 'rollup-plugin-terser';
import visualizer from 'rollup-plugin-visualizer';

const PREAMBLE = `/**
 * @license
 * Copyright ${(new Date).getFullYear()} Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */`;

function config({
  plugins = [],
  output = {},
  external = [],
  visualize = false,
  tsCompilerOptions = {}
}) {
  if (visualize) {
    const filename = output.file + '.html';
    plugins.push(visualizer({sourcemap: true, filename}));
    console.log(`Will output a bundle visualization in ${filename}`);
  }

  const defaultTsOptions = {
    include: ['src/**/*.ts'],
    module: 'ES2015',
  };
  const tsoptions = Object.assign({}, defaultTsOptions, tsCompilerOptions);

  return {
    input: 'src/index.ts',
    plugins: [
      typescript(tsoptions), resolve(),
      // Polyfill require() from dependencies.
      commonjs({
        ignore: ['crypto', 'node-fetch', 'util'],
        include: 'node_modules/**',
        namedExports: {
          './node_modules/seedrandom/index.js': ['alea'],
        },
      }),
      ...plugins
    ],
    output: {
      banner: PREAMBLE,
      sourcemap: true,
      globals: {
        '@tensorflow/tfjs-core': 'tf',
        '@tensorflow/tfjs-converter': 'tf',
      },
      ...output,
    },
    external:
        ['@tensorflow/tfjs-core', '@tensorflow/tfjs-converter', , ...external],
    onwarn: warning => {
      let {code} = warning;
      if (code === 'CIRCULAR_DEPENDENCY' || code === 'CIRCULAR' ||
          code === 'THIS_IS_UNDEFINED') {
        return;
      }
      console.warn('WARNING: ', warning.toString());
    }
  };
}

module.exports = cmdOptions => {
  const bundles = [];

  const terserPlugin = terser({output: {preamble: PREAMBLE, comments: false}});
  const name = 'cocoSsd';
  const extend = true;
  const umdFormat = 'umd';
  const flatEsmFormat = 'es';
  const fileName = 'coco-ssd';

  // Node
  bundles.push(config({
    output: {
      format: 'cjs',
      name,
      extend,
      file: `dist/${fileName}.node.js`,
      freeze: false
    },
    tsCompilerOptions: {target: 'es5'}
  }));

  if (cmdOptions.ci || cmdOptions.npm) {
    // UMD default minified (ES5)
    bundles.push(config({
      plugins: [terserPlugin],
      output: {
        format: umdFormat,
        name,
        extend,
        file: `dist/${fileName}.min.js`,
        freeze: false
      },
      tsCompilerOptions: {target: 'es5'},
      visualize: cmdOptions.visualize
    }));
  }

  if (cmdOptions.npm) {
    // UMD default unminified (ES5)
    bundles.push(config({
      output: {
        format: umdFormat,
        name,
        extend,
        file: `dist/${fileName}.js`,
        freeze: false
      },
      tsCompilerOptions: {target: 'es5'}
    }));

    // ESM ES2017 minified
    bundles.push(config({
      plugins: [terserPlugin],
      output: {
        format: umdFormat,
        name,
        extend,
        file: `dist/${fileName}.es2017.esm.min.js`
      },
      tsCompilerOptions: {target: 'es2017'}
    }));
  }

  return bundles;
};