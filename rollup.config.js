import typescript from 'rollup-plugin-typescript2';
import replace from '@rollup/plugin-replace';
import filesize from 'rollup-plugin-filesize';
import resolve from '@rollup/plugin-node-resolve';
import pkg from './package.json';

export default {
    input: 'src/index.ts',
    output: {
        name: 'Z',
        file: 'dist/z.js',
        format: 'umd'
    },
    plugins: [
        replace({
            '__VERSION': `"${pkg.version}"`,
            'process.env.NODE_ENV': "'production'"
        }),
        typescript({
            tsconfig: "./tsconfig.json"
        }),
        resolve(),
        filesize()
    ]
}