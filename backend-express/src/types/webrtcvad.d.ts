declare module "@ennuicastr/webrtcvad.js" {
  export interface WebrtcVadModule {
    _WebRtcVad_Create: () => number;
    _WebRtcVad_Init: (vad: number) => number;
    _WebRtcVad_set_mode: (vad: number, mode: number) => number;
    _WebRtcVad_Process: (
      vad: number,
      sampleRate: number,
      framePtr: number,
      frameSamples: number
    ) => number;
    _WebRtcVad_Free: (vad: number) => void;
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    HEAP16: Int16Array;
  }
  const factory: () => Promise<WebrtcVadModule>;
  export default factory;
}
