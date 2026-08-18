const amqp = require("amqplib");
const crypto = require("crypto");
const { sendSignupOtp, sendResetPasswordOtp } = require("./sendgrid");

let connection = null;
let channel = null;

const PRIMARY_QUEUE = "email_queue";
const RETRY_QUEUE = "email_retry_queue";
const DLQ_QUEUE = "email_dead_letter_queue";

const MAX_RETRIES = parseInt(process.env.QUEUE_MAX_RETRIES || "3", 10);
const RETRY_DELAY_MS = parseInt(process.env.QUEUE_RETRY_DELAY_MS || "5000", 10);

// In-Memory Idempotency Cache to prevent duplicate email delivery (stores jobId -> timestamp)
const processedJobs = new Map();
const IDEMPOTENCY_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Periodic cleanup of expired idempotency keys (runs every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [jobId, timestamp] of processedJobs.entries()) {
    if (now - timestamp > IDEMPOTENCY_TTL_MS) {
      processedJobs.delete(jobId);
    }
  }
}, 10 * 60 * 1000);

/**
 * Initialize RabbitMQ connection with ConfirmChannel, Queues, and Consumer
 */
async function initRabbitMQ() {
  const rabbitUrl = process.env.RABBITMQ_URL || process.env.CLOUDAMQP_URL || process.env.AMAZON_MQ_URL;

  if (!rabbitUrl) {
    console.warn("[RabbitMQ Warning] RABBITMQ_URL / CLOUDAMQP_URL is not set. Emails will fall back to direct sync dispatch.");
    return false;
  }

  try {
    console.log("[RabbitMQ] Connecting to RabbitMQ / CloudAMQP broker with ConfirmChannel...");
    connection = await amqp.connect(rabbitUrl);

    // Use ConfirmChannel for publisher ACK guarantees
    channel = await connection.createConfirmChannel();

    // 1. Primary Queue: Where new jobs enter and Consumer listens
    await channel.assertQueue(PRIMARY_QUEUE, { durable: true });

    // 2. Dead Letter Queue (DLQ): Stores permanently failed messages after max retries
    await channel.assertQueue(DLQ_QUEUE, { durable: true });

    // 3. Retry Queue: Holds failed messages for TTL (5s) before auto-dead-lettering back to email_queue
    await channel.assertQueue(RETRY_QUEUE, {
      durable: true,
      arguments: {
        "x-message-ttl": RETRY_DELAY_MS, // Hold message for 5000 ms
        "x-dead-letter-exchange": "",    // Route back to default exchange
        "x-dead-letter-routing-key": PRIMARY_QUEUE, // Route back to email_queue
      },
    });

    console.log(`[RabbitMQ Topology & ConfirmChannel Initialized]`);
    console.log(`  └─ Primary Queue : '${PRIMARY_QUEUE}'`);
    console.log(`  └─ Retry Queue   : '${RETRY_QUEUE}' (TTL = ${RETRY_DELAY_MS / 1000}s -> '${PRIMARY_QUEUE}')`);
    console.log(`  └─ Dead Letter Q : '${DLQ_QUEUE}' (Max Retries = ${MAX_RETRIES})`);

    // Connection event listeners
    connection.on("error", (err) => {
      console.error("[RabbitMQ Connection Error]", err.message);
      channel = null;
      connection = null;
    });

    connection.on("close", () => {
      console.warn("[RabbitMQ Connection Closed] Attempting reconnect in 10 seconds...");
      channel = null;
      connection = null;
      setTimeout(initRabbitMQ, 10000);
    });

    // Start Consumer on email_queue
    startConsumer();
    return true;
  } catch (error) {
    console.error("[RabbitMQ Init Error] Failed to connect:", error.message);
    console.warn("[RabbitMQ Fallback] System will fall back to direct synchronous email sending.");
    channel = null;
    connection = null;
    return false;
  }
}

/**
 * Publish message with Publisher ACK confirmation (ConfirmChannel wrapper)
 */
function sendToQueueWithConfirm(queueName, contentBuffer, options = { persistent: true }) {
  return new Promise((resolve, reject) => {
    if (!channel) return reject(new Error("RabbitMQ channel is not open"));

    channel.sendToQueue(queueName, contentBuffer, options, (err, ok) => {
      if (err) {
        return reject(err);
      }
      resolve(ok);
    });
  });
}

/**
 * Publish an email job to the primary queue with Publisher ACK & Idempotency Key
 * @param {Object} job - { type: 'SIGNUP_OTP' | 'RESET_OTP', email: string, otp: string }
 */
async function sendEmailViaQueue(job) {
  const { type, email, otp } = job;

  if (channel) {
    try {
      const jobId = job.jobId || crypto.randomUUID();
      const payloadObj = {
        ...job,
        jobId,
        retryCount: 0,
        createdAt: new Date().toISOString(),
      };
      const payloadBuffer = Buffer.from(JSON.stringify(payloadObj));

      // Await Publisher ACK from RabbitMQ broker
      await sendToQueueWithConfirm(PRIMARY_QUEUE, payloadBuffer, { persistent: true });
      console.log(`[RabbitMQ Publisher ACK] Job ${jobId} (${type}) for ${email} confirmed published to '${PRIMARY_QUEUE}'`);
      return { queued: true, jobId };
    } catch (err) {
      console.error("[RabbitMQ Publish Error] Publisher NACK / Failed. Fallback to direct send:", err.message);
    }
  }

  // Fallback: Direct SendGrid call if RabbitMQ is unavailable
  console.log(`[RabbitMQ Direct Fallback] Dispatching ${type} directly via SendGrid for ${email}...`);
  if (type === "SIGNUP_OTP") {
    await sendSignupOtp(email, otp);
  } else if (type === "RESET_OTP") {
    await sendResetPasswordOtp(email, otp);
  }
  return { queued: false };
}

/**
 * Consumer worker to process messages from email_queue with strict error handling & safe ACK/NACK
 */
function startConsumer() {
  if (!channel) return;

  channel.prefetch(5);
  console.log(`[RabbitMQ Consumer] Worker listening on '${PRIMARY_QUEUE}' with Idempotency Protection...`);

  channel.consume(
    PRIMARY_QUEUE,
    async (msg) => {
      if (!msg) return;

      let job;
      try {
        job = JSON.parse(msg.content.toString());
      } catch (parseErr) {
        console.error("[RabbitMQ Error] Malformed JSON payload. Routing to DLQ.");
        try {
          await moveToDLQ({ rawPayload: msg.content.toString() }, parseErr.message);
          channel.ack(msg);
        } catch (dlqErr) {
          console.error("[RabbitMQ Critical] Could not send malformed message to DLQ:", dlqErr.message);
          channel.nack(msg, false, false); // Reject without requeue if malformed & DLQ failed
        }
        return;
      }

      const jobId = job.jobId;

      // ---------------------------------------------------------------------
      // IDEMPOTENCY / DEDUPLICATION CHECK
      // ---------------------------------------------------------------------
      if (jobId && processedJobs.has(jobId)) {
        console.warn(`[RabbitMQ Idempotency] Duplicate message detected (JobId: ${jobId}) for ${job.email}. Skipping SendGrid delivery.`);
        channel.ack(msg); // ACK & drop duplicate safely
        return;
      }

      const currentRetryCount = job.retryCount || 0;
      console.log(`[RabbitMQ Consumer] Processing ${job.type} for ${job.email} (JobId: ${jobId || 'N/A'}, Attempt ${currentRetryCount + 1}/${MAX_RETRIES + 1})`);

      try {
        // Send email via SendGrid
        if (job.type === "SIGNUP_OTP") {
          await sendSignupOtp(job.email, job.otp);
        } else if (job.type === "RESET_OTP") {
          await sendResetPasswordOtp(job.email, job.otp);
        } else {
          throw new Error(`Unknown job type: ${job.type}`);
        }

        // SUCCESS -> Record Idempotency Key & ACK original message
        if (jobId) {
          processedJobs.set(jobId, Date.now());
        }
        channel.ack(msg);
        console.log(`[RabbitMQ Consumer SUCCESS] ${job.type} sent to ${job.email} (JobId: ${jobId || 'N/A'}) -> ACKed`);
      } catch (err) {
        console.error(`[RabbitMQ Consumer FAILURE] SendGrid error for ${job.email}:`, err.message);

        if (currentRetryCount < MAX_RETRIES) {
          // -----------------------------------------------------------------
          // RETRY PUBLISH FAILURE HANDLING
          // -----------------------------------------------------------------
          const nextRetry = currentRetryCount + 1;
          const retryJob = {
            ...job,
            retryCount: nextRetry,
            lastError: err.message,
            lastFailedAt: new Date().toISOString(),
          };

          console.warn(
            `[RabbitMQ FAILURE] retryCount (${nextRetry}/${MAX_RETRIES}) <= MAX_RETRIES. Publishing to '${RETRY_QUEUE}' with Publisher ACK...`
          );

          try {
            await sendToQueueWithConfirm(RETRY_QUEUE, Buffer.from(JSON.stringify(retryJob)), { persistent: true });
            // ACK original message ONLY IF publish to RETRY_QUEUE succeeded!
            channel.ack(msg);
            console.log(`[RabbitMQ Retry Queued] Successfully routed Job ${jobId || 'N/A'} to '${RETRY_QUEUE}' -> ACKed original.`);
          } catch (pubErr) {
            console.error(`[RabbitMQ Retry Publish FAILURE] Failed to publish Job ${jobId || 'N/A'} to '${RETRY_QUEUE}':`, pubErr.message);
            // DO NOT ACK! Re-queue original message in email_queue so it is NOT lost
            // setTimeout(() => {
            //   try {
            //     if (channel) channel.nack(msg, false, true);
            //   } catch (nackErr) {
            //     console.error("[RabbitMQ Nack Error]", nackErr.message);
            //   }
            // }, 2000);
             channel.nack(msg, false, true);
          }
        } else {
          // -----------------------------------------------------------------
          // DLQ PUBLISH FAILURE HANDLING
          // -----------------------------------------------------------------
          console.error(
            `[RabbitMQ FAILURE] retryCount (${currentRetryCount}/${MAX_RETRIES}) > MAX_RETRIES. Routing job to Dead Letter Queue '${DLQ_QUEUE}'!`
          );

          try {
            await moveToDLQ(job, err.message);
            // ACK original message ONLY IF publish to DLQ succeeded!
            channel.ack(msg);
            console.log(`[RabbitMQ DLQ Confirmed] Successfully routed Job ${jobId || 'N/A'} to '${DLQ_QUEUE}' -> ACKed original.`);
          } catch (dlqErr) {
            console.error(`[RabbitMQ DLQ Publish FAILURE] CRITICAL: Failed to publish Job ${jobId || 'N/A'} to '${DLQ_QUEUE}':`, dlqErr.message);
            // DO NOT ACK! Re-queue original message so it stays safely in email_queue for retry/investigation
            // setTimeout(() => {
            //   try {
            //     if (channel) channel.nack(msg, false, true);
            //   } catch (nackErr) {
            //     console.error("[RabbitMQ Nack Error]", nackErr.message);
            //   }
            // }, 5000);
             channel.nack(msg, false, true);
          }
        }
      }
    },
    { noAck: false }
  );
}

/**
 * Move permanently failed job to Dead Letter Queue (DLQ) with Publisher Confirm
 */
async function moveToDLQ(job, errorMessage) {
  if (!channel) {
    throw new Error("RabbitMQ channel is not available to publish to DLQ");
  }

  const dlqMessage = {
    job,
    failedAt: new Date().toISOString(),
    reason: errorMessage,
  };

  // Await Publisher ACK for DLQ publish
  await sendToQueueWithConfirm(DLQ_QUEUE, Buffer.from(JSON.stringify(dlqMessage)), { persistent: true });
  console.log(`[RabbitMQ DLQ] Job ${job.jobId || 'N/A'} confirmed saved to '${DLQ_QUEUE}'.`);
}

/**
 * Get current message counts for primary, retry, and dead letter queues
 */
async function getQueueStats() {
  if (!channel) return null;

  try {
    const primaryStats = await channel.checkQueue(PRIMARY_QUEUE);
    const retryStats = await channel.checkQueue(RETRY_QUEUE);
    const dlqStats = await channel.checkQueue(DLQ_QUEUE);

    return {
      primaryQueue: { name: PRIMARY_QUEUE, messageCount: primaryStats.messageCount, consumerCount: primaryStats.consumerCount },
      retryQueue: { name: RETRY_QUEUE, messageCount: retryStats.messageCount },
      deadLetterQueue: { name: DLQ_QUEUE, messageCount: dlqStats.messageCount },
      idempotencyCacheSize: processedJobs.size,
    };
  } catch (err) {
    console.error("[RabbitMQ Stats Error]", err.message);
    return null;
  }
}

module.exports = {
  initRabbitMQ,
  sendEmailViaQueue,
  getQueueStats,
};
