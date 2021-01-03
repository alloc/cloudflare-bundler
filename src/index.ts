import type { Plugin as RollupPlugin, InputOption } from 'rollup'
import createResolvePlugin from '@rollup/plugin-node-resolve'
import createEsbuildPlugin from 'rollup-plugin-esbuild'
import { terser } from 'rollup-plugin-terser'
import { crawl } from 'recrawl-sync'
import { rollup } from 'rollup'
import toml from 'toml'
import etag from 'etag'
import path from 'path'
import fs from 'fs'
import { MimeType } from './serve/mime'
import { uploadScript } from './upload'
import { Config } from './config'

// The `serve` function is exported by "dist/index.mjs" only.
export type { serve } from './serve'

const namingRules = /^[a-z]([a-z0-9_-]{0,61}[a-z0-9])?$/i

export async function bundleWorker(config: Config) {
  let { root = '', main } = config
  root = path.resolve(root)

  if (config.root) {
    if (!main) {
      const workerPkgPath = path.join(config.root, 'package.json')

      if (!fs.existsSync(workerPkgPath))
        throw Error(
          `The "main" option must be defined if no package.json exists`
        )

      const workerPkg = JSON.parse(fs.readFileSync(workerPkgPath, 'utf8'))
      main = findFile(config.root, [workerPkg.main, 'index.ts', 'index.js'])

      if (!main)
        throw Error(`The "main" module from package.json could not be found`)
    }

    if (config.upload === true || config.upload == null) {
      const workerInfoPath = path.join(config.root, 'wrangler.toml')

      if (!fs.existsSync(workerInfoPath))
        throw Error(`Cannot find wrangler.toml`)

      const {
        name: scriptId,
        account_id: accountId,
        type: workerType,
      } = toml.parse(fs.readFileSync(workerInfoPath, 'utf8'))

      if (!scriptId) {
        throw Error(`Missing "name" in wrangler.toml`)
      }
      if (!accountId) {
        throw Error(`Missing "account_id" in wrangler.toml`)
      }
      if (workerType && workerType !== 'javascript') {
        throw Error(`Unsupported worker type: "${workerType}"`)
      }

      config.upload = { scriptId, accountId }
    }
  } else {
    if (!main) {
      throw Error(`Expected "main" or "root" option to be defined`)
    }
    if (config.upload === true) {
      throw Error(`Cannot use "upload: true" without "root" option`)
    }
  }

  main = path.resolve(root, main)

  let input: InputOption = main
  if (config.root) {
    const name = path.basename(config.root)
    input = { [name]: main }
  }

  const uploadConfig = config.upload
  if (uploadConfig && !namingRules.test(uploadConfig.scriptId))
    throw Error(
      `Invalid name for Cloudflare worker: "${uploadConfig.scriptId}"\n\n` +
        `  Script identifiers must:\n` +
        [
          `start with a letter`,
          `end with a letter or digit`,
          `include only letters, digits, underscore, and hyphen`,
          `be 63 or fewer characters`,
        ]
          .map(line => `    ➤ ` + line)
          .join('\n') +
        '\n'
    )

  const authToken = uploadConfig
    ? uploadConfig.authToken || process.env.CLOUDFLARE_AUTH_TOKEN
    : null

  const workerBundle = await rollup({
    input,
    plugins: [
      createEsbuildPlugin({
        target: 'esnext',
        sourceMap: true,
        loaders: {
          '.ts': 'ts',
          '.js': 'js',
          '.mjs': 'js',
          '.json': 'json',
        },
      }),
      createResolvePlugin({
        extensions: ['.ts', '.mjs', '.js', '.json'],
      }),
      createServePlugin(root, config),
      ...(config.plugins || []),
      config.minify !== false &&
        (terser(config.minify === true ? {} : config.minify) as any),
    ],
  })

  const { output } = await workerBundle.generate({
    format: 'cjs',
    sourcemap: true,
  })

  const workerChunk = output[0]

  if (uploadConfig) {
    if (authToken) {
      try {
        await uploadScript(workerChunk.code, {
          ...uploadConfig,
          authToken,
        })
      } catch (err) {
        console.error(
          `Cloudflare worker "${uploadConfig.scriptId}" failed to upload. ` +
            err.message
        )
      }
    } else {
      console.warn('Cannot upload Cloudflare worker without auth token')
    }
  }

  return workerChunk
}

function createServePlugin(root: string, config: Config): RollupPlugin {
  const { serveGlobs } = config
  const globsByDir = Array.isArray(serveGlobs)
    ? { [root]: serveGlobs }
    : serveGlobs || {}

  const assetsId = '\0_worker_assets.js'
  const servePath = path.join(__dirname, 'index.mjs')
  return {
    name: 'cloudflare-worker:serve',
    resolveId(id, parent) {
      if (id == './assets' && parent == servePath) {
        if (serveGlobs) {
          return assetsId
        }
        throw Error('Must set "serveGlobs" before using "serve" function')
      }
    },
    load(id) {
      if (id == assetsId) {
        let lines = ['export default {']
        for (const dir in globsByDir) {
          crawl(path.resolve(root, dir), {
            only: globsByDir[dir],
          }).forEach(file =>
            lines.push(`  '${file}': ${inlineAsset(dir, file, config)},`)
          )
        }
        lines.push('}')
        return lines.join('\n')
      }
    },
  }
}

function inlineAsset(root: string, file: string, config: Config) {
  // Assume UTF-8 encoding.
  let text = fs.readFileSync(path.join(root, file), 'utf8')

  const mime = getMimeType(file)
  if (mime == MimeType.HTML && config.minifyHtml !== false)
    text = require('html-minifier').minify(text, {
      collapseWhitespace: true,
      ...(config.minifyHtml as any),
    })

  // Cache the byte length before escaping and after minifying.
  const numBytes = Buffer.from(text).byteLength

  // Escape any newlines or single quotes.
  text = text.replace(/(['\n\r])/g, ch => escapeMap[ch])

  // [etag, mime, numBytes, getText]
  return `['${etag(text)}', ${mime}, ${numBytes}, () => '${text}']`
}

const escapeMap: any = {
  '\n': '\\n',
  '\r': '\\r',
  '\'': '\\\'', // prettier-ignore
}

function getMimeType(file: string) {
  const ext = path.extname(file)
  return ext == '.html' ? MimeType.HTML : MimeType.TXT
}

function findFile(root: string, names: string[]) {
  return names.find(name => fs.existsSync(path.join(root, name)))
}
