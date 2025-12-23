export type PlayerType = "human" | "bot";

export class Player {
  public readonly id: string;
  public readonly username: string;
  public readonly type: PlayerType;

  constructor(id: string, username: string, type: PlayerType = "human") {
    this.id = id;
    this.username = username;
    this.type = type;
  }

  isBot(): boolean {
    return this.type === "bot";
  }

  isHuman(): boolean {
    return this.type === "human";
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      type: this.type,
    };
  }
}
