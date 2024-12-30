declare module './slang/slang-wasm' {
  export interface SlangModule {
      getLastError(): { type: string; message: string };
      createGlobalSession(): any;
  }
  function init(): Promise<SlangModule>;
  export default init;
}