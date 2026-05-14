# React Native Best Practices (iOS + Android)

## 1. Project Structure (Feature-Based)

```
src/
├── app/                    # Entry point, navigation root
├── features/               # Feature-based modules
│   ├── auth/
│   │   ├── components/     # UI specific to this feature
│   │   ├── screens/        # Screens for this feature
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API calls
│   │   ├── store/          # State management (Zustand/Redux slice)
│   │   └── types/          # TypeScript types
│   └── home/
├── shared/
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Shared hooks
│   ├── utils/              # Helper functions
│   ├── constants/          # App-wide constants
│   └── theme/              # Colors, spacing, typography
├── navigation/             # React Navigation setup
└── services/               # Global services (API client, storage)
```

## 2. Performance Optimization

### Prevent Unnecessary Re-renders
```tsx
// ✅ Use React.memo for components whose props don't change often
const UserCard = React.memo(({ user }: { user: User }) => {
  return <View>...</View>;
});

// ✅ Use useCallback for event handlers
const handlePress = useCallback(() => {
  navigation.navigate('Detail', { id: item.id });
}, [item.id, navigation]);

// ✅ Use useMemo for expensive calculations
const sortedList = useMemo(
  () => items.sort((a, b) => b.date - a.date),
  [items]
);
```

### List Performance
```tsx
// ✅ Use FlatList instead of ScrollView for large datasets
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemCard item={item} />}
  // Key performance props
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={10}
  initialNumToRender={8}
  getItemLayout={(_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### Images
```tsx
// ✅ Use separate require() per image (avoid dynamic strings)
const icon = isActive
  ? require('./icons/active.png')
  : require('./icons/inactive.png');

// ✅ Use transform instead of resizing images
<Image
  source={source}
  style={{ transform: [{ scale: isZoomed ? 2 : 1 }] }}
/>
```

## 3. State Management

```
App Size      | Recommended
──────────────|──────────────────────────────────────
Small / MVP   | useState + Context API
Medium        | Zustand (lightweight, simple API)
Large         | Redux Toolkit (RTK Query for API calls)
```

### Zustand (recommended for mid-size apps)
```tsx
import { create } from 'zustand';

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const user = await authService.login(credentials);
      set({ user, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw error;
    }
  },
  logout: () => set({ user: null }),
}));
```

## 4. Navigation (React Navigation v7)

```tsx
// navigation/RootNavigator.tsx
const Stack = createNativeStackNavigator<RootStackParamList>();

// ✅ Use TypeScript for type-safe navigation
type RootStackParamList = {
  Home: undefined;
  Detail: { id: string; title: string };
  Modal: { onClose: () => void };
};

// ✅ Use Native Stack Navigator (better performance than JS-based)
<Stack.Navigator
  screenOptions={{
    animation: 'slide_from_right', // Native animation
  }}
>
  <Stack.Screen name="Home" component={HomeScreen} />
  <Stack.Screen name="Detail" component={DetailScreen} />
</Stack.Navigator>
```

## 5. API Integration

```tsx
// services/apiClient.ts - Axios with interceptors
const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
});

// Auto-attach token
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await refreshToken();
      return apiClient(error.config);
    }
    return Promise.reject(error);
  }
);
```

### React Query for Server State
```tsx
// ✅ Separate server state (API data) from client state (UI state)
function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

## 6. Platform-Specific Code

```tsx
import { Platform, StyleSheet } from 'react-native';

// ✅ Use Platform.select for platform-specific values
const styles = StyleSheet.create({
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});

// ✅ Platform-specific files (auto-imported by bundler)
// Button.ios.tsx    → used on iOS
// Button.android.tsx → used on Android
```

## 7. Performance Tools

- **Hermes Engine** — Always enable (on by default in RN 0.70+)
- **Flipper** — Debug performance, network, and logs
- **React Native DevTools** — Profile renders
- **Detox** — End-to-end testing

## 8. Security

```tsx
// ✅ Use expo-secure-store for sensitive data (not AsyncStorage)
await SecureStore.setItemAsync('token', accessToken);

// ✅ SSL Pinning for production APIs
// ✅ Obfuscate code for release builds
// ✅ Disable console.log in production
```

## 9. Expo vs Bare React Native

```
Use Expo (Managed/Bare) when:
✅ You need OTA updates (Expo Updates)
✅ You want faster development speed
✅ You don't need unusual native modules

Use Bare React Native when:
✅ You need complex native modules
✅ You need full control over the build process
✅ You have existing native code to integrate
```

## 10. Pre-Production Checklist

- [ ] Hermes engine enabled
- [ ] All console.log removed (use babel-plugin-transform-remove-console)
- [ ] Tested on real iOS and Android devices (not just simulators)
- [ ] Images optimized (WebP format, reduced bundle size)
- [ ] Deep linking configured
- [ ] Crash reporting set up (Sentry / Firebase Crashlytics)
- [ ] App size within limits: < 50MB (Android) / < 100MB (iOS)
