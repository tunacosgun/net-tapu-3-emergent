import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../services/audit-log.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    if (method === 'GET') return next.handle();

    const user = request.user;
    const resourceType = context.getClass().name.replace('Controller', '').toLowerCase();
    const resourceId = request.params?.id ?? request.params?.key ?? null;
    const action = `${method} ${request.route?.path ?? request.url}`;

    return next.handle().pipe(
      tap((responseBody) => {
        this.auditLogService
          .record({
            actorId: user?.sub ?? null,
            actorRole: user?.roles?.[0] ?? null,
            action,
            resourceType,
            resourceId,
            oldValue: null,
            newValue: responseBody && typeof responseBody === 'object' ? responseBody as Record<string, unknown> : null,
            ipAddress: request.ip ?? null,
            userAgent: request.headers?.['user-agent'] ?? null,
          })
          .catch(() => {});
      }),
    );
  }
}
