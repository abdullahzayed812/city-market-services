import { Request, Response, NextFunction } from "express";
import { AuthService } from "../../application/services/auth.service";
import { DeviceContext } from "../../core/dto/device-context.dto";
import { ApiResponse, ValidationError } from "@city-market/shared";
import { Logger, AuthenticatedRequest } from "@city-market/shared/node";
import { config } from "../../config/env";
import { parseDurationMs } from "../../utils/duration";
import { parseUserAgent } from "../../utils/user-agent";

export class AuthController {
  constructor(private authService: AuthService) { }

  /**
   * Cookie names are namespaced per calling app (falls back to "default" for clients that
   * don't send one, e.g. mobile — which ignores these cookies entirely and reads tokens from
   * the response body instead). Without this, every web app hitting this backend host would
   * share one "refresh_token" cookie, since the browser's cookie jar is keyed by domain, not
   * by which frontend origin made the request. See DeviceContext.appId.
   */
  private cookieNames(appId?: string) {
    const ns = appId && typeof appId === "string" ? appId : "default";
    return { access: `access_token_${ns}`, refresh: `refresh_token_${ns}` };
  }

  private setTokenCookies(
    req: Request,
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
    appId?: string,
  ) {
    // Gate on the actual connection, not NODE_ENV: a prod build served over plain HTTP
    // (e.g. before SSL is enabled, see DEPLOYMENT.md) must not mark cookies Secure, or
    // the browser silently refuses to store them and every refresh 401s after reload.
    // req.secure respects `trust proxy` + X-Forwarded-Proto (set in app.ts).
    const secure = req.secure;
    const { access, refresh } = this.cookieNames(appId);

    res.cookie(access, tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: parseDurationMs(config.jwtAccessExpiry),
    });

    res.cookie(refresh, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: parseDurationMs(config.refreshExpiry),
    });
  }

  private clearTokenCookies(res: Response, appId?: string) {
    const { access, refresh } = this.cookieNames(appId);
    res.clearCookie(access);
    res.clearCookie(refresh);
  }

  private extractDeviceContext(req: Request): DeviceContext {
    const deviceId = req.body?.deviceId;
    if (!deviceId || typeof deviceId !== "string") {
      throw new ValidationError("device_id_required");
    }

    const { browser, os } = parseUserAgent(req.headers["user-agent"]);

    return {
      deviceId,
      platform: req.body?.platform ?? "web",
      browser,
      os,
      deviceName: req.body?.deviceName,
      ipAddress: req.ip,
      appId: req.body?.appId,
    };
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deviceCtx = this.extractDeviceContext(req);
      const tokens = await this.authService.register(req.body, deviceCtx);
      Logger.info("User registered", { email: req.body.email });
      this.setTokenCookies(req, res, tokens, deviceCtx.appId);
      res.status(201).json(ApiResponse.success(tokens, "registration_successful"));
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deviceCtx = this.extractDeviceContext(req);
      const tokens = await this.authService.login(req.body, deviceCtx);
      Logger.info("User logged in", { email: req.body.email });
      this.setTokenCookies(req, res, tokens, deviceCtx.appId);
      res.status(200).json(ApiResponse.success(tokens, "login_successful"));
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deviceCtx = this.extractDeviceContext(req);
      const refreshToken = req.body.refreshToken || req.cookies?.[this.cookieNames(deviceCtx.appId).refresh];
      if (!refreshToken) {
        return res.status(401).json(ApiResponse.error("no_refresh_token_provided"));
      }
      const tokens = await this.authService.refreshToken(refreshToken, deviceCtx);
      this.setTokenCookies(req, res, tokens, deviceCtx.appId);
      res.json(ApiResponse.success(tokens, "token_refreshed"));
    } catch (error) {
      next(error);
    }
  };

  validate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appId = (req.query.appId as string) || req.body?.appId;
      const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.[this.cookieNames(appId).access];
      if (!token) {
        return res.status(401).json(ApiResponse.error("no_token_provided"));
      }
      const payload = await this.authService.validateToken(token);
      res.json(ApiResponse.success(payload, "token_is_valid"));
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user?.sessionId) {
        await this.authService.logout(req.user.sessionId);
      }
      this.clearTokenCookies(res, req.body?.appId);
      res.json(ApiResponse.success(null, "logged_out_successfully"));
    } catch (error) {
      next(error);
    }
  };

  logoutAll = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user?.userId) {
        await this.authService.logoutAll(req.user.userId);
      }
      this.clearTokenCookies(res, req.body?.appId);
      res.json(ApiResponse.success(null, "logged_out_all_devices_successfully"));
    } catch (error) {
      next(error);
    }
  };

  sessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const sessions = await this.authService.listSessions(userId, req.user!.sessionId);
      res.json(ApiResponse.success(sessions, "sessions_retrieved_successfully"));
    } catch (error) {
      next(error);
    }
  };

  getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const role = req.query.role as string;
      const result = await this.authService.getUsers(page, limit, role);
      res.json(ApiResponse.success(result, "users_retrieved_successfully"));
    } catch (error) {
      next(error);
    }
  };

  getUsersCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.query.role as string;
      const total = await this.authService.countUsers(role);
      res.json(ApiResponse.success({ total }));
    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await this.authService.getUserById(id);
      res.json(ApiResponse.success(user, "user_retrieved_successfully"));
    } catch (error) {
      next(error);
    }
  };

  updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      await this.authService.updateUserStatus(id, status);
      res.json(ApiResponse.success(null, "user_status_updated_successfully"));
    } catch (error) {
      next(error);
    }
  };

  issueServiceToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { grant_type, client_id, client_secret } = req.body;

      if (grant_type !== "client_credentials") {
        return res.status(400).json(ApiResponse.error("invalid_grant: Unsupported grant_type"));
      }

      const serviceTokenResponse = await this.authService.issueServiceToken(client_id, client_secret);
      res.json(serviceTokenResponse); // Should contain access_token, expires_in, token_type
    } catch (error) {
      next(error);
    }
  };
}
