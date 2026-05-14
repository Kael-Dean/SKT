# Node.js + Express / NestJS Best Practices (Backend API)

## Which Framework to Choose?

```
Express:
✅ Small/simple projects, rapid prototyping
✅ Need high flexibility
✅ Small team, minimal structure overhead

NestJS (recommended for production):
✅ Medium-to-large projects
✅ TypeScript-first, opinionated structure
✅ Built-in DI, testing, validation, guards
✅ Microservices support
```

---

# NestJS Best Practices

## 1. Project Structure (Feature-Based Modules)

```
src/
├── main.ts                     # Bootstrap app
├── app.module.ts               # Root module
├── common/                     # Shared utilities
│   ├── decorators/             # Custom decorators
│   ├── filters/                # Exception filters
│   ├── guards/                 # Auth guards
│   ├── interceptors/           # Response transformers
│   ├── pipes/                  # Validation pipes
│   └── dto/                    # Shared DTOs
├── config/                     # Configuration
│   └── configuration.ts
├── database/                   # Database setup
│   └── database.module.ts
└── modules/                    # Feature modules
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── strategies/         # Passport strategies
    │   └── dto/
    ├── users/
    │   ├── users.module.ts
    │   ├── users.controller.ts
    │   ├── users.service.ts
    │   ├── users.repository.ts # Data access layer
    │   ├── entities/
    │   │   └── user.entity.ts
    │   └── dto/
    │       ├── create-user.dto.ts
    │       └── update-user.dto.ts
    └── products/
```

## 2. Module Setup (Users Module Example)

```typescript
// users/users.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // Export so other modules can use it
})
export class UsersModule {}
```

## 3. Controller — Handle Requests Only

```typescript
// users/users.controller.ts
@Controller('users')
@UseGuards(JwtAuthGuard)          // Auth guard at controller level
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOneOrFail(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
```

## 4. Service — Business Logic

```typescript
// users/users.service.ts
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailService: MailService, // Injected dependency
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check duplicate
    const existing = await this.usersRepository.findByEmail(createUserDto.email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    // Side effects
    await this.mailService.sendWelcome(user.email);
    return user;
  }

  async findOneOrFail(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<User>> {
    return this.usersRepository.findAll(query);
  }
}
```

## 5. DTO Validation

```typescript
// dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  role?: string;
}

// main.ts — Enable Global Validation Pipe
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,        // Strip fields not defined in the DTO
    forbidNonWhitelisted: true,
    transform: true,        // Auto transform types
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

## 6. Authentication (JWT + Passport)

```typescript
// auth/strategies/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}

// auth/auth.service.ts
async login(loginDto: LoginDto) {
  const user = await this.validateUser(loginDto.email, loginDto.password);
  if (!user) throw new UnauthorizedException('Invalid credentials');

  const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
  return {
    access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
    refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
  };
}
```

## 7. Exception Handling

```typescript
// common/filters/http-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

// main.ts
app.useGlobalFilters(new GlobalExceptionFilter());
```

## 8. Interceptors (Response Transform + Logging)

```typescript
// common/interceptors/transform.interceptor.ts
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

## 9. Configuration Management

```typescript
// config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT!, 10) || 3000,
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '15m',
  },
});

// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  load: [configuration],
  validationSchema: Joi.object({
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    PORT: Joi.number().default(3000),
  }),
}),
```

## 10. Database (TypeORM + Prisma)

### TypeORM Entity
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false }) // Not returned in queries by default
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];
}
```

### Prisma (recommended for new projects)
```typescript
// prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  posts     Post[]
  createdAt DateTime @default(now())
}

// Usage in service
const user = await this.prisma.user.findUniqueOrThrow({
  where: { id },
  include: { posts: true },
});
```

## 11. Caching (Redis)

```typescript
// app.module.ts
CacheModule.registerAsync({
  isGlobal: true,
  useFactory: (configService: ConfigService) => ({
    store: redisStore,
    host: configService.get('REDIS_HOST'),
    port: configService.get('REDIS_PORT'),
    ttl: 60, // default 60 seconds
  }),
  inject: [ConfigService],
}),

// users.service.ts
@Cacheable({ key: (id: string) => `user:${id}`, ttl: 300 })
async findById(id: string): Promise<User> {
  return this.prisma.user.findUniqueOrThrow({ where: { id } });
}
```

## 12. Rate Limiting

```typescript
// app.module.ts
ThrottlerModule.forRoot([{
  ttl: 60000,   // 1 minute
  limit: 100,   // 100 requests per minute
}]),

// controller
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 5, ttl: 60000 } }) // Stricter limit for auth endpoints
@Post('login')
login(@Body() dto: LoginDto) { ... }
```

## 13. Security Checklist

```typescript
// main.ts — Security setup for production
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  });

  // Security headers
  app.use(helmet());

  // Compression
  app.use(compression());

  // Global prefix
  app.setGlobalPrefix('api/v1');

  await app.listen(process.env.PORT ?? 3000);
}
```

## 14. Testing

```typescript
// users/users.service.spec.ts
describe('UsersService', () => {
  let service: UsersService;
  let mockRepository: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    mockRepository = module.get(UsersRepository);
  });

  it('should throw NotFoundException when user not found', async () => {
    mockRepository.findById.mockResolvedValue(null);
    await expect(service.findOneOrFail('invalid-id'))
      .rejects.toThrow(NotFoundException);
  });
});
```

## 15. Pre-Production Checklist

- [ ] Global validation pipe (whitelist + transform)
- [ ] Global exception filter
- [ ] JWT authentication
- [ ] Rate limiting (ThrottlerModule)
- [ ] Helmet (security headers)
- [ ] CORS configured
- [ ] Environment validation (Joi/Zod)
- [ ] Redis caching for frequent queries
- [ ] Logging (Winston/Pino)
- [ ] Health check endpoint (`/health`)
- [ ] API versioning (`/api/v1`)
- [ ] Swagger documentation (`@nestjs/swagger`)
- [ ] Unit test coverage > 80%
