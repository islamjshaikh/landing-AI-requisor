declare module 'baffle' {
  interface BaffleOptions {
    characters?: string;
    exclude?: string[];
    speed?: number;
  }

  interface BaffleInstance {
    start(): BaffleInstance;
    stop(): BaffleInstance;
    reveal(duration?: number, delay?: number): BaffleInstance;
    set(options: BaffleOptions): BaffleInstance;
    text(callback: (text: string) => string): BaffleInstance;
  }

  function baffle(elements: string | Element | NodeList | Element[], options?: BaffleOptions): BaffleInstance;
  
  export default baffle;
}
