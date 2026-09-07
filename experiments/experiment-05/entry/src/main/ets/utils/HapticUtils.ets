import { vibrator } from '@kit.SensorServiceKit';

export function keyHaptic(enabled: boolean): void {
  if (!enabled) { return; }
  try {
    vibrator.startVibration({ type: 'time', duration: 12 }, { usage: 'touch' }).catch(() => {});
  } catch (_) {
    // Devices without a vibrator must still accept the key press.
  }
}
