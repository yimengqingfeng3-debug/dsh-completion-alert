"""Synthesize the built-in alert tones that ship with dsh-completion-alert.

Nothing here is taken from another product: every tone is additive synthesis
written from scratch, so the package can carry them legally. The crisps are the
"one clean ding" character the plugin's settings offer next to the meme tone.

    python synthesize_tones.py <output-dir>

Writes, for each definition, a 48 kHz mono 16-bit WAV plus an Ogg Vorbis copy
(the client decodes Ogg through Web Audio; the WAV is the inspectable master).
"""
import os
import subprocess
import sys
import wave

import numpy as np

SR = 48000


def partials_to_signal(duration, partials, noise=0.0, seed=1, click=0.0):
    """Add up exponentially decaying partials into a mono float signal."""
    n = int(SR * duration)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for freq, amp, decay, phase in partials:
        out += amp * np.sin(2 * np.pi * freq * t + phase) * np.exp(-t / decay)
    if click > 0.0:
        # A very short high band at the onset: what makes a bell read as "crisp"
        # rather than "soft". Band-limited noise, not a DC step.
        rng = np.random.default_rng(seed)
        burst = rng.standard_normal(n) * np.exp(-t / (click / 3.0))
        out += 0.18 * burst
    if noise > 0.0:
        rng = np.random.default_rng(seed + 1)
        out += noise * rng.standard_normal(n)
    return out


def one_pole_highpass(signal, cutoff):
    """Cheap first-order high pass, enough to remove rumble from the noise burst."""
    rc = 1.0 / (2 * np.pi * cutoff)
    dt = 1.0 / SR
    alpha = rc / (rc + dt)
    out = np.zeros_like(signal)
    previous_in = 0.0
    previous_out = 0.0
    for index, value in enumerate(signal):
        out[index] = alpha * (previous_out + value - previous_in)
        previous_in = value
        previous_out = out[index]
    return out


def one_pole_lowpass(signal, cutoff):
    """First-order low pass, to keep the top end from sounding like hiss."""
    rc = 1.0 / (2 * np.pi * cutoff)
    dt = 1.0 / SR
    alpha = dt / (rc + dt)
    out = np.zeros_like(signal)
    previous = 0.0
    for index, value in enumerate(signal):
        previous = previous + alpha * (value - previous)
        out[index] = previous
    return out


def normalize(signal, peak=0.72):
    highest = float(np.max(np.abs(signal)))
    if highest == 0:
        return signal
    return signal / highest * peak


def fade(signal, fade_in=0.003, fade_out=0.02):
    n = len(signal)
    in_len = max(1, int(SR * fade_in))
    out_len = max(1, int(SR * fade_out))
    signal[:in_len] *= np.linspace(0.0, 1.0, in_len)
    signal[-out_len:] *= np.linspace(1.0, 0.0, out_len)
    return signal


def hann_tail(signal, hold=0.05):
    """Hold the onset flat, then taper the last part so nothing truncates hard."""
    n = len(signal)
    hold_len = int(SR * hold)
    if hold_len >= n:
        return signal
    window = 0.5 - 0.5 * np.cos(np.pi * np.linspace(0.0, 1.0, n - hold_len))
    signal[hold_len:] *= window
    return signal


# ---------------------------------------------------------------------------
# The tones
# ---------------------------------------------------------------------------

def crisp_a():
    """Crisp A — a bright bell around E6 with inharmonic shimmer."""
    partials = [
        (1318.51, 1.00, 0.085, 0.0),     # fundamental, E6
        (2637.02, 0.42, 0.055, 0.3),     # octave
        (3951.07, 0.20, 0.035, 1.1),     # twelfth
        (5266.0, 0.10, 0.022, 2.0),      # faint inharmonic top
    ]
    signal = partials_to_signal(0.34, partials, click=0.005)
    signal = one_pole_highpass(signal, 220)
    signal = one_pole_lowpass(signal, 9000)
    return hann_tail(normalize(signal))


def crisp_b():
    """Crisp B — the same character a fifth up (B6), slightly faster decay."""
    partials = [
        (1975.53, 1.00, 0.070, 0.0),     # B6
        (3951.07, 0.36, 0.045, 0.4),
        (5921.0, 0.16, 0.030, 1.3),
    ]
    signal = partials_to_signal(0.28, partials, click=0.004)
    signal = one_pole_highpass(signal, 260)
    signal = one_pole_lowpass(signal, 9500)
    return hann_tail(normalize(signal))


TONES = {
    "crisp-a": crisp_a,
    "crisp-b": crisp_b,
}


def write_wav(path, signal):
    data = np.clip(signal, -1.0, 1.0)
    pcm = (data * 32767.0).astype("<i2")
    with wave.open(path, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(pcm.tobytes())


def write_ogg(ffmpeg, wav_path, ogg_path):
    subprocess.run(
        [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", wav_path,
         "-c:a", "libvorbis", "-q:a", "5", ogg_path],
        check=True,
    )


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    out_dir = sys.argv[1]
    ffmpeg = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out_dir, exist_ok=True)
    for tone_id, factory in TONES.items():
        signal = fade(factory())
        wav_path = os.path.join(out_dir, f"{tone_id}.wav")
        write_wav(wav_path, signal)
        print(f"{tone_id}: {len(signal) / SR:.3f}s -> {wav_path} ({os.path.getsize(wav_path)} bytes)")
        if ffmpeg:
            ogg_path = os.path.join(out_dir, f"{tone_id}.ogg")
            write_ogg(ffmpeg, wav_path, ogg_path)
            print(f"{tone_id}: ogg -> {ogg_path} ({os.path.getsize(ogg_path)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
