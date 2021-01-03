import type { Plugin as RollupPlugin } from 'rollup'
import type { Options as HtmlMinifyOptions } from 'html-minifier'
import type { Options as TerserOptions } from 'rollup-plugin-terser'

export type Config = {
  /**
   * The worker's package root.
   *
   * The `package.json` and `wrangler.toml` files of this directory are
   * loaded if they exist.
   *
   * @default process.cwd()
   */
  root?: string
  /**
   * Entry module in JavaScript or TypeScript.
   *
   * Only required if `root` option is undefined.
   */
  main?: string
  /**
   * Where to save the sourcemap.
   */
  sourceMapPath?: string
  /**
   * Custom plugins to apply after the default plugins.
   */
  plugins?: RollupPlugin[]
  /**
   * Matching files are bundled with the script, and served
   * by the `serve` function exported by this plugin.
   *
   * When you pass an object, its keys are used as the root
   * directory to crawl in search of paths matching the given globs.
   *
   * By default, globs are relative to the `root` option.
   */
  serveGlobs?: string[] | { [root: string]: string[] }
  /**
   * Control how the script is minified.
   *
   * @default true
   */
  minify?: TerserOptions | boolean
  /**
   * Control how `.html` modules are minified.
   *
   * @default true
   */
  minifyHtml?: HtmlMinifyOptions | boolean
  /**
   * Upload the bundled worker after a successful build, using the
   * Cloudflare API.
   *
   * When `true`, the `root` option must be defined and its
   * `wrangler.toml` file must contain `name` and `account_id`.
   */
  upload?: UploadConfig | boolean
}

export type UploadConfig = {
  /**
   * The script identifier on Cloudflare.
   */
  scriptId: string
  /**
   * The account identifier on Cloudflare.
   */
  accountId: string
  /**
   * Passed in `Authorization` header to Cloudflare API
   * @default process.env.CLOUDFLARE_AUTH_TOKEN
   */
  authToken?: string
}
