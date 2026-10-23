import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
const exec = promisify(execFile);
/** On-host macOS/Linux speech fallback. No shell, paid speech API, or text logging. */
export class LocalVoice {
  private clips = new Map<string, { audio: Buffer; expires: number }>();
  private running = 0;
  private calls: number[] = [];
  async create(text: string) {
    if (!["darwin", "linux"].includes(process.platform))
      throw new Error(
        "Local speech fallback needs macOS. Install an offline Android voice or use a browser with speech support.",
      );
    this.calls = this.calls.filter((n) => Date.now() - n < 60000);
    for (const [id, clip] of this.clips)
      if (clip.expires < Date.now()) this.clips.delete(id);
    if (this.running >= 2 || this.calls.length >= 12)
      throw new Error("Read aloud is busy. Please try again shortly.");
    this.running++;
    this.calls.push(Date.now());
    let dir: string | undefined;
    try {
      dir = await mkdtemp(join(tmpdir(), "handback-voice-"));
      const input = join(dir, "text.txt"),
        aiff = join(dir, "voice.aiff"),
        wav = join(dir, "voice.wav");
      await writeFile(input, text, { mode: 0o600 });
      if (process.platform === "darwin") {
        await exec(
          "/usr/bin/say",
          [
            "-v",
            "Samantha (English (US))",
            "-r",
            "155",
            "-f",
            input,
            "-o",
            aiff,
          ],
          { timeout: 20000 },
        );
        await exec(
          "/usr/bin/afconvert",
          ["-f", "WAVE", "-d", "LEI16", aiff, wav],
          { timeout: 8000 },
        );
      } else {
        await exec(
          "/usr/bin/espeak-ng",
          ["-v", "en-gb", "-s", "155", "-f", input, "-w", wav],
          { timeout: 20000 },
        );
      }
      const audio = await readFile(wav),
        id = randomBytes(16).toString("hex"),
        expires = Date.now() + 120000;
      if (audio.length > 8_000_000) throw new Error("Speech clip is too long");
      this.clips.set(id, { audio, expires });
      if (this.clips.size > 8)
        this.clips.delete(this.clips.keys().next().value!);
      return {
        path: `/api/voice/${id}`,
        expiresAt: new Date(expires).toISOString(),
        engine:
          process.platform === "darwin"
            ? "macOS local Samantha"
            : "local eSpeak NG",
      };
    } finally {
      this.running--;
      if (dir) await rm(dir, { recursive: true, force: true });
    }
  }
  audio(id: string) {
    const clip = this.clips.get(id);
    if (!clip || clip.expires < Date.now()) {
      this.clips.delete(id);
      return undefined;
    }
    return clip.audio;
  }
}
