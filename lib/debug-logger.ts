import fs from "fs";
import path from "path";

export type DebugLogEntry = {
  timestamp: string;
  step: string;
  phase: string;
  data: Record<string, any>;
  sessionId?: string;
};

class DebugLogger {
  private logFilePath: string;
  private enabled: boolean;
  private sessionId: string;

  constructor() {
    this.enabled = process.env.CHAT_DEBUG_MODE === "true";
    this.logFilePath = path.join(
      process.cwd(),
      "logs",
      "chat-debug.jsonl"
    );
    this.sessionId = this.generateSessionId();

    if (this.enabled) {
      this.ensureLogDirectory();
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(step: string, phase: string, data: Record<string, any>): void {
    if (!this.enabled) return;

    const entry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      step,
      phase,
      data,
      sessionId: this.sessionId,
    };

    try {
      const jsonLine = JSON.stringify(entry) + "\n";
      fs.appendFileSync(this.logFilePath, jsonLine, "utf8");
    } catch (error) {
      console.error("Failed to write debug log:", error);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // Helper method to create a scoped logger for a specific request
  createRequestLogger(requestId: string): RequestDebugLogger {
    return new RequestDebugLogger(this, requestId);
  }
}

class RequestDebugLogger {
  constructor(
    private logger: DebugLogger,
    private requestId: string
  ) {}

  log(step: string, phase: string, data: Record<string, any>): void {
    this.logger.log(step, phase, {
      ...data,
      requestId: this.requestId,
    });
  }

  isEnabled(): boolean {
    return this.logger.isEnabled();
  }
}

// Singleton instance
export const debugLogger = new DebugLogger();
