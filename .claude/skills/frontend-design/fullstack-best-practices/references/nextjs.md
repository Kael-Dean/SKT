# Next.js Best Practices (Web)

## 1. Project Structure (App Router - Next.js 15+)

```
src/
├── app/                        # App Router (routing)
│   ├── layout.tsx              # Root layout (required)
│   ├── page.tsx                # Homepage
│   ├── loading.tsx             # Global loading UI
│   ├── error.tsx               # Global error boundary
│   ├── (auth)/                 # Route group (no URL impact)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Nested layout
│   │   └── settings/page.tsx
│   └── api/                    # Route Handlers (API endpoints)
│       └── users/route.ts
├── components/
│   ├── ui/                     # Reusable UI (shadcn/ui, custom)
│   └── features/               # Feature-specific components
├── lib/                        # Utilities, helpers
│   ├── db.ts                   # Database client
│   └── auth.ts                 # Auth utilities
├── hooks/                      # Custom React hooks (client-side)
├── types/                      # TypeScript type definitions
├── styles/                     # Global CSS
└── public/                     # Static assets
```

## 2. Server Components vs Client Components

```
Use Server Component (default) when:
✅ Fetching data from a database or API
✅ Accessing environment variables
✅ No interactivity needed
✅ Rendering static content

Use Client Component ("use client") when:
✅ Using useState, useEffect, or other hooks
✅ Event listeners (onClick, onChange)
✅ Browser APIs (localStorage, window)
✅ Real-time updates (WebSocket)
```

```tsx
// app/users/page.tsx - Server Component (default)
// ✅ Fetch data directly in the component — no useEffect needed
export default async function UsersPage() {
  const users = await db.user.findMany(); // Direct DB access!
  return <UserList users={users} />;
}

// components/UserList.tsx - Client Component
'use client';
export function UserListWithFilter({ users }: { users: User[] }) {
  const [search, setSearch] = useState('');
  const filtered = users.filter(u => u.name.includes(search));
  return (
    <>
      <input onChange={(e) => setSearch(e.target.value)} />
      {filtered.map(user => <UserCard key={user.id} user={user} />)}
    </>
  );
}
```

## 3. Data Fetching Patterns

### Server Component (recommended)
```tsx
// ✅ Parallel fetching in a Server Component
async function ProductPage({ params }: { params: { id: string } }) {
  // Fetch simultaneously (no sequential waiting)
  const [product, reviews] = await Promise.all([
    getProduct(params.id),
    getReviews(params.id),
  ]);

  return (
    <div>
      <ProductDetails product={product} />
      <ReviewList reviews={reviews} />
    </div>
  );
}
```

### Caching Strategy (Next.js 15)
```tsx
// ✅ Static — cached indefinitely (default for static fetch)
const data = await fetch('/api/products');

// ✅ Revalidate every 60 seconds (ISR)
const data = await fetch('/api/products', {
  next: { revalidate: 60 }
});

// ✅ No cache — real-time data
const data = await fetch('/api/live-prices', {
  cache: 'no-store'
});

// ✅ Tag-based revalidation (recommended)
const data = await fetch('/api/products', {
  next: { tags: ['products'] }
});

// Revalidate by tag (e.g. after updating data)
import { revalidateTag } from 'next/cache';
revalidateTag('products');
```

## 4. Server Actions (Forms & Mutations)

```tsx
// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createProduct(formData: FormData) {
  const name = formData.get('name') as string;
  
  // Validate
  if (!name) throw new Error('Name is required');
  
  // Save to DB
  await db.product.create({ data: { name } });
  
  // Revalidate cache
  revalidatePath('/products');
  redirect('/products');
}

// app/products/new/page.tsx
export default function NewProductPage() {
  return (
    <form action={createProduct}>
      <input name="name" placeholder="Product name" />
      <button type="submit">Create</button>
    </form>
  );
}
```

## 5. Route Handlers (API Endpoints)

```tsx
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? 1);

  const users = await db.user.findMany({
    skip: (page - 1) * 10,
    take: 10,
  });

  return NextResponse.json({ users, page });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Validate with Zod
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const user = await db.user.create({ data: parsed.data });
  return NextResponse.json(user, { status: 201 });
}
```

## 6. Metadata & SEO

```tsx
// app/products/[id]/page.tsx
import type { Metadata } from 'next';

// ✅ Dynamic metadata
export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const product = await getProduct(params.id);
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      images: [product.imageUrl],
    },
  };
}
```

## 7. Streaming & Suspense

```tsx
// ✅ Use Suspense to stream content in independently
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div>
      <Header /> {/* Renders immediately */}
      
      <Suspense fallback={<StatsSkeleton />}>
        <Stats /> {/* Streams in when ready */}
      </Suspense>
      
      <Suspense fallback={<TableSkeleton />}>
        <DataTable /> {/* Streams independently */}
      </Suspense>
    </div>
  );
}
```

## 8. Image Optimization

```tsx
import Image from 'next/image';

// ✅ Always use next/image (auto optimize, lazy load, WebP conversion)
<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority // for above-the-fold images
  placeholder="blur"
/>
```

## 9. Middleware

```tsx
// middleware.ts (root level)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');
  
  // Redirect if not logged in
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
```

## 10. Environment Variables

```bash
# .env.local
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."

# Public (exposed to browser) — prefix with NEXT_PUBLIC_
NEXT_PUBLIC_API_URL="https://api.example.com"
NEXT_PUBLIC_ANALYTICS_ID="UA-..."
```

```tsx
// ✅ Validate env vars at startup (use @t3-oss/env-nextjs)
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
});
```

## 11. Pre-Production Checklist

- [ ] Using App Router (not Pages Router)
- [ ] TypeScript strict mode enabled
- [ ] Image optimization with next/image
- [ ] Metadata / Open Graph set for every page
- [ ] Error boundaries (`error.tsx`) on every route
- [ ] Loading states (`loading.tsx`) defined
- [ ] Environment variables validated
- [ ] Security headers configured (in `next.config.ts`)
- [ ] Core Web Vitals passing (LCP < 2.5s, FID < 100ms, CLS < 0.1)
