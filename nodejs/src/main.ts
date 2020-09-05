declare function __non_webpack_require__(fn: string)

const fs = __non_webpack_require__('fs')

import * as JSZip from 'jszip'
import Nes from '../../src/nes/nes'
import {PadValue} from '../../src/nes/apu'
import Util from '../../src/util/util'
import AudioManager from '../../src/util/audio_manager'

import {AudioContext} from './audio_context'

const DEFAULT_MASTER_VOLUME = 0.125

const KEY_X = 27
const KEY_Z = 29
const ARROW_RIGHT = 79
const ARROW_LEFT = 80
const ARROW_DOWN = 81
const ARROW_UP = 82
const RETURN = 40
const ESCAPE = 41
const SPACE = 44

const kScanCode2PadValue: {[key: number]: number} = {
  [ARROW_RIGHT]: PadValue.R,
  [ARROW_LEFT]: PadValue.L,
  [ARROW_DOWN]: PadValue.D,
  [ARROW_UP]: PadValue.U,
  [KEY_X]: PadValue.A,
  [KEY_Z]: PadValue.B,
  [RETURN]: PadValue.START,
  [SPACE]: PadValue.SELECT,
}

function createMyApp() {
  const NS = __non_webpack_require__('node-sdl2')
  const SDL = NS.require('SDL')
  const SDL_render = NS.require('SDL_render')
  const SDL_pixels = NS.require('SDL_pixels')
  const App = NS.createAppWithFlags(SDL.SDL_InitFlags.SDL_INIT_EVERYTHING)
  const Window = NS.window

  const WIDTH = 256
  const HEIGHT = 240

  const TITLE = 'Nesemu'

  const MAX_ELAPSED_TIME = 1000 / 15

  class MyApp {
    private win: any
    private texture: any
    private pixels = new Uint8Array(WIDTH * HEIGHT * 4)
    private prevTime = 0

    private nes: Nes
    private pad = 0

    private audioManager = new AudioManager()

    constructor() {
      this.win = new Window({
        title: TITLE,
        w: WIDTH * 2,
        h: HEIGHT * 2,
      })
      this.win.on('close', () => {
        App.quit()
      })
      this.win.on('change', () => {
        this.render()
      })
      this.win.on('keydown', (key) => {
        if (key.scancode === ESCAPE)
          process.exit(0)

        const v = kScanCode2PadValue[key.scancode]
        if (v)
          this.pad |= v
      })
      this.win.on('keyup', (key) => {
        const v = kScanCode2PadValue[key.scancode]
        if (v)
          this.pad &= ~v
      })

      this.texture = this.win.render.createTexture(
        256, 240, SDL_pixels.PixelFormat.ABGR8888, SDL_render.SDL_TextureAccess.SDL_TEXTUREACCESS_STREAMING)

      this.nes = Nes.create()
    }

    public run(romData: Uint8Array): void {
      const result = this.nes.setRomData(romData)
      if (result !== true)
        throw result
      this.nes.reset()

      this.setupAudioManager()
      this.nes.setVblankCallback((leftV) => { this.onVblank(leftV) })

      this.prevTime = Date.now()
      setInterval(() => {
        const now = Date.now()
        const elapsedTime = now - this.prevTime
        this.loop(elapsedTime)
        this.prevTime = now
      }, 1000 / 100)
    }

    private loop(elapsedTime: number): void {
      this.nes.setPadStatus(0, this.pad)

      let et = Math.min(elapsedTime, MAX_ELAPSED_TIME)
      this.nes.runMilliseconds(et)
    }

    private onVblank(leftV: number) {
      if (leftV < 1)
        this.render()
      this.updateAudio()
    }

    private render(): void {
      this.nes.render(this.pixels)

      const pitch = WIDTH * 4
      this.texture.update(null, this.pixels, pitch)
      this.win.render.copy(this.texture, null, null)

      this.win.render.present()
    }

    private setupAudioManager() {
      const channelTypes = this.nes.getSoundChannelTypes()
      for (const type of channelTypes) {
        this.audioManager.addChannel(type)
      }
    }

    private updateAudio(): void {
      const audioManager = this.audioManager
      const nes = this.nes
      const count = audioManager.getChannelCount()
      for (let ch = 0; ch < count; ++ch) {
        const volume = nes.getSoundVolume(ch)
        audioManager.setChannelVolume(ch, volume)
        if (volume > 0) {
          audioManager.setChannelFrequency(ch, nes.getSoundFrequency(ch))
          audioManager.setChannelDutyRatio(ch, nes.getSoundDutyRatio(ch))
        }
      }
    }
  }

  return new MyApp()
}

function run(fileName: string) {
  // TODO: Use util.promisify
  new Promise(
    (resolve, reject) => {
      fs.readFile(fileName, (err: any, data: Buffer) => err ? reject(err) : resolve(data))
    })
    .then((data /*: Buffer*/) => {
      if (Util.getExt(fileName).toLowerCase() !== 'zip')
        return Promise.resolve(data)

      const zip = new JSZip()
      return zip.loadAsync(data)
        .then((loadedZip: JSZip) => {
          for (let fn of Object.keys(loadedZip.files)) {
            if (Util.getExt(fn).toLowerCase() === 'nes')
              return loadedZip.files[fn].async('uint8array')
          }
          return Promise.reject('No .nes file included')
        })
    })
    .then((romData /*: Uint8Array*/) => {
      const myApp = createMyApp()
      myApp.run(romData as Uint8Array)
    })
    .catch((error: any) => {
      console.error(error)
      process.exit(1)
    })
}

if (process.argv.length < 3) {
  console.error('ROMFILE')
  process.exit(1)
}

AudioManager.setUp(AudioContext)
AudioManager.setMasterVolume(DEFAULT_MASTER_VOLUME)

run(process.argv[2])
