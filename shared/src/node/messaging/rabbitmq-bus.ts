import amqp, { Channel, ConsumeMessage } from "amqplib";
import { Logger } from "../utils/logger.js";
import { BaseEvent } from "../../events/base-event";
import { EventType } from "../../events/event-types";


type EventHandler = (event: BaseEvent) => Promise<void>;

export class RabbitMQBus {
  private connection: any = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private handlers: Map<string, EventHandler[]> = new Map();

  constructor(private url: string = process.env.RABBITMQ_URL || "amqp://localhost") { }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      this.isConnected = true;
      Logger.info("Connected to RabbitMQ");

      this.connection?.on("error", (err: any) => {
        Logger.error("RabbitMQ connection error", err);
        this.isConnected = false;
        this.reconnect();
      });

      this.connection?.on("close", () => {
        Logger.warn("RabbitMQ connection closed");
        this.isConnected = false;
        this.reconnect();
      });
    } catch (error) {
      Logger.error("Failed to connect to RabbitMQ", error);
      this.reconnect();
    }
  }

  private async reconnect(): Promise<void> {
    setTimeout(() => {
      Logger.info("Reconnecting to RabbitMQ...");
      this.connect();
    }, 5000);
  }

  async publish(event: BaseEvent): Promise<void> {
    if (!this.isConnected || !this.channel) {
      Logger.error(`RabbitMQ not connected, cannot publish event ${event.type}`);
      throw new Error(`RabbitMQ not connected, cannot publish event ${event.type}`);
    }

    try {
      const exchange = "citymarket_events";
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("RabbitMQ publish timeout")), 3000)
      );
      await Promise.race([
        this.channel.assertExchange(exchange, "topic", { durable: true }),
        timeout,
      ]);
      this.channel.publish(exchange, event.type, Buffer.from(JSON.stringify(event)));
      Logger.info(`Published event ${event.type}`);
    } catch (error) {
      Logger.error(`Failed to publish event ${event.type}`, error);
      throw error;
    }
  }

  async subscribe(eventType: EventType, queueName: string, handler: EventHandler): Promise<void> {
    if (!this.channel) {
      await this.connect();
    }

    if (!this.channel) {
      Logger.error("RabbitMQ channel not available for subscription");
      return;
    }

    const exchange = "citymarket_events";
    const dlx = "citymarket_events_dlx"; // Dead Letter Exchange
    const dlq = `${queueName}_dlq`; // Dead Letter Queue

    await this.channel.assertExchange(exchange, "topic", { durable: true });
    await this.channel.assertExchange(dlx, "topic", { durable: true });

    // Assert DLQ and bind to DLX
    await this.channel.assertQueue(dlq, { durable: true });
    await this.channel.bindQueue(dlq, dlx, eventType);

    // Assert main queue with DLX configuration
    await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": dlx,
      }
    });
    await this.channel.bindQueue(queueName, exchange, eventType);

    if (!this.handlers.has(queueName)) {
      this.handlers.set(queueName, []);

      await this.channel.consume(queueName, async (msg: ConsumeMessage | null) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            const handlers = this.handlers.get(queueName) || [];
            for (const h of handlers) {
              await h(content);
            }
            this.channel?.ack(msg);
          } catch (error: any) {
            Logger.error(`Error processing message from ${queueName}`, error);

            // Check if it's a validation error (terminal, don't retry)
            // or if it has already been redelivered
            if (error.name === "ValidationError" || msg.fields.redelivered) {
              Logger.warn(`Message from ${queueName} sending to DLQ due to terminal failure or max retries.`);
              // Reject without requeue, will go to DLX -> DLQ
              this.channel?.nack(msg, false, false);
            } else {
              Logger.warn(`Message from ${queueName} requeuing for retry.`);
              // Requeue for retry
              this.channel?.nack(msg, false, true);
            }
          }
        }
      });
    }

    this.handlers.get(queueName)!.push(handler);
    Logger.info(`Subscribed to ${eventType} on queue ${queueName}`);
  }
}

export const rabbitMQBus = new RabbitMQBus();
