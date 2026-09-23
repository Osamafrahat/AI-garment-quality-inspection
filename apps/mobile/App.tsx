import { StyleSheet, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc } from './trpc/client';
import { TRPCReactProvider } from './trpc/provider';
import { Colors } from '@/constants/Colors';

const Stack = createStackNavigator();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});
const trpcClient = trpc.createClient();

export default function App() {
  return (
    <TRPCReactProvider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <View style={styles.container}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Home" component={HomeScreen} />
            </Stack.Navigator>
          </View>
        </NavigationContainer>
      </QueryClientProvider>
    </TRPCReactProvider>
  );
}

function HomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>ThreadSight Mobile</Text>
      <Text style={styles.subtitle}>Staff App - Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: Colors.textMuted },
});