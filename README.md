# ☁️ cloudflare-worker-sqs

A proof of concept (POC) demonstrating how to send messages from a **Cloudflare Worker** to **AWS SQS**, without running inside the AWS ecosystem.

---

## 🚀 Purpose

This project shows how to integrate Cloudflare Workers with **Amazon SQS**, using manually crafted AWS Signature Version 4 requests (SigV4), enabling secure, serverless message dispatching **from the edge**.

---

## ⚠️ Why AWS SDK Can't Be Used

The official **AWS SDK** (`aws-sdk`) is **not compatible with Cloudflare Workers** due to:
- Its **large bundle size** (often exceeding Worker limits)
- **Node.js-specific APIs** (e.g., `Buffer`, `http`, `crypto`) that **don’t work in the Worker runtime**
- Use of modules not supported in **V8-based edge environments**

Instead, we **manually implement** the AWS SigV4 signing process using Web Crypto APIs available in the Worker runtime.

---

