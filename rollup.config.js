//@ts-check

const ChildProcess = require('child_process');
const Events = require('events');
const Fs = require('fs').promises;
const Path = require('path');
const RollupPluginDts = require('rollup-plugin-dts').default;
const Esbuild = require('esbuild');
const Package = require('./package.json');

/** @type {import('rollup').RollupOptions} */
const config = {
  input: ['./dist/.types/src/index.d.ts'],
  output: {
    file: './dist/index.d.ts',
    format: 'esm',
  },
  plugins: [RollupPluginDts(), RollupPluginGenerateTypes(), RollupPluginBuildLibrary()],
};

module.exports = config;

/**
 * @returns {import('rollup').Plugin}
 */
function RollupPluginGenerateTypes() {
  return {
    name: 'plugin-generate-types',
    async buildStart() {
      const child = ChildProcess.spawn(
        Path.resolve(__dirname, './node_modules/.bin/tsc'),
        ['--build', '--force'],
        {
          stdio: ['ignore', 'inherit', 'inherit'],
          cwd: __dirname,
        }
      );

      const [exitCode, signal] = await Events.once(child, 'exit');

      if (exitCode) {
        this.error(
          `TypeScript build exited with code ${exitCode} and signal ${signal || '<no_signal>'}.`
        );
      }
    },
    async renderStart() {
      await Fs.rmdir(Path.resolve(__dirname, './dist/.types'), { recursive: true });
    },
  };
}

/**
 * @returns {import('rollup').Plugin}
 */
function RollupPluginBuildLibrary() {
  return {
    name: 'plugin-build-library',
    async buildEnd() {
      /** @type {import('esbuild').BuildOptions} */
      const baseConfig = {
        absWorkingDir: __dirname,
        bundle: true,
        define: {
          'process.env.NODE_ENV': JSON.stringify('production'),
        },
        entryPoints: ['./src/index.ts'],
        platform: 'neutral',
        target: 'es2017',
        write: false,
      };

      const builds = await Promise.all([
        Esbuild.build({
          ...baseConfig,
          format: 'esm',
          outfile: Package.exports['.'].node.import,
        }),
        Esbuild.build({
          ...baseConfig,
          format: 'cjs',
          outfile: Package.exports['.'].node.require,
        }),
      ]);

      const outputFiles = builds.flatMap((build) => build.outputFiles);

      for (const outputFile of outputFiles) {
        this.emitFile({
          type: 'asset',
          fileName: Path.basename(outputFile.path),
          // name: outputFile.path,
          source: outputFile.text,
        });
      }
    },
  };
}
