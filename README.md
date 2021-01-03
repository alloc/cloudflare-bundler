# cloudflare-bundler

Generate a bundle that runs as a [Cloudflare worker][1], then upload it to Cloudflare.

The bundle is minified by default.

[1]: https://developers.cloudflare.com/workers/

```ts
const { bundleWorker } = require('cloudflare-bundler')

// Bundle the worker, then upload to Cloudflare.
const worker = await bundleWorker({
  main: 'workers/foo.ts',
  upload: true,
})

// Write the sourcemap.
const fs = require('fs')
fs.writeFileSync(
  'workers/foo.js.map',
  JSON.stringify(worker.map)
)
```

### Install

```sh
yarn add -D cloudflare-bundler
```

### Options

- `main?: string`  
  The entry module in JavaScript or TypeScript.

- `root?: string`  
  The root directory of the worker.  

  This option is useful when your worker has its own `package.json` and 
  `worker.toml` files. The `main` option is inferred from its `package.json` 
  file, and the `upload` option is inferred from its `worker.toml` file.  

  If `main` is undefined, this option is required.

- `plugins?: RollupPlugin[]`  
  Custom plugins to apply after the default plugins (but before minifying).

- `serveGlobs?: string[] | { [root: string]: string[] }`  
  Matching files are bundled with the script. Use the `serve` function (exported
  by this plugin) in your script to easily serve the bundled content with the
  proper response headers (`ETag`, `Content-Type`, `Content-Length`).  

  When an array is passed, both the `outDir` (from vite.config.js) and the 
  worker-specific `root` directory are searched for matching paths.

- `minify?: object | boolean`  
  Customize how the script is minified, or pass `false` to disable minification.

- `minifyHtml?: object | boolean`  
  Customize how inlined `.html` modules are minified, or pass `false` to disable.

- `upload?: UploadConfig`  
  When defined, the worker is uploaded after a successful build.  
  
  The `UploadConfig` type contains these values:  
    - `scriptId: string` (any name you like)
    - `accountId: string` (found on the homepage of your Cloudflare account)
    - `authToken?: string` (defaults to `process.env.CLOUDFLARE_AUTH_TOKEN`)
