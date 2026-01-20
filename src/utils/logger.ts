export class Logger {
    constructor(private verbose: boolean = false) { }

    debug(message: string, ...args: any[]): void {
        if (this.verbose) {
            console.debug(`[BusyTeX Debug] ${message}`, ...args);
        }
    }

    info(message: string, ...args: any[]): void {
        console.info(`[BusyTeX] ${message}`, ...args);
    }

    warn(message: string, ...args: any[]): void {
        console.warn(`[BusyTeX Warning] ${message}`, ...args);
    }

    error(message: string, ...args: any[]): void {
        console.error(`[BusyTeX Error] ${message}`, ...args);
    }
}