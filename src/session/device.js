// A phone is a coarse pointer that cannot hover. Deliberately not
// useTouchInput: that also fires for a desktop with no Web MIDI, and the desk
// run must stay the desk run.
export function isPhone() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: coarse) and (hover: none)').matches
}
