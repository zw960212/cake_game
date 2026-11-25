export type AudioSource = (key: string) => string | undefined;

export class AudioService {
  private music: any = null;
  private musicKey: string | null = null;
  private soundEnabled = true;
  private musicEnabled = true;

  constructor(private readonly source: AudioSource) {}

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (!enabled) this.stopMusic();
  }

  playMusic(key: string): void {
    if (!this.musicEnabled || this.musicKey === key) return;
    const src = this.source(key);
    if (!src) return;

    this.stopMusic();
    const audio = wx.createInnerAudioContext();
    audio.src = src;
    audio.loop = true;
    audio.onError(() => this.stopMusic());
    audio.play();
    this.music = audio;
    this.musicKey = key;
  }

  stopMusic(): void {
    if (this.music) {
      this.music.stop();
      this.music.destroy();
    }
    this.music = null;
    this.musicKey = null;
  }

  playSfx(key: string): void {
    if (!this.soundEnabled) return;
    const src = this.source(key);
    if (!src) return;

    const audio = wx.createInnerAudioContext();
    audio.src = src;
    audio.onEnded(() => audio.destroy());
    audio.onError(() => audio.destroy());
    audio.play();
  }
}
