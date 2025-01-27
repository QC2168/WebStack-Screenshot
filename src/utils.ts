/* eslint-disable @typescript-eslint/no-explicit-any */
import { tmpdir } from 'os'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { PuppeteerLifeCycleEvent, ScreenshotClip, ScreenshotOptions } from 'puppeteer-core'
import { args } from './args'
import { TlaunchOptions, TtypeOptions } from './types'

const { WEBSTACK_SCREENSHOT_SERVERLESS, WEBSTACK_SCREENSHOT_FONTS, WEBSTACK_SCREENSHOT_PUPPETEER_EXECUTABLE_PATH } =
  process.env

const TMP_DIR_PATH = join(tmpdir(), 'WebStack-Screenshot')
if (!existsSync(TMP_DIR_PATH)) mkdirSync(TMP_DIR_PATH, { recursive: true })

export function isBoolean(value: string | boolean) {
  return value === 'true' || value === true ? true : false
}

export function isNumber(value: number) {
  return !isNaN(value)
}

export function isHttp(url: string) {
  return /^https?:\/\//.test(url)
}

export const isValidKey = (key: string, object: object): key is keyof typeof object => key in object

export function deepClone(data: any): { [key: string]: any } {
  try {
    return JSON.parse(JSON.stringify(data))
  } catch (error) {
    return {}
  }
}

export function parseClip(clip:string): ScreenshotClip {
  const [x = '0', y = '0', width = '0', height = '0'] = clip.split(',').map((part) => part.trim())

  return {
    x: parseInt(x),
    y: parseInt(y),
    width: parseInt(width),
    height: parseInt(height)
  }
}

export async function launch() {
  const options: TlaunchOptions = {
    args,
    defaultViewport: {
      height: 1080,
      width: 1920
    }
  }

  // lambda (ServerLess)
  const lambdaOptions = options
  if (WEBSTACK_SCREENSHOT_SERVERLESS) {
    const chromium = (await import('@sparticuz/chromium')).default
    // install font
    if (WEBSTACK_SCREENSHOT_FONTS) {
      const fonts = (WEBSTACK_SCREENSHOT_FONTS || '').split(',').filter(Boolean)
      await Promise.all(fonts.map((font) => chromium.font(font)))
    }
    lambdaOptions.executablePath = await chromium.executablePath()
    return lambdaOptions
  }

  // local (Server)
  const localOptions = options
  const { executablePath } = (await import('puppeteer'))
  localOptions.executablePath = executablePath()
  if (WEBSTACK_SCREENSHOT_PUPPETEER_EXECUTABLE_PATH) {
    localOptions.executablePath = WEBSTACK_SCREENSHOT_PUPPETEER_EXECUTABLE_PATH
  }

  return localOptions
}

export function goto(data: { [x: string]: any; timeout?: any; await?: any; waitUntil?: any }) {
  const options: { timeout?: number; await?: number; waitUntil?: PuppeteerLifeCycleEvent } = {}

  // Timeout, default 30s
  if (isNumber(data.timeout)) {
    options.timeout = Math.abs(data.timeout) ?? 30000
  }

  // Wait after the page is rendered (milliseconds)
  if (isNumber(data.await)) options.await = Math.abs(data.await) || 0

  // When do you trigger the screenshot?
  const waitUntils = [
    'load', // When the load event is triggered
    'domcontentloaded', // On DOMContentLoaded event trigger
    'networkidle0', // When there are no website requests within 500ms
    'networkidle2' // When there are only 2 requests within 500ms
  ]
  options.waitUntil = waitUntils.includes(data.waitUntil) ? data.waitUntil : waitUntils[0]

  return options
}

export function screenshot(data: TtypeOptions) {
  const { quality = 80, type = 'jpeg', encoding = 'binary', fullPage = false, clip } = data
  const options: ScreenshotOptions = {}

  // Image quality between 0-100, ignored if the image type is png
  options.quality = quality
  options.type = type

  options.encoding = encoding

  // Screenshot of the full page
  options.fullPage = fullPage

  // Intercepts the specified coordinates and width and height
  if (clip){
    options.clip = parseClip(clip)
  }
  return options
}

export function cache(cache: number | boolean) {
  // Do not use http forced caching
  if ((cache as unknown as string) === 'false') return

  const sec = Math.abs(cache as number)
  const daySec = 86400
  const cacheKey = 'public, no-transform, s-maxage=$, max-age=$'

  // eslint-disable-next-line eqeqeq
  if (cache == void 0) return cacheKey.replace(/\$/g, daySec as unknown as string)

  if (isNumber(sec)) return cacheKey.replace(/\$/g, sec as unknown as string)
}
