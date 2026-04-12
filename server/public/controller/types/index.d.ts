import { RpcHelper } from "@mercuryworkshop/rpc";
import type * as ScramjetGlobal from "@mercuryworkshop/scramjet";
import { type Controllerbound, type SWbound } from "./types";
import { type ProxyTransport } from "@mercuryworkshop/proxy-transports";
type Config = {
    wasmPath: string;
    injectPath: string;
    scramjetPath: string;
    virtualWasmPath: string;
    prefix: string;
};
export declare const config: Config;
type ControllerInit = {
    serviceworker: ServiceWorker;
    transport: ProxyTransport;
};
export declare class Controller {
    init: ControllerInit;
    id: string;
    prefix: string;
    frames: Frame[];
    cookieJar: ScramjetGlobal.CookieJar;
    rpc: RpcHelper<Controllerbound, SWbound>;
    private ready;
    private readyResolve;
    isReady: boolean;
    transport: ProxyTransport;
    private methods;
    constructor(init: ControllerInit);
    createFrame(element?: HTMLIFrameElement): Frame;
    wait(): Promise<void>;
}
declare class Frame {
    controller: Controller;
    element: HTMLIFrameElement;
    fetchHandler: ScramjetGlobal.ScramjetFetchHandler;
    id: string;
    prefix: string;
    get context(): ScramjetGlobal.ScramjetContext;
    constructor(controller: Controller, element: HTMLIFrameElement);
    go(url: string): void;
}
export {};
