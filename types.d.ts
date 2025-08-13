declare module 'request' {
  const request: any;
  export default request;
}
declare module 'archiver' {
  const archiver: any;
  export default archiver;
}
declare module 'ws' {
  export default class WebSocket {
    static Server: any;
    constructor(url: string, options?: any);
    on(event: string, cb: (...args: any[]) => void): void;
    send(data: any): void;
    close(): void;
  }
}

