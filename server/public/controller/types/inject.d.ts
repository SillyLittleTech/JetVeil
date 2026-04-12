import type { CookieJar, ScramjetConfig } from "@mercuryworkshop/scramjet";
declare const CookieJar: typeof CookieJar;
type Config = any;
type Init = {
    config: Config;
    sjconfig: ScramjetConfig;
    cookies: string;
    prefix: URL;
    yieldGetInjectScripts: (cookieJar: CookieJar, config: Config, sjconfig: ScramjetConfig, prefix: URL) => any;
    codecEncode: (input: string) => string;
    codecDecode: (input: string) => string;
};
export declare function load({ config, sjconfig, cookies, prefix, yieldGetInjectScripts, codecEncode, codecDecode, }: Init): void;
export {};
