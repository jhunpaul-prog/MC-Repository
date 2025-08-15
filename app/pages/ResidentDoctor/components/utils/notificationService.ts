import { ref, push, serverTimestamp } from "firebase/database";
import { db } from "../../../../Backend/firebase";

export interface NotificationData {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  actionUrl?: string;
  actionText?: string;
  /** Helps identify where the notification came from */
  source?: "demo" | "chat" | "system";
}

export class NotificationService {
  /**
   * Send a notification to a specific user
   */
  static async sendNotification(
    userId: string,
    notification: NotificationData
  ) {
    try {
      const notificationsRef = ref(db, `notifications/${userId}`);
      const res = await push(notificationsRef, {
        ...notification,
        read: false,
        createdAt: serverTimestamp(),
      });
      console.log("Notification sent. key:", res.key);
    } catch (error) {
      console.error("Error sending notification:", error);
      throw error;
    }
  }

  /**
   * Send notifications to multiple users
   */
  static async sendBulkNotifications(
    userIds: string[],
    notification: NotificationData
  ) {
    try {
      await Promise.all(
        userIds.map((userId) => this.sendNotification(userId, notification))
      );
      console.log(`Bulk notifications sent to ${userIds.length} users`);
    } catch (error) {
      console.error("Error sending bulk notifications:", error);
      throw error;
    }
  }

  /**
   * Send notification to all users (admin function)
   */
  static async sendGlobalNotification(notification: NotificationData) {
    try {
      const globalNotificationsRef = ref(db, "globalNotifications");
      await push(globalNotificationsRef, {
        ...notification,
        createdAt: serverTimestamp(),
      });
      console.log("Global notification sent successfully");
    } catch (error) {
      console.error("Error sending global notification:", error);
      throw error;
    }
  }

  /**
   * Predefined notification templates
   */
  static templates = {
    welcome: (userName: string): NotificationData => ({
      title: "Welcome to CobyCare!",
      message: `Hello ${userName}! Welcome to our research platform. Start exploring research papers and building your library.`,
      type: "success",
      actionUrl: "/search",
      actionText: "Start Exploring",
    }),

    paperApproved: (paperTitle: string): NotificationData => ({
      title: "Paper Approved",
      message: `Your research paper "${paperTitle}" has been approved and is now published.`,
      type: "success",
      actionUrl: "/My-Papers",
      actionText: "View Paper",
    }),

    paperRejected: (paperTitle: string, reason: string): NotificationData => ({
      title: "Paper Needs Revision",
      message: `Your research paper "${paperTitle}" needs revision. Reason: ${reason}`,
      type: "warning",
      actionUrl: "/My-Papers",
      actionText: "View Details",
    }),

    systemMaintenance: (maintenanceDate: string): NotificationData => ({
      title: "Scheduled Maintenance",
      message: `System maintenance is scheduled for ${maintenanceDate}. Some features may be temporarily unavailable.`,
      type: "info",
    }),

    newFeature: (featureName: string): NotificationData => ({
      title: "New Feature Available",
      message: `Check out our new feature: ${featureName}! Enhance your research experience with improved tools.`,
      type: "info",
      actionUrl: "/account-settings",
      actionText: "Learn More",
    }),

    accountSecurity: (): NotificationData => ({
      title: "Security Alert",
      message:
        "We noticed a login from a new device. If this wasn't you, please secure your account immediately.",
      type: "warning",
      actionUrl: "/account-settings",
      actionText: "Review Security",
    }),

    collaborationInvite: (
      inviterName: string,
      projectName: string
    ): NotificationData => ({
      title: "Collaboration Invitation",
      message: `${inviterName} invited you to collaborate on "${projectName}". Join the research collaboration now.`,
      type: "info",
      actionUrl: "/collaborations",
      actionText: "View Invitation",
    }),

    citationAlert: (
      paperTitle: string,
      citationCount: number
    ): NotificationData => ({
      title: "Your Paper Was Cited",
      message: `Your paper "${paperTitle}" has been cited ${citationCount} times. Great work!`,
      type: "success",
      actionUrl: "/my-stats",
      actionText: "View Stats",
    }),

    newMessage: (
      senderName: string,
      messagePreview: string
    ): NotificationData => ({
      title: "New Message",
      message: `${senderName}: ${messagePreview}`,
      type: "info",
      actionUrl: "/chat",
      actionText: "Reply",
    }),

    chatInvite: (inviterName: string): NotificationData => ({
      title: "Chat Invitation",
      message: `${inviterName} wants to start a conversation with you.`,
      type: "info",
      actionUrl: "/chat",
      actionText: "Open Chat",
    }),
  };
}

// Example usage functions for testing
export const sendTestNotifications = async (userId: string) => {
  // Tag these as 'demo' so they’re easy to filter in the UI
  await NotificationService.sendNotification(userId, {
    ...NotificationService.templates.welcome("Dr. John Smith"),
    source: "demo",
  });

  await NotificationService.sendNotification(userId, {
    ...NotificationService.templates.paperApproved(
      "Advanced Machine Learning in Healthcare"
    ),
    source: "demo",
  });

  await NotificationService.sendNotification(userId, {
    ...NotificationService.templates.systemMaintenance(
      "December 15, 2024 at 2:00 AM UTC"
    ),
    source: "demo",
  });

  await NotificationService.sendNotification(userId, {
    title: "Research Milestone",
    message: "Congratulations! You've reached 1,000 paper views this month.",
    type: "success",
    actionUrl: "/my-stats",
    actionText: "View Analytics",
    source: "demo",
  });
};
