const axios = require('axios');

/**
 * EventSimulator class
 * Handles asynchronous delivery simulation for campaigns.
 */
class EventSimulator {
  /**
   * Processes a list of outbound communications asynchronously
   */
  static processOutboundBatch(campaignId, webhookUrl, communications) {
    console.log(`[Simulator Queue]: Enqueued ${communications.length} messages for campaign ${campaignId}.`);

    // Process each message in parallel background micro-tasks
    communications.forEach(comm => {
      this.simulateMessageLifecycle(campaignId, webhookUrl, comm);
    });
  }

  /**
   * Simulates the state transition lifecycle for a single message
   */
  static async simulateMessageLifecycle(campaignId, webhookUrl, comm) {
    const { communicationId, customerId } = comm;
    
    // Helper to fire callbacks to the CRM Webhook
    const fireCallback = async (status, errorReason = null) => {
      // Generate a unique, deterministic event ID to verify CRM backend idempotency checks
      const eventId = `evt_${communicationId}_${status.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      const payload = {
        communicationId,
        campaignId,
        customerId,
        status,
        eventId,
        errorReason
      };

      try {
        console.log(`[Simulator Outbound Webhook]: Firing status "${status}" for customer ${customerId}. EventId=${eventId}`);
        await axios.post(webhookUrl, payload);
      } catch (err) {
        console.error(`[Simulator Webhook Error]: Failed to post status "${status}" callback to CRM:`, err.message);
      }
    };

    // Helper for non-blocking delay
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // 1. SENT - Fire immediately
      await fireCallback('SENT');

      // 2. DELIVERED vs FAILED - Wait 2 seconds (90% success rate)
      await delay(2000);
      const isDelivered = Math.random() < 0.90;
      
      if (!isDelivered) {
        await fireCallback('FAILED', 'Carrier network timeout / unreachable number');
        return; // stop execution
      }
      
      await fireCallback('DELIVERED');

      // 3. OPENED - Wait 3 seconds (60% open rate)
      await delay(3000);
      const isOpened = Math.random() < 0.60;
      if (!isOpened) return; // stop execution

      await fireCallback('OPENED');

      // 4. CLICKED - Wait 2 seconds (30% click rate)
      await delay(2000);
      const isClicked = Math.random() < 0.30;
      if (!isClicked) return; // stop execution

      await fireCallback('CLICKED');

      // 5. CONVERTED - Wait 4 seconds (10% conversion rate)
      await delay(4000);
      const isConverted = Math.random() < 0.10;
      if (!isConverted) return; // stop execution

      await fireCallback('CONVERTED');

    } catch (lifecycleErr) {
      console.error(`[Simulator Lifecycle Error]: Crash on customer ${customerId}:`, lifecycleErr.message);
    }
  }
}

module.exports = EventSimulator;
