import { Request, Response, NextFunction } from "express";
import { AuthService } from "../../application/services/auth.service";
import { ApiResponse } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";

export class AuthController {
  constructor(private authService: AuthService) { }

  private setTokenCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("access_token", tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (match token expiry)
    });

    res.cookie("refresh_token", tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }

  private clearTokenCookies(res: Response) {
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await this.authService.register(req.body);
      Logger.info("User registered", { email: req.body.email });
      this.setTokenCookies(res, tokens);
      res.status(201).json(ApiResponse.success(tokens, "registration_successful"));
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await this.authService.login(req.body);
      Logger.info("User logged in", { email: req.body.email });
      this.setTokenCookies(res, tokens);
      res.status(200).json(ApiResponse.success(tokens, "login_successful"));
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refresh_token;
      if (!refreshToken) {
        return res.status(401).json(ApiResponse.error("no_refresh_token_provided"));
      }
      const tokens = await this.authService.refreshToken(refreshToken);
      this.setTokenCookies(res, tokens);
      res.json(ApiResponse.success(tokens, "token_refreshed"));
    } catch (error) {
      next(error);
    }
  };

  validate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.access_token;
      if (!token) {
        return res.status(401).json(ApiResponse.error("no_token_provided"));
      }
      const payload = await this.authService.validateToken(token);
      res.json(ApiResponse.success(payload, "token_is_valid"));
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;
      if (userId) {
        await this.authService.logout(userId);
      }
      this.clearTokenCookies(res);
      res.json(ApiResponse.success(null, "logged_out_successfully"));
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
