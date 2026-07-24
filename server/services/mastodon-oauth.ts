import axios from 'axios';
import crypto from 'crypto';
import { logger } from './logger';
import { config } from '../config/environment';

interface MastodonApp {
  client_id: string;
  client_secret: string;
  id: string;
  name: string;
  website: string | null;
  redirect_uri: string;
  client_id_issued_at: number;
  client_secret_expires_at: number;
}

interface MastodonToken {
  access_token: string;
  token_type: string;
  scope: string;
  created_at: number;
}

export class MastodonOAuthService {
  private apps: Map<string, MastodonApp> = new Map();
  private encryptionKey: string;

  constructor() {
    // Refuse to silently use a hard-coded fallback. With code access, that
    // fallback would let an attacker decrypt every stored Mastodon token.
    const key = process.env.MASTODON_ENCRYPTION_KEY;
    if (!key || key.length < 32) {
      throw new Error(
        'MASTODON_ENCRYPTION_KEY must be set to a random 32+ character string. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    this.encryptionKey = key;
  }

  /**
   * Register application with Mastodon instance
   */
  async registerApp(instance: string, redirectUri: string): Promise<MastodonApp> {
    const cacheKey = `${instance}:${redirectUri}`;
    
    // Check if we already have this app registered
    if (this.apps.has(cacheKey)) {
      logger.info('backend', `Using cached Mastodon app for ${instance}`);
      return this.apps.get(cacheKey)!;
    }

    logger.info('backend', `Registering new Mastodon app for ${instance}`);

    try {
      const response = await axios.post(`https://${instance}/api/v1/apps`, {
        client_name: 'Requisor Social Media Manager',
        redirect_uris: redirectUri,
        scopes: 'read write:statuses write:media',
        website: config.oauth.mastodon.website
      });

      const app: MastodonApp = response.data;
      this.apps.set(cacheKey, app);
      
      logger.info('backend', `Successfully registered Mastodon app for ${instance}`, {
        client_id: app.client_id.substring(0, 8) + '...'
      });

      return app;
    } catch (error: any) {
      logger.error('backend', `Failed to register Mastodon app for ${instance}`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Failed to register app with ${instance}: ${error.message}`);
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(instance: string, clientId: string, redirectUri: string): string {
    const state = crypto.randomBytes(32).toString('hex');
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read write:statuses write:media',
      state: state
    });

    const authUrl = `https://${instance}/oauth/authorize?${params.toString()}`;
    
    logger.info('backend', `Generated Mastodon auth URL for ${instance}`, {
      state: state.substring(0, 8) + '...'
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    instance: string,
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<MastodonToken> {
    logger.info('backend', `Exchanging code for token on ${instance}`);

    try {
      const response = await axios.post(`https://${instance}/oauth/token`, {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code: code,
        scope: 'read write:statuses write:media'
      });

      const token: MastodonToken = response.data;
      
      logger.info('backend', `Successfully obtained Mastodon token for ${instance}`, {
        token_type: token.token_type,
        scope: token.scope
      });

      return token;
    } catch (error: any) {
      logger.error('backend', `Failed to exchange code for token on ${instance}`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Failed to get access token from ${instance}: ${error.message}`);
    }
  }

  /**
   * Verify token is valid
   */
  async verifyToken(instance: string, accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get(`https://${instance}/api/v1/accounts/verify_credentials`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      logger.info('backend', `Token verified for ${instance}`, {
        username: response.data.username
      });

      return true;
    } catch (error: any) {
      logger.warn('backend', `Token verification failed for ${instance}`, {
        error: error.message,
        status: error.response?.status
      });
      return false;
    }
  }

  /**
   * Post status to Mastodon
   */
  async postStatus(
    instance: string,
    accessToken: string,
    content: string,
    mediaFiles?: Buffer[]
  ): Promise<any> {
    logger.info('backend', `Posting status to ${instance}`, {
      contentLength: content.length,
      mediaCount: mediaFiles?.length || 0
    });

    try {
      let mediaIds: string[] = [];

      // Upload media files if provided
      if (mediaFiles && mediaFiles.length > 0) {
        for (const file of mediaFiles) {
          const formData = new FormData();
          formData.append('file', new Blob([file]));
          
          const mediaResponse = await axios.post(
            `https://${instance}/api/v2/media`,
            formData,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'multipart/form-data'
              }
            }
          );
          
          mediaIds.push(mediaResponse.data.id);
        }
      }

      // Post the status
      const statusData: any = {
        status: content,
        visibility: 'public'
      };

      if (mediaIds.length > 0) {
        statusData.media_ids = mediaIds;
      }

      logger.info('backend', `About to post status to ${instance}`, {
        statusData: { ...statusData, status: content.substring(0, 50) + '...' },
        hasToken: !!accessToken
      });

      const response = await axios.post(
        `https://${instance}/api/v1/statuses`,
        statusData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      // Verify the response contains expected data
      if (!response.data || !response.data.id) {
        throw new Error('Invalid response from Mastodon API - missing status ID');
      }

      // Double-check the post exists by fetching it
      try {
        const verifyResponse = await axios.get(
          `https://${instance}/api/v1/statuses/${response.data.id}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );
        
        if (!verifyResponse.data || verifyResponse.data.id !== response.data.id) {
          throw new Error('Post verification failed - status was not created successfully');
        }
        
        logger.info('backend', `Post verified successfully on ${instance}`, {
          statusId: response.data.id,
          verifiedContent: verifyResponse.data.content?.substring(0, 50) + '...'
        });
      } catch (verifyError: any) {
        logger.warn('backend', `Could not verify post on ${instance}`, {
          statusId: response.data.id,
          verifyError: verifyError.message
        });
        // Don't fail the entire operation if verification fails
      }

      logger.info('backend', `Successfully posted to ${instance}`, {
        statusId: response.data.id,
        url: response.data.url
      });

      return response.data;
    } catch (error: any) {
      logger.error('backend', `Failed to post status to ${instance}`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Failed to post to ${instance}: ${error.message}`);
    }
  }
}

export const mastodonOAuth = new MastodonOAuthService();