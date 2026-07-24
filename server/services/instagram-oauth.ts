import axios from "axios";
import { logger } from "./logger";
import { config } from "../config/environment";

interface InstagramUserData {
  id: string;
  username: string;
  account_type: "PERSONAL" | "BUSINESS";
  media_count?: number;
  followers_count?: number;
}

interface FacebookPageData {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
  };
}

export class InstagramOAuthService {
  private readonly baseUrl = "https://graph.facebook.com/v18.0";
  private readonly appId: string;
  private readonly appSecret: string;

  constructor() {
    this.appId = process.env.FACEBOOK_APP_ID || process.env.META_APP_ID || "DEMO_APP_ID";
    this.appSecret = process.env.FACEBOOK_APP_SECRET || process.env.META_APP_SECRET || "DEMO_APP_SECRET";

    if (!process.env.FACEBOOK_APP_ID && !process.env.META_APP_ID) {
      logger.info("backend", "Instagram OAuth running in DEMO mode - add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET for production");
    }
  }

  /**
   * Generate Instagram authorization URL
   */
  generateAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
      response_type: "code",
      state: "instagram_auth"
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<any> {
    try {
      logger.info("backend", "Exchanging Instagram authorization code for token");

      const response = await axios.get(`${this.baseUrl}/oauth/access_token`, {
        params: {
          client_id: this.appId,
          client_secret: this.appSecret,
          redirect_uri: redirectUri,
          code: code
        }
      });

      logger.info("backend", "Successfully obtained Instagram access token");
      return response.data;
    } catch (error: any) {
      logger.error("backend", "Failed to exchange Instagram code for token", {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Instagram token exchange failed: ${error.message}`);
    }
  }

  /**
   * Get user's Facebook pages (required for Instagram Business)
   */
  async getUserPages(accessToken: string): Promise<FacebookPageData[]> {
    try {
      logger.info("backend", "Fetching user's Facebook pages");

      const response = await axios.get(`${this.baseUrl}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: "id,name,access_token,instagram_business_account"
        }
      });

      const pages: FacebookPageData[] = response.data.data || [];
      logger.info("backend", `Found ${pages.length} Facebook pages`);

      return pages;
    } catch (error: any) {
      logger.error("backend", "Failed to fetch Facebook pages", {
        error: error.message,
        status: error.response?.status
      });
      throw new Error(`Failed to fetch pages: ${error.message}`);
    }
  }

  /**
   * Get Instagram Business Account details
   */
  async getInstagramAccount(pageAccessToken: string, instagramAccountId: string): Promise<InstagramUserData> {
    try {
      logger.info("backend", `Fetching Instagram account details for ID: ${instagramAccountId}`);

      const response = await axios.get(`${this.baseUrl}/${instagramAccountId}`, {
        params: {
          access_token: pageAccessToken,
          fields: "id,username,account_type,media_count,followers_count"
        }
      });

      logger.info("backend", `Successfully fetched Instagram account: @${response.data.username}`);
      return response.data;
    } catch (error: any) {
      logger.error("backend", "Failed to fetch Instagram account details", {
        error: error.message,
        status: error.response?.status,
        instagramAccountId
      });
      throw new Error(`Failed to fetch Instagram account: ${error.message}`);
    }
  }

  /**
   * Verify access token is valid
   */
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/me`, {
        params: {
          access_token: accessToken,
          fields: "id,name"
        }
      });

      return response.status === 200 && response.data.id;
    } catch (error) {
      logger.warn("backend", "Instagram token verification failed", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return false;
    }
  }

  /**
   * Publish image to Instagram
   */
  async publishImage(
    instagramAccountId: string,
    pageAccessToken: string,
    imageUrl: string,
    caption?: string
  ): Promise<any> {
    try {
      logger.info("backend", `Publishing image to Instagram account: ${instagramAccountId}`);

      // Step 1: Create media container
      const containerResponse = await axios.post(
        `${this.baseUrl}/${instagramAccountId}/media`,
        {
          image_url: imageUrl,
          caption: caption || "",
          access_token: pageAccessToken
        }
      );

      const containerId = containerResponse.data.id;
      logger.info("backend", `Created Instagram media container: ${containerId}`);

      // Step 2: Publish the container
      const publishResponse = await axios.post(
        `${this.baseUrl}/${instagramAccountId}/media_publish`,
        {
          creation_id: containerId,
          access_token: pageAccessToken
        }
      );

      logger.info("backend", `Successfully published to Instagram: ${publishResponse.data.id}`);
      return publishResponse.data;
    } catch (error: any) {
      logger.error("backend", "Failed to publish to Instagram", {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Instagram publish failed: ${error.message}`);
    }
  }
}

export const instagramOAuth = new InstagramOAuthService();