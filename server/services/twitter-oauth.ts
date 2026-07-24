import axios from "axios";
import crypto from "crypto";
import { logger } from "./logger";
import { config } from "../config/environment";
import FormData from "form-data";

interface TwitterTokenData {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope: string;
}

interface TwitterUserData {
  data: {
    id: string;
    name: string;
    username: string;
  };
}

interface TwitterMediaUploadResponse {
  media_id_string: string;
}

interface TwitterTweetResponse {
  data: {
    id: string;
    text: string;
  };
}

export class TwitterOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = "https://api.twitter.com/2";
  private readonly authUrl = "https://twitter.com/i/oauth2/authorize";
  private readonly tokenUrl = "https://api.twitter.com/2/oauth2/token";

  constructor() {
    this.clientId = config.social.twitterClientId || "";
    this.clientSecret = config.social.twitterClientSecret || "";

    if (!this.clientId || !this.clientSecret) {
      logger.warn(
        "backend",
        "Twitter OAuth not configured - missing credentials",
      );
    }
  }

  /**
   * Generate code verifier and challenge for PKCE
   */
  generatePKCE() {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(redirectUri: string, codeChallenge: string): string {
    const state = crypto.randomBytes(16).toString("hex");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: "tweet.read tweet.write users.read media.write offline.access",
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authUrl = `${this.authUrl}?${params.toString()}`;

    logger.info(
      "backend",
      "Generated Twitter auth URL with media.write scope",
      {
        redirectUri,
        state: state.substring(0, 8) + "...",
        scopes: "tweet.read tweet.write users.read media.write offline.access",
      },
    );

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<TwitterTokenData> {
    try {
      logger.info("backend", "Exchanging Twitter authorization code for token");

      const params = new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      });

      // Twitter requires Basic Authentication with client credentials
      const credentials = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString("base64");

      const response = await axios.post(this.tokenUrl, params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
      });

      logger.info("backend", "Successfully obtained Twitter access token");
      return response.data;
    } catch (error: any) {
      logger.error("backend", "Failed to exchange Twitter code for token", {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(`Twitter token exchange failed: ${error.message}`);
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(accessToken: string): Promise<TwitterUserData> {
    try {
      logger.info("backend", "Fetching Twitter user info");

      const response = await axios.get(`${this.baseUrl}/users/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      logger.info("backend", "Successfully fetched Twitter user info", {
        username: response.data.data?.username,
      });

      return response.data;
    } catch (error: any) {
      logger.error("backend", "Failed to fetch Twitter user info", {
        error: error.message,
        status: error.response?.status,
      });
      throw new Error(`Failed to get Twitter user info: ${error.message}`);
    }
  }

  /**
   * Verify access token is valid
   * Returns true if token is valid, false if token is invalid
   * Treats rate limits (429) as still valid
   */
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserInfo(accessToken);
      return true;
    } catch (error: any) {
      // Rate limit (429) means token is still valid, just temporarily can't verify
      const isRateLimit =
        error.message?.includes("429") || error.response?.status === 429;

      if (isRateLimit) {
        logger.warn(
          "backend",
          "Twitter token verification rate limited - treating as valid",
        );
        return true; // Token is still valid, just rate limited
      }

      logger.warn("backend", "Twitter token verification failed", {
        error: error.message,
        status: error.response?.status,
      });
      return false;
    }
  }

  /**
   * Upload media to Twitter (v1.1 API - still functional)
   * Note: v2 endpoint restricted on free tier, v1.1 still works
   */
  async uploadMedia(
    accessToken: string,
    mediaBuffer: Buffer,
    mimeType?: string,
  ): Promise<string> {
    try {
      logger.info("backend", "Uploading media to Twitter v1.1 API", {
        size: mediaBuffer.length,
        mimeType,
      });

      // Use v1.1 endpoint which still works (despite deprecation notices)
      const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";

      // v1.1 uses base64 encoding
      const base64Media = mediaBuffer.toString("base64");

      logger.info("backend", "Sending media upload request to Twitter v1.1", {
        uploadUrl,
        mimeType,
        base64Length: base64Media.length,
      });

      // v1.1 API expects form-urlencoded data with base64 media
      const params = new URLSearchParams();
      params.append("media_data", base64Media);

      const response = await axios.post(uploadUrl, params.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      // v1.1 returns media_id_string directly
      const mediaId = response.data?.media_id_string;

      if (!mediaId) {
        logger.error("backend", "No media ID in Twitter v1.1 response", {
          responseData: JSON.stringify(response.data),
        });
        throw new Error("No media ID returned from Twitter");
      }

      logger.info("backend", "Successfully uploaded media to Twitter v1.1", {
        mediaId,
      });

      return mediaId;
    } catch (error: any) {
      logger.error("backend", "Failed to upload media to Twitter v1.1", {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        errorDetails: JSON.stringify(error.response?.data || {}),
      });
      throw new Error(`Twitter media upload failed: ${error.message}`);
    }
  }

  /**
   * Post a tweet
   */
  async postTweet(
    accessToken: string,
    text: string,
    mediaIds?: string[],
  ): Promise<TwitterTweetResponse> {
    try {
      logger.info("backend", "Posting tweet to Twitter", {
        textLength: text.length,
        hasMedia: !!mediaIds && mediaIds.length > 0,
      });

      const payload: any = { text };

      if (mediaIds && mediaIds.length > 0) {
        payload.media = {
          media_ids: mediaIds,
        };
      }

      const response = await axios.post(`${this.baseUrl}/tweets`, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      logger.info("backend", "Successfully posted tweet", {
        tweetId: response.data.data?.id,
      });

      return response.data;
    } catch (error: any) {
      logger.error("backend", "Failed to post tweet", {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(`Twitter post failed: ${error.message}`);
    }
  }
}

export const twitterOAuth = new TwitterOAuthService();
