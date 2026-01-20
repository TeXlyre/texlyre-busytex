export class ErrorHandler {
    static handle(error: unknown, context?: string): Error {
        const message = this.getMessage(error);
        const fullMessage = context ? `${context}: ${message}` : message;
        return new Error(fullMessage);
    }

    static getMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
}