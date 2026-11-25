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
    audio.onError(() => {
      if (this.music === audio) this.stopMusic();
    });
    audio.onPlay(() => {
      if (this.music === audio) this.musicKey = key;
    });
    this.music = audio;
    try {
      audio.play();
    } catch {
      this.stopMusic();
    }
  }

  stopMusic(): void {
    const audio = this.music;
    this.music = null;
    this.musicKey = null;
    if (!audio) return;
    try {
      audio.stop();
    } catch {
      // 忽略重复停止
    }
    try {
      audio.destroy();
    } catch {
      // 忽略重复销毁
    }
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
