import { CONFIG } from "./config.js";

/**
 * A synthetic bed that follows the sequence. Nothing here is a recording of
 * Ginza and it does not claim to be: there is no field audio in this project,
 * so inventing one would be the same mistake as inventing a river section.
 *
 * The graph is built on the first gesture, because browsers will not start an
 * AudioContext without one, and because sound has to be the reader's choice.
 */
export function createAudioBed() {
  let context = null;
  let master = null;
  let drone = null;
  let bed = null;
  let started = false;
  let enabled = false;
  let latest = null;

  function ramp(param, value, seconds = 0.35) {
    if (!context) return;
    param.setTargetAtTime(value, context.currentTime, seconds);
  }

  function build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    context = new Ctx();

    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    // Two voices a fraction apart, so the tone breathes instead of sitting
    // still. The filter is what actually carries the sequence.
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = CONFIG.audio.cutoffFloor;
    filter.Q.value = 0.7;
    filter.connect(master);

    const droneGain = context.createGain();
    droneGain.gain.value = 0;
    droneGain.connect(filter);

    const voices = CONFIG.audio.voices.map((spec) => {
      const osc = context.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = spec.hz;
      const gain = context.createGain();
      gain.gain.value = spec.gain;
      osc.connect(gain).connect(droneGain);
      osc.start();
      return { osc, gain };
    });
    drone = { gain: droneGain, filter, voices };

    // A quiet band of noise for the descent. It reads as enclosure, not as
    // running water, because there is no water here to record.
    const frames = context.sampleRate * 2;
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) channel[index] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = CONFIG.audio.bedHz;
    noiseFilter.Q.value = 1.4;
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0;
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start();
    bed = { source: noise, gain: noiseGain };

    return true;
  }

  function apply(state) {
    latest = state;
    if (!context || !enabled) return;
    // Opens up as the city resolves, closes again underground.
    const openness = Math.min(1, state.progress / CONFIG.sequence.stageEnds.buildings);
    const cutoff = CONFIG.audio.cutoffFloor
      + (CONFIG.audio.cutoffCeiling - CONFIG.audio.cutoffFloor) * openness
      - CONFIG.audio.cutoffCeiling * 0.45 * (state.descentT ?? 0);
    ramp(drone.filter.frequency, Math.max(60, cutoff), 0.6);
    ramp(drone.gain.gain, CONFIG.audio.droneGain * (0.35 + 0.65 * openness), 0.5);
    ramp(bed.gain.gain, CONFIG.audio.bedGain * (state.descentT ?? 0), 0.8);
  }

  return Object.freeze({
    isEnabled: () => enabled,
    isAvailable: () => Boolean(window.AudioContext || window.webkitAudioContext),
    async toggle() {
      if (!started) {
        if (!build()) return false;
        started = true;
      }
      enabled = !enabled;
      if (enabled) {
        // Safari suspends the context until it is resumed inside the gesture.
        if (context.state === "suspended") await context.resume();
        if (latest) apply(latest);
        ramp(master.gain, CONFIG.audio.masterGain, 0.9);
      } else {
        ramp(master.gain, 0, 0.4);
      }
      return enabled;
    },
    apply,
    dispose() {
      if (!context) return;
      try {
        for (const voice of drone.voices) voice.osc.stop();
        bed.source.stop();
      } catch {
        // Already stopped; nothing to unwind.
      }
      context.close();
      context = null;
      enabled = false;
      started = false;
    },
  });
}
