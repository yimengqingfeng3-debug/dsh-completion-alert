"""Synthesize the built-in alert tones that ship with dsh-completion-alert.

Nothing here is taken from another product: every tone is additive synthesis
written from scratch, so the package can carry them legally.

The two "system" tones are modelled on *measured facts* about the sounds people
recognise, not on a recording of them:

* `crisp-a` — the two-note ascending payment chime. Measured from reference
  material: two notes an octave apart, the lower one short (~80 ms at the
  strike) and the upper one long (~430 ms), onsets ~135 ms apart, bright and
  decisive with a fast decay.
* `crisp-b` — the three-note ascending message tone. Facts from the sound's own
  history (Kelly Jacklin, "158-marimba", 1999): a marimba patch on a Yamaha XG
  module, three ascending scale degrees as straight eighth notes, no fancy
  timing. Measuring the recognisable iOS version shows the fundamentals
  D4 -> A4 -> D5 with the 3rd and 5th partials prominent and decaying faster
  than the fundamental — which is exactly what makes a marimba read as one.

    python synthesize_tones.py <output-dir> [ffmpeg]

Writes, for each definition, a 48 kHz mono 16-bit WAV plus an Ogg Vorbis copy
(the client decodes Ogg through Web Audio; the WAV is the inspectable master).
"""
import os
import subprocess
import sys
import wave

import numpy as np

SR = 48000


def one_pole_highpass(signal, cutoff):
    """Cheap first-order high pass, to remove rumble."""
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


def fade(signal, fade_in=0.002, fade_out=0.02):
    n = len(signal)
    in_len = max(1, int(SR * fade_in))
    out_len = max(1, int(SR * fade_out))
    signal[:in_len] *= np.linspace(0.0, 1.0, in_len)
    signal[-out_len:] *= np.linspace(1.0, 0.0, out_len)
    return signal


def trim_tail(signal, fade_out=0.025):
    """Fade only the last few milliseconds, so the file does not end on a step.

    No whole-track shaping: a struck note already decays to nothing, and any
    window applied across the track would land on a note's attack and turn it
    into a swell.
    """
    n = len(signal)
    out_len = max(1, int(SR * fade_out))
    signal[-out_len:] *= np.linspace(1.0, 0.0, out_len)
    return signal


# ---------------------------------------------------------------------------
# Building blocks
# ---------------------------------------------------------------------------

def marimba_note(freq, duration, amplitude=1.0):
    """One struck marimba bar.

    A marimba bar is tuned so its upper partials are not a plain harmonic stack,
    and its resonator tube reinforces the 3rd partial: the sound reads as a fifth
    above at the strike and settles onto the fundamental as the upper partials
    die away first. The reference measurement shows exactly that (A4 and D5
    present on a D4 strike, gone well before the fundamental).
    """
    n = int(SR * duration)
    t = np.arange(n) / SR
    partials = [
        (freq, 1.00, 0.075, 0.0),        # fundamental
        (freq * 3.0, 0.34, 0.045, 0.4),  # 3rd partial: the "fifth" of the strike
        (freq * 5.0, 0.18, 0.030, 1.1),
        (freq * 2.0, 0.14, 0.028, 2.2),
        (freq * 7.0, 0.06, 0.020, 0.8),
    ]
    out = np.zeros(n)
    for partial, amp, tau, phase in partials:
        # A dB-linear fall: loud from the first sample, then a steady decay.
        # A plain exp(-t / tau) in linear amplitude stays near its peak for the
        # first tau, which reads as a swell instead of a strike on a short note.
        out += amp * np.sin(2 * np.pi * partial * t + phase) * 10 ** (-3.0 * t / tau)
    # A very short wooden knock at the onset.
    rng = np.random.default_rng(int(freq) % 9973 + 1)
    out += 0.10 * rng.standard_normal(n) * np.exp(-t / 0.0015)
    out[-int(SR * 0.01):] *= np.linspace(1.0, 0.0, int(SR * 0.01))
    return amplitude * out


def bell_note(freq, duration, amplitude=1.0, decay=0.30):
    """One bright chime: the character a system confirmation sound has.

    Same strike rule as the marimba: a dB-linear fall, so the note peaks at its
    attack. A linear `exp(-t / tau)` on a note only a few tau long reads as a
    swell out of silence, which is the opposite of a chime.
    """
    n = int(SR * duration)
    t = np.arange(n) / SR
    partials = [
        (freq, 1.00, decay, 0.0),
        (freq * 2.0, 0.30, decay * 0.6, 0.8),
        (freq * 3.0, 0.10, decay * 0.35, 1.6),
        (freq * 4.02, 0.05, decay * 0.25, 2.4),  # slightly inharmonic: bell, not organ
    ]
    out = np.zeros(n)
    for partial, amp, tau, phase in partials:
        out += amp * np.sin(2 * np.pi * partial * t + phase) * 10 ** (-3.2 * t / tau)
    rng = np.random.default_rng(int(freq) % 7919 + 3)
    out += 0.08 * rng.standard_normal(n) * np.exp(-t / 0.0025)
    out[-int(SR * 0.01):] *= np.linspace(1.0, 0.0, int(SR * 0.01))
    return amplitude * out


def place(track, signal, at_seconds):
    """Mix one note into the track at a sample offset."""
    begin = int(at_seconds * SR)
    end = min(len(track), begin + len(signal))
    if begin >= len(track) or end <= begin:
        return track
    track[begin:end] += signal[: end - begin]
    return track


# ---------------------------------------------------------------------------
# The tones
# ---------------------------------------------------------------------------

def payment_chime():
    """Two ascending notes an octave apart — the payment confirmation shape.

    Measured: lower note short, upper note long, onsets ~135 ms apart, total
    well under a second. The pitches sit a full tone below the widest reference
    so the tone carries in a normal notification register.
    """
    track = np.zeros(int(SR * 0.50))
    lower = 1479.98   # F#6: the reference pair a touch lower, so it carries
    upper = 2959.96   # F#7
    place(track, bell_note(lower, 0.16, amplitude=0.70, decay=0.055), 0.0)
    place(track, bell_note(upper, 0.46, amplitude=1.00, decay=0.20), 0.135)
    track = one_pole_highpass(track, 320)
    track = one_pole_lowpass(track, 11000)
    return fade(trim_tail(normalize(track, 0.78)))


def message_tone():
    """Three ascending marimba notes — the message-alert shape.

    Facts: a marimba patch, straight eighth notes, ascending I-V-VIII. The
    pitches are the ones the recognisable version measures at; the spacing is a
    musical eighth at a notification tempo.
    """
    track = np.zeros(int(SR * 0.58))
    notes = [
        (293.66, 0.000, 0.26, 1.00),  # D4
        (440.00, 0.150, 0.26, 0.95),  # A4
        (587.33, 0.300, 0.45, 0.90),  # D5, the one that rings
    ]
    for freq, at, length, gain in notes:
        place(track, marimba_note(freq, length, amplitude=gain), at)
    track = one_pole_highpass(track, 180)
    track = one_pole_lowpass(track, 9000)
    return fade(trim_tail(normalize(track, 0.76)))


TONES = {
    "crisp-a": payment_chime,
    "crisp-b": message_tone,
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
        signal = factory()
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
